import os
import json
import subprocess
from flask import Flask, request, jsonify, send_from_directory
import mysql.connector
from mysql.connector import pooling

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))
AMBULANCE_EXE = os.path.join(BASE_DIR, "ambulance.exe")

# Load MySQL settings from environment with fallback
DB_HOST = os.environ.get("MYSQL_HOST", "localhost")
DB_USER = os.environ.get("MYSQL_USER", "root")
DB_PASS = os.environ.get("MYSQL_PASSWORD", "Root")
DB_NAME = os.environ.get("MYSQL_DATABASE", "ambulance_db")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")

# Dehradun Map Topology
ROAD_EDGES = [
    {"u": "ISBT_Dehradun", "v": "Ballupur_Chowk", "dist": 6.0},
    {"u": "ISBT_Dehradun", "v": "Rispana_Pul", "dist": 5.0},
    {"u": "Ballupur_Chowk", "v": "Prem_Nagar", "dist": 5.0},
    {"u": "Ballupur_Chowk", "v": "Synergy_Hospital", "dist": 1.0},
    {"u": "Ballupur_Chowk", "v": "Clock_Tower", "dist": 4.0},
    {"u": "Prem_Nagar", "v": "Synergy_Hospital", "dist": 4.0},
    {"u": "Clock_Tower", "v": "Doon_Hospital", "dist": 1.0},
    {"u": "Clock_Tower", "v": "Rajpur_Road", "dist": 2.0},
    {"u": "Clock_Tower", "v": "Rispana_Pul", "dist": 4.0},
    {"u": "Rispana_Pul", "v": "Doon_Hospital", "dist": 3.0},
    {"u": "Rajpur_Road", "v": "Jakhan", "dist": 4.0},
    {"u": "Jakhan", "v": "Max_Hospital", "dist": 3.0},
    {"u": "Synergy_Hospital", "v": "Doon_Hospital", "dist": 5.0}
]

# In-memory traffic & roadblocks state (shared with frontend/Dijkstra)
traffic_state = {}
for e in ROAD_EDGES:
    key = f"{e['u']}__{e['v']}"
    traffic_state[key] = {"traffic": 1.0, "isBlocked": False, "dist": e["dist"]}

# In-memory fleet fallback (if MySQL unavailable)
in_memory_ambulances = [
    {"ambulance_id": "AMB-101", "call_sign": "Rescue Unit 1", "current_location": "ISBT_Dehradun", "status": "Available", "vehicle_type": "Advanced Life Support"},
    {"AMB-102": "AMB-102", "call_sign": "Rescue Unit 2", "current_location": "Clock_Tower", "status": "Available", "vehicle_type": "Basic Life Support"},
    {"ambulance_id": "AMB-103", "call_sign": "Rescue Unit 3", "current_location": "Prem_Nagar", "status": "Available", "vehicle_type": "Advanced Life Support"},
    {"ambulance_id": "AMB-104", "call_sign": "Rescue Unit 4", "current_location": "Rajpur_Road", "status": "Available", "vehicle_type": "Basic Life Support"}
]
# Fix key typo in AMB-102
in_memory_ambulances[1]["ambulance_id"] = "AMB-102"
in_memory_dispatches = []

def get_db():
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASS,
            database=DB_NAME
        )
        return conn
    except Exception as e:
        print(f"[DB Warning] Could not connect to MySQL: {e}")
        return None

# Authoritative Dijkstra Implementation in Python matching C++
def calculate_dijkstra(start_node, end_node, edge_state):
    # Build graph from edge_state
    graph = {}
    for edge_key, state in edge_state.items():
        u, v = edge_key.split("__")
        if u not in graph: graph[u] = []
        if v not in graph: graph[v] = []
        if not state.get("isBlocked", False):
            cost = state["dist"] * state.get("traffic", 1.0)
            graph[u].append((v, cost))
            graph[v].append((u, cost))

    if start_node not in graph or end_node not in graph:
        return {"found": False, "path": [], "distanceKm": 0, "travelTimeMin": 0, "numRoads": 0}

    if start_node == end_node:
        return {"found": True, "path": [start_node], "distanceKm": 0, "travelTimeMin": 0, "numRoads": 0}

    import heapq
    distances = {node: float("inf") for node in graph}
    distances[start_node] = 0
    pq = [(0, start_node)]
    parent = {}
    visited = set()

    while pq:
        curr_dist, u = heapq.heappop(pq)
        if u in visited:
            continue
        visited.add(u)

        if u == end_node:
            break

        for v, weight in graph.get(u, []):
            if distances[u] + weight < distances[v]:
                distances[v] = distances[u] + weight
                parent[v] = u
                heapq.heappush(pq, (distances[v], v))

    if distances[end_node] == float("inf"):
        return {"found": False, "path": [], "distanceKm": 0, "travelTimeMin": 0, "numRoads": 0}

    path = []
    curr = end_node
    while curr != start_node:
        path.append(curr)
        curr = parent[curr]
    path.append(start_node)
    path.reverse()

    dist_km = round(distances[end_node], 2)
    time_min = round((dist_km / 35.0) * 60.0, 1)

    return {
        "found": True,
        "path": path,
        "distanceKm": dist_km,
        "travelTimeMin": time_min,
        "numRoads": len(path) - 1
    }

# --- ROUTES ---

@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/api/map/status", methods=["GET"])
def get_map_status():
    return jsonify({
        "edges": traffic_state,
        "speed_model": "35 km/h standard city road speed"
    })

@app.route("/api/map/edge", methods=["POST"])
def update_map_edge():
    data = request.json or {}
    u = data.get("u")
    v = data.get("v")
    traffic = float(data.get("traffic", 1.0))
    is_blocked = bool(data.get("isBlocked", False))

    key1 = f"{u}__{v}"
    key2 = f"{v}__{u}"

    found = False
    for k in [key1, key2]:
        if k in traffic_state:
            traffic_state[k]["traffic"] = traffic
            traffic_state[k]["isBlocked"] = is_blocked
            found = True
            break

    if not found:
        return jsonify({"error": f"Road {u} <-> {v} not found"}), 404

    return jsonify({"success": True, "key": k, "state": traffic_state[k]})

@app.route("/api/map/reset", methods=["POST"])
def reset_map():
    for k in traffic_state:
        traffic_state[k]["traffic"] = 1.0
        traffic_state[k]["isBlocked"] = False
    return jsonify({"success": True, "message": "Map reset to default normal traffic"})

@app.route("/api/ambulances", methods=["GET"])
def get_ambulances():
    conn = get_db()
    if conn:
        try:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT ambulance_id, call_sign, current_location, status, vehicle_type FROM ambulances ORDER BY ambulance_id ASC")
            fleet = cur.fetchall()
            conn.close()
            return jsonify(fleet)
        except Exception as e:
            print("DB error on fetch ambulances:", e)
            conn.close()
    return jsonify(in_memory_ambulances)

@app.route("/api/route", methods=["POST"])
def calculate_route():
    data = request.json or {}
    start = data.get("start")
    end = data.get("end")

    if not start or not end:
        return jsonify({"error": "Start and destination nodes required"}), 400

    result = calculate_dijkstra(start, end, traffic_state)
    return jsonify(result)

@app.route("/api/dispatch", methods=["POST"])
def smart_dispatch():
    data = request.json or {}
    patient_name = data.get("patient_name", "Unknown Patient").strip()
    patient_loc = data.get("location_node")
    hospital_loc = data.get("target_hospital")
    severity = int(data.get("severity", 1))

    if not patient_loc or not hospital_loc:
        return jsonify({"error": "Patient location and target hospital are required"}), 400

    # 1. Fetch available ambulances
    conn = get_db()
    fleet = []
    if conn:
        try:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT ambulance_id, call_sign, current_location, status FROM ambulances WHERE status = 'Available' ORDER BY ambulance_id ASC")
            fleet = cur.fetchall()
        except Exception as e:
            print("DB error fetching available ambulances:", e)
            fleet = [a for a in in_memory_ambulances if a["status"] == "Available"]
    else:
        fleet = [a for a in in_memory_ambulances if a["status"] == "Available"]

    if not fleet:
        return jsonify({
            "assigned": False,
            "error": "No ambulances are currently available in the fleet! All units are assigned."
        }), 409

    # 2. Evaluate shortest distance from each available ambulance to patient
    candidates = []
    for amb in fleet:
        route = calculate_dijkstra(amb["current_location"], patient_loc, traffic_state)
        if route["found"]:
            candidates.append({
                "ambulance": amb,
                "distanceKm": route["distanceKm"],
                "travelTimeMin": route["travelTimeMin"],
                "numRoads": route["numRoads"],
                "path": route["path"]
            })

    if not candidates:
        return jsonify({
            "assigned": False,
            "error": f"No available ambulance can reach {patient_loc} due to roadblocks or disconnected roads."
        }), 404

    # 3. Deterministic assignment: min distance, tie-break by ambulance_id
    candidates.sort(key=lambda c: (c["distanceKm"], c["ambulance"]["ambulance_id"]))
    selected = candidates[0]
    assigned_amb = selected["ambulance"]
    amb_to_patient_route = selected

    # 4. Route from patient to hospital
    patient_to_hosp_route = calculate_dijkstra(patient_loc, hospital_loc, traffic_state)
    if not patient_to_hosp_route["found"]:
        return jsonify({
            "assigned": False,
            "error": f"All routes from patient location ({patient_loc}) to destination hospital ({hospital_loc}) are blocked!"
        }), 404

    total_dist = round(amb_to_patient_route["distanceKm"] + patient_to_hosp_route["distanceKm"], 2)
    total_time = round(amb_to_patient_route["travelTimeMin"] + patient_to_hosp_route["travelTimeMin"], 1)
    full_path = amb_to_patient_route["path"][:-1] + patient_to_hosp_route["path"]

    # 5. Persist to MySQL (with fallback)
    dispatch_record_id = None
    if conn:
        try:
            cur = conn.cursor()
            # Insert emergency request
            cur.execute("""
                INSERT INTO emergency_requests (patient_name, severity, location_node, target_hospital, status)
                VALUES (%s, %s, %s, %s, 'Dispatched')
            """, (patient_name, severity, patient_loc, hospital_loc))
            req_id = cur.lastrowid

            # Insert dispatch record
            cur.execute("""
                INSERT INTO dispatches (
                    request_id, ambulance_id, start_location, patient_location, hospital_location,
                    primary_route, total_distance_km, estimated_time_min, num_roads, dispatch_status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'En Route to Patient')
            """, (
                req_id, assigned_amb["ambulance_id"], assigned_amb["current_location"],
                patient_loc, hospital_loc, " -> ".join(full_path),
                total_dist, total_time, len(full_path) - 1
            ))
            dispatch_record_id = cur.lastrowid

            # Update ambulance status
            cur.execute("UPDATE ambulances SET status = 'Assigned' WHERE ambulance_id = %s", (assigned_amb["ambulance_id"],))
            conn.commit()
            conn.close()
        except Exception as e:
            print("DB error during dispatch persistence:", e)
            if conn: conn.close()

    # Update in-memory state
    for a in in_memory_ambulances:
        if a["ambulance_id"] == assigned_amb["ambulance_id"]:
            a["status"] = "Assigned"

    dispatch_data = {
        "dispatch_id": dispatch_record_id or len(in_memory_dispatches) + 1,
        "assigned": True,
        "ambulance": assigned_amb,
        "patient_name": patient_name,
        "severity": severity,
        "patient_location": patient_loc,
        "hospital_location": hospital_loc,
        "leg1_amb_to_patient": amb_to_patient_route,
        "leg2_patient_to_hosp": patient_to_hosp_route,
        "full_path": full_path,
        "total_distance_km": total_dist,
        "total_time_min": total_time,
        "num_roads": len(full_path) - 1,
        "dispatch_status": "En Route to Patient"
    }

    in_memory_dispatches.append(dispatch_data)
    return jsonify(dispatch_data)

@app.route("/api/reroute", methods=["POST"])
def dynamic_reroute():
    data = request.json or {}
    dispatch_id = data.get("dispatch_id")
    current_node = data.get("current_node")
    dest_node = data.get("destination_node")

    if not current_node or not dest_node:
        return jsonify({"error": "current_node and destination_node required"}), 400

    new_route = calculate_dijkstra(current_node, dest_node, traffic_state)

    if not new_route["found"]:
        return jsonify({
            "found": False,
            "error": f"No alternate route available from {current_node} to {dest_node}. Roads are impassable."
        }), 404

    # Update in MySQL if dispatch_id provided
    conn = get_db()
    if conn and dispatch_id:
        try:
            cur = conn.cursor()
            cur.execute("""
                UPDATE dispatches SET
                    rerouted_route = %s,
                    rerouted_distance_km = %s,
                    rerouted_time_min = %s
                WHERE dispatch_id = %s
            """, (
                " -> ".join(new_route["path"]),
                new_route["distanceKm"],
                new_route["travelTimeMin"],
                dispatch_id
            ))
            conn.commit()
            conn.close()
        except Exception as e:
            print("DB error on reroute record update:", e)
            if conn: conn.close()

    return jsonify({
        "found": True,
        "reroute": new_route
    })

@app.route("/api/complete/<ambulance_id>", methods=["POST"])
def complete_mission(ambulance_id):
    data = request.json or {}
    new_location = data.get("location")
    dispatch_id = data.get("dispatch_id")

    conn = get_db()
    if conn:
        try:
            cur = conn.cursor()
            if new_location:
                cur.execute("UPDATE ambulances SET status = 'Available', current_location = %s WHERE ambulance_id = %s", (new_location, ambulance_id))
            else:
                cur.execute("UPDATE ambulances SET status = 'Available' WHERE ambulance_id = %s", (ambulance_id,))
            
            if dispatch_id:
                cur.execute("UPDATE dispatches SET dispatch_status = 'Completed' WHERE dispatch_id = %s", (dispatch_id,))
            conn.commit()
            conn.close()
        except Exception as e:
            print("DB complete mission error:", e)
            if conn: conn.close()

    for a in in_memory_ambulances:
        if a["ambulance_id"] == ambulance_id:
            a["status"] = "Available"
            if new_location: a["current_location"] = new_location

    return jsonify({"success": True, "message": f"Ambulance {ambulance_id} is now Available at {new_location or 'station'}."})

@app.route("/api/history", methods=["GET"])
def get_dispatch_history():
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()
    severity = request.args.get("severity", "").strip()
    ambulance = request.args.get("ambulance", "").strip()

    conn = get_db()
    if conn:
        try:
            cur = conn.cursor(dictionary=True)
            query = """
                SELECT d.dispatch_id, d.request_id, r.patient_name, r.severity,
                       d.ambulance_id, a.call_sign, d.start_location, d.patient_location,
                       d.hospital_location, d.primary_route, d.total_distance_km,
                       d.estimated_time_min, d.num_roads, d.rerouted_route,
                       d.rerouted_distance_km, d.rerouted_time_min, d.dispatch_status,
                       DATE_FORMAT(d.dispatch_timestamp, '%Y-%m-%d %H:%i') as dispatch_time
                FROM dispatches d
                JOIN emergency_requests r ON d.request_id = r.request_id
                JOIN ambulances a ON d.ambulance_id = a.ambulance_id
                WHERE 1=1
            """
            params = []
            if search:
                query += " AND (r.patient_name LIKE %s OR d.primary_route LIKE %s)"
                params.extend([f"%{search}%", f"%{search}%"])
            if status:
                query += " AND d.dispatch_status = %s"
                params.append(status)
            if severity:
                query += " AND r.severity = %s"
                params.append(int(severity))
            if ambulance:
                query += " AND d.ambulance_id = %s"
                params.append(ambulance)

            query += " ORDER BY d.dispatch_id DESC LIMIT 50"
            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            conn.close()
            return jsonify(rows)
        except Exception as e:
            print("DB error fetching history:", e)
            conn.close()

    # Fallback to in-memory history
    filtered = list(in_memory_dispatches)
    if search:
        filtered = [d for d in filtered if search.lower() in d.get("patient_name", "").lower() or search.lower() in " ".join(d.get("full_path", [])).lower()]
    if status:
        filtered = [d for d in filtered if d.get("dispatch_status") == status]
    if severity:
        filtered = [d for d in filtered if str(d.get("severity")) == severity]
    if ambulance:
        filtered = [d for d in filtered if d.get("ambulance", {}).get("ambulance_id") == ambulance]

    return jsonify(filtered)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting RescueRoute Backend on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
