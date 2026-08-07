# 🚑 Smart Ambulance Navigation & Fleet Dispatch System
> **A complete college-level DSA + Full-Stack project based on the real road network of Dehradun, Uttarakhand with Leaflet.js real-world maps and OSRM real-road geometry.**

---

## 🌟 1. Architecture Highlights: Best of Both Worlds

You don't need to choose between DSA concepts and a real visual map. This project combines both:
1. **The C++ Algorithmic Core (`backend/`)**: Maintains the custom **Binary Min-Heap Priority Queue**, Adjacency List Graph, and deterministic nearest-ambulance selection algorithms for high-speed algorithmic evaluation.
2. **Real Interactive Dehradun Map (`frontend/`)**: Powered by **Leaflet.js + OpenStreetMap** with actual GPS coordinates of Dehradun landmarks and real driving geometry plotted using **OSRM (Open Source Routing Machine)**.
3. **Dual Map View Switcher**:
   - **🌍 Real Dehradun Map Tab**: Shows the real roads, terrain, and OSRM turn-by-turn driving polylines.
   - **📐 DSA Graph View Tab**: Shows the theoretical node-and-edge graph where you can click road weight tags to simulate landslides and traffic jams!
4. **MySQL Database (`database/`)**: Stores full audit logs, triage severity levels, primary paths, and rerouted detour data.

---

## 🗺️ 2. Real Dehradun GPS Landmarks

| Location | Type | Real GPS (Lat, Lng) |
|---|---|---|
| **ISBT Dehradun** | Intercity Transit Hub | `30.2866, 77.9996` |
| **Clock Tower (Ghanta Ghar)** | City Center Hub | `30.3244, 78.0416` |
| **Ballupur Chowk** | West Junction | `30.3347, 78.0125` |
| **Prem Nagar** | Far West Junction | `30.3372, 77.9575` |
| **Rajpur Road** | North Corridor | `30.3450, 78.0560` |
| **Jakhan** | North Transit Hub | `30.3662, 78.0732` |
| **Rispana Pul** | Bypass Junction | `30.2974, 78.0537` |
| **Synergy Hospital** | 🏥 Hospital | `30.3448, 78.0149` |
| **Doon Hospital** | 🏥 Hospital | `30.3197, 78.0435` |
| **Max Hospital (Malsi)** | 🏥 Hospital | `30.3846, 78.0825` |

---

## 🧩 3. Data Structures & Algorithms Used

| DSA Concept | File | Role in the System |
|---|---|---|
| **Binary Min-Heap** | `backend/MinHeap.h` | Triage priority queue where Severity 1 (Critical) patients jump to the front of the queue ($O(\log N)$). |
| **Adjacency List** | `backend/graph.h` | Represents the road connections and updates traffic factors ($O(V + E)$). |
| **Dijkstra's Algorithm** | `backend/dijkstra.h` | Finds the mathematical shortest path based on edge weights and traffic multipliers. |
| **Greedy Search** | `backend/fleet_manager.h` | Evaluates distance from all available ambulances and assigns the closest unit. |

---

## 📁 4. Project Organization

```
nevigation/
│
├── frontend/                     ← UI with Leaflet + OSRM
│   ├── index.html                ← Dashboard with dual Real Map & Graph tabs
│   ├── style.css                 ← Responsive layout & styling
│   └── app.js                    ← Leaflet map, OSRM routing, & API calls
│
├── backend/                      ← Server & Algorithms
│   ├── graph.h                   ← Adjacency List Graph
│   ├── MinHeap.h                 ← Priority Queue (Min-Heap)
│   ├── dijkstra.h                ← Dijkstra Shortest Path
│   ├── fleet_manager.h           ← Smart Ambulance Assignment logic
│   ├── main.cpp                  ← C++ Engine Driver
│   ├── ambulance.exe             ← Compiled binary
│   ├── server.py                 ← Flask REST API & Web Server
│   └── test_system.py            ← 8 automated unit tests (All passing)
│
├── database/
│   └── schema.sql                ← MySQL database schema
│
├── .gitignore
└── README.md
```

---

## ⚙️ 5. How to Run

### Step 1: Initialize Database (MySQL)
```powershell
python -c "import mysql.connector; conn = mysql.connector.connect(host='localhost', user='root', password='Root'); cur = conn.cursor(); [cur.execute(s.strip()) for s in open('database/schema.sql').read().split(';') if s.strip()]; conn.commit(); print('Database setup completed!')"
```

### Step 2: Run Automated Unit Tests
```powershell
cd backend
python test_system.py
```
*Output: `Ran 8 tests in 0.850s ... OK`*

### Step 3: Start the Web Dashboard
```powershell
cd backend
python server.py
```
Open your browser at:
👉 **`http://localhost:5000`**

---

## 🎓 6. Presentation Demo Script

1. **Real-world Map Visualization**: Open `http://localhost:5000`. Show the interactive Leaflet map centered on Dehradun with markers for hospitals and stations.
2. **Smart Ambulance Dispatch**: Register a patient at `Clock_Tower` for `Doon_Hospital`. Watch the system pick `AMB-102` (stationed right at Clock Tower) and plot the real road path on the map via OSRM!
3. **Simulate a Roadblock**: Switch to the **📐 DSA Graph View** tab, click the road tag to block it (`🚧`), and observe dynamic rerouting instantly calculate the detour path and display it in emerald green on both views!
4. **Mission Complete & Audit Logging**: Click **Complete Mission**, then scroll down to the MySQL table to show the persistent audit record with timestamps and routes.
