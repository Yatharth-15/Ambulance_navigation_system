// Real Geographic GPS Coordinates for Dehradun Locations (Latitude, Longitude)
const DEHRADUN_COORDINATES = {
    "ISBT_Dehradun": { lat: 30.2866, lng: 77.9996, label: "ISBT Dehradun", type: "intersection" },
    "Rispana_Pul": { lat: 30.2974, lng: 78.0537, label: "Rispana Pul", type: "intersection" },
    "Ballupur_Chowk": { lat: 30.3347, lng: 78.0125, label: "Ballupur Chowk", type: "intersection" },
    "Prem_Nagar": { lat: 30.3372, lng: 77.9575, label: "Prem Nagar", type: "intersection" },
    "Synergy_Hospital": { lat: 30.3448, lng: 78.0149, label: "Synergy Hospital", type: "hospital" },
    "Clock_Tower": { lat: 30.3244, lng: 78.0416, label: "Clock Tower (Ghanta Ghar)", type: "intersection" },
    "Doon_Hospital": { lat: 30.3197, lng: 78.0435, label: "Doon Hospital", type: "hospital" },
    "Rajpur_Road": { lat: 30.3450, lng: 78.0560, label: "Rajpur Road", type: "intersection" },
    "Jakhan": { lat: 30.3662, lng: 78.0732, label: "Jakhan", type: "intersection" },
    "Max_Hospital": { lat: 30.3846, lng: 78.0825, label: "Max Hospital (Malsi)", type: "hospital" }
};

// Canvas coordinates for fallback/DSA Graph view
const NODE_POSITIONS = {
    "ISBT_Dehradun": { x: 100, y: 340, type: "intersection", label: "ISBT Dehradun" },
    "Rispana_Pul": { x: 500, y: 340, type: "intersection", label: "Rispana Pul" },
    "Ballupur_Chowk": { x: 180, y: 220, type: "intersection", label: "Ballupur Chowk" },
    "Prem_Nagar": { x: 80, y: 240, type: "intersection", label: "Prem Nagar" },
    "Synergy_Hospital": { x: 180, y: 120, type: "hospital", label: "Synergy Hospital" },
    "Clock_Tower": { x: 350, y: 220, type: "intersection", label: "Clock Tower" },
    "Doon_Hospital": { x: 420, y: 260, type: "hospital", label: "Doon Hospital" },
    "Rajpur_Road": { x: 420, y: 140, type: "intersection", label: "Rajpur Road" },
    "Jakhan": { x: 520, y: 90, type: "intersection", label: "Jakhan" },
    "Max_Hospital": { x: 620, y: 75, type: "hospital", label: "Max Hospital" }
};

const DEFAULT_EDGES = [
    { u: "ISBT_Dehradun", v: "Ballupur_Chowk", dist: 6 },
    { u: "ISBT_Dehradun", v: "Rispana_Pul", dist: 5 },
    { u: "Ballupur_Chowk", v: "Prem_Nagar", dist: 5 },
    { u: "Ballupur_Chowk", v: "Synergy_Hospital", dist: 1 },
    { u: "Ballupur_Chowk", v: "Clock_Tower", dist: 4 },
    { u: "Prem_Nagar", v: "Synergy_Hospital", dist: 4 },
    { u: "Clock_Tower", v: "Doon_Hospital", dist: 1 },
    { u: "Clock_Tower", v: "Rajpur_Road", dist: 2 },
    { u: "Clock_Tower", v: "Rispana_Pul", dist: 4 },
    { u: "Rispana_Pul", v: "Doon_Hospital", dist: 3 },
    { u: "Rajpur_Road", v: "Jakhan", dist: 4 },
    { u: "Jakhan", v: "Max_Hospital", dist: 3 },
    { u: "Synergy_Hospital", v: "Doon_Hospital", dist: 5 }
];

let edges = DEFAULT_EDGES.map(e => ({ ...e, traffic: 1, isBlocked: false }));
let activeDispatch = null;
let activePrimaryPath = [];
let activeReroutePath = [];
let fleetData = [];

// Leaflet Map State
let leafletMap = null;
let mapMarkers = {};
let mapRoutePolylines = [];
let activeView = "real"; // "real" or "graph"

const mapCanvas = document.getElementById("map-canvas");
const ctx = mapCanvas.getContext("2d");
const logBox = document.getElementById("console-output");

function printLog(msg, color = "#f8fafc") {
    const div = document.createElement("div");
    div.style.color = color;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logBox.appendChild(div);
    logBox.scrollTop = logBox.scrollHeight;
}

function showBanner(msg, type = "alert") {
    const banner = document.getElementById("status-banner");
    banner.textContent = msg;
    banner.className = `status-banner ${type}`;
    banner.classList.remove("hidden");
}

function hideBanner() {
    document.getElementById("status-banner").classList.add("hidden");
}

// -------------------------------------------------------------
// 1. LEAFLET REAL MAP & OSRM REAL ROAD ROUTING
// -------------------------------------------------------------
function initLeafletMap() {
    if (typeof L === "undefined") {
        printLog("Leaflet library not loaded, using Canvas view.", "#f59e0b");
        return;
    }

    // Centered around Dehradun center (Clock Tower)
    leafletMap = L.map("leaflet-map").setView([30.3244, 78.0416], 12);

    // OpenStreetMap standard tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap contributors"
    }).addTo(leafletMap);

    // Place location markers
    Object.keys(DEHRADUN_COORDINATES).forEach(key => {
        const item = DEHRADUN_COORDINATES[key];
        const isHosp = item.type === "hospital";

        const markerColor = isHosp ? "#dc2626" : "#2563eb";
        const iconHtml = `<div style="background-color:${markerColor}; width:16px; height:16px; border-radius:50%; border:2px solid #ffffff; box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>`;
        
        const customIcon = L.divIcon({
            html: iconHtml,
            className: "leaflet-custom-marker",
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        const marker = L.marker([item.lat, item.lng], { icon: customIcon }).addTo(leafletMap);
        marker.bindPopup(`<strong>${item.label}</strong><br><small>${isHosp ? "🏥 Hospital" : "📍 Station / Intersection"}</small>`);
        mapMarkers[key] = marker;
    });

    updateLeafletAmbulanceBadges();
}

function updateLeafletAmbulanceBadges() {
    if (!leafletMap) return;

    fleetData.forEach(amb => {
        const coords = DEHRADUN_COORDINATES[amb.current_location];
        if (coords) {
            const marker = mapMarkers[amb.current_location];
            if (marker) {
                const isAvail = amb.status === "Available";
                const popupContent = `
                    <strong>${coords.label}</strong><br>
                    <small>${coords.type === "hospital" ? "🏥 Hospital" : "📍 Location"}</small><br>
                    <span style="color:${isAvail ? '#15803d' : '#b91c1c'}; font-weight:bold;">
                        🚑 ${amb.ambulance_id} (${amb.status})
                    </span>
                `;
                marker.setPopupContent(popupContent);
            }
        }
    });
}

// Fetch real road polyline geometry from OSRM (Open Source Routing Machine)
async function fetchOSRMRoute(waypoints) {
    if (!waypoints || waypoints.length < 2) return null;

    // Convert node names to lon,lat string format for OSRM
    const coordStrings = waypoints.map(nodeName => {
        const item = DEHRADUN_COORDINATES[nodeName];
        return `${item.lng},${item.lat}`;
    });

    const url = `https://router.project-osrm.org/route/v1/driving/${coordStrings.join(";")}?overview=full&geometries=geojson`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.code === "Ok" && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                coordinates: route.geometry.coordinates.map(c => [c[1], c[0]]), // geojson lon,lat -> leaflet lat,lng
                distanceKm: (route.distance / 1000).toFixed(1),
                durationMin: (route.duration / 60).toFixed(1)
            };
        }
    } catch (e) {
        printLog(`OSRM Public Routing API call note: ${e.message}`, "#f59e0b");
    }
    return null;
}

// Clear drawn routes on Leaflet
function clearLeafletRoutes() {
    mapRoutePolylines.forEach(layer => layer.remove());
    mapRoutePolylines = [];
}

// Draw real route on Leaflet Map
async function drawRouteOnLeaflet(pathNodes, isReroute = false) {
    if (!leafletMap) return;

    const color = isReroute ? "#10b981" : "#2563eb"; // Emerald for reroute, Blue for primary
    const osrmResult = await fetchOSRMRoute(pathNodes);

    if (osrmResult && osrmResult.coordinates.length > 0) {
        const polyline = L.polyline(osrmResult.coordinates, {
            color: color,
            weight: 6,
            opacity: 0.85,
            dashArray: isReroute ? "8, 8" : null
        }).addTo(leafletMap);

        mapRoutePolylines.push(polyline);
        leafletMap.fitBounds(polyline.getBounds(), { padding: [40, 40] });
        printLog(`Real Road Geometry plotted via OSRM (${osrmResult.distanceKm} km, ~${osrmResult.durationMin} mins driving).`, "#10b981");
    } else {
        // Fallback straight-line polyline connecting waypoints if OSRM is offline
        const latlngs = pathNodes.map(n => [DEHRADUN_COORDINATES[n].lat, DEHRADUN_COORDINATES[n].lng]);
        const polyline = L.polyline(latlngs, {
            color: color,
            weight: 5,
            opacity: 0.8
        }).addTo(leafletMap);
        mapRoutePolylines.push(polyline);
        leafletMap.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    }
}

// -------------------------------------------------------------
// 2. CANVAS DSA GRAPH FALLBACK VIEW
// -------------------------------------------------------------
function drawCanvasGraph() {
    ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

    edges.forEach(edge => {
        const u = NODE_POSITIONS[edge.u];
        const v = NODE_POSITIONS[edge.v];

        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(v.x, v.y);

        const inPrimary = isEdgeInPath(edge.u, edge.v, activePrimaryPath);
        const inReroute = isEdgeInPath(edge.u, edge.v, activeReroutePath);

        if (edge.isBlocked) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#ef4444";
        } else if (inReroute) {
            ctx.lineWidth = 5;
            ctx.strokeStyle = "#10b981";
        } else if (inPrimary) {
            ctx.lineWidth = 5;
            ctx.strokeStyle = "#2563eb";
        } else if (edge.traffic > 1) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#f59e0b";
        } else {
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#cbd5e1";
        }
        ctx.stroke();

        const midX = (u.x + v.x) / 2;
        const midY = (u.y + v.y) / 2;
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#94a3b8";
        ctx.fillRect(midX - 14, midY - 9, 28, 18);
        ctx.strokeRect(midX - 14, midY - 9, 28, 18);

        ctx.fillStyle = edge.isBlocked ? "#ef4444" : "#0f172a";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(edge.isBlocked ? "🚧" : (edge.dist * edge.traffic) + "k", midX, midY);
    });

    Object.keys(NODE_POSITIONS).forEach(name => {
        const node = NODE_POSITIONS[name];
        const isHosp = node.type === "hospital";
        const ambHere = fleetData.find(a => a.current_location === name && a.status === "Available");

        ctx.beginPath();
        ctx.arc(node.x, node.y, isHosp ? 12 : 8, 0, 2 * Math.PI);
        ctx.fillStyle = isHosp ? "#dc2626" : (ambHere ? "#3b82f6" : "#ffffff");
        ctx.fill();
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#1e293b";
        ctx.font = isHosp ? "bold 11px sans-serif" : "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x, node.y + (isHosp ? 22 : 18));

        if (ambHere) {
            ctx.fillStyle = "#2563eb";
            ctx.font = "bold 9px sans-serif";
            ctx.fillText(`🚑 ${ambHere.ambulance_id}`, node.x, node.y - 12);
        }
    });
}

function isEdgeInPath(u, v, path) {
    if (!path || path.length < 2) return false;
    for (let i = 0; i < path.length - 1; i++) {
        if ((path[i] === u && path[i+1] === v) || (path[i] === v && path[i+1] === u)) {
            return true;
        }
    }
    return false;
}

// -------------------------------------------------------------
// 3. UI CONTROLS & API INTEGRATION
// -------------------------------------------------------------
function setupDropdowns() {
    const startSel = document.getElementById("start-node");
    const destSel = document.getElementById("target-hospital");
    startSel.innerHTML = "";
    destSel.innerHTML = "";

    Object.keys(DEHRADUN_COORDINATES).forEach(name => {
        let opt1 = new Option(DEHRADUN_COORDINATES[name].label, name);
        startSel.add(opt1);
        if (DEHRADUN_COORDINATES[name].type === "hospital") {
            let opt2 = new Option(DEHRADUN_COORDINATES[name].label, name);
            destSel.add(opt2);
        }
    });
}

// Tab switcher between Real Map and Graph view
document.getElementById("tab-real-map").addEventListener("click", () => {
    activeView = "real";
    document.getElementById("tab-real-map").classList.add("active");
    document.getElementById("tab-graph-map").classList.remove("active");
    document.getElementById("real-map-container").classList.remove("hidden");
    document.getElementById("graph-map-container").classList.add("hidden");
    if (leafletMap) leafletMap.invalidateSize();
});

document.getElementById("tab-graph-map").addEventListener("click", () => {
    activeView = "graph";
    document.getElementById("tab-graph-map").classList.add("active");
    document.getElementById("tab-real-map").classList.remove("active");
    document.getElementById("graph-map-container").classList.remove("hidden");
    document.getElementById("real-map-container").classList.add("hidden");
    drawCanvasGraph();
});

async function fetchFleet() {
    try {
        const res = await fetch("/api/ambulances");
        fleetData = await res.json();
        renderFleetTable();
        updateLeafletAmbulanceBadges();
        drawCanvasGraph();
    } catch (e) {
        printLog(`Error fetching fleet: ${e.message}`, "#ef4444");
    }
}

function renderFleetTable() {
    const tbody = document.getElementById("fleet-body");
    tbody.innerHTML = "";

    if (!fleetData || fleetData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No ambulances registered.</td></tr>`;
        return;
    }

    fleetData.forEach(amb => {
        const tr = document.createElement("tr");
        const isAvail = amb.status === "Available";
        const badgeClass = isAvail ? "status-badge-avail" : "status-badge-assigned";

        tr.innerHTML = `
            <td><strong>${amb.ambulance_id}</strong></td>
            <td>${amb.call_sign}</td>
            <td>${amb.current_location.replace(/_/g, " ")}</td>
            <td><span class="${badgeClass}">${amb.status}</span></td>
            <td>
                ${!isAvail ? `<button class="btn btn-sm btn-secondary" onclick="releaseAmbulance('${amb.ambulance_id}')">Release</button>` : `<span style="color:#64748b;">Ready</span>`}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function releaseAmbulance(ambId) {
    try {
        const res = await fetch(`/api/complete/${ambId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        });
        const data = await res.json();
        printLog(data.message, "#10b981");
        await fetchFleet();
        await fetchHistory();
    } catch (e) {
        printLog(`Error releasing ambulance: ${e.message}`, "#ef4444");
    }
}

// Emergency Registration & Dispatch
document.getElementById("emergency-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBanner();

    const patientName = document.getElementById("patient-name").value.trim();
    const locNode = document.getElementById("start-node").value;
    const hospNode = document.getElementById("target-hospital").value;
    const severity = parseInt(document.querySelector('input[name="severity"]:checked').value);

    if (locNode === hospNode) {
        showBanner("Patient is already at the destination hospital!", "alert");
        return;
    }

    printLog(`Evaluating priority emergency for ${patientName} at ${locNode}... (C++ MinHeap Engine)`);

    try {
        const res = await fetch("/api/dispatch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                patient_name: patientName,
                location_node: locNode,
                target_hospital: hospNode,
                severity: severity
            })
        });

        const data = await res.json();

        if (!res.ok || !data.assigned) {
            showBanner(data.error || "Unable to dispatch ambulance.", "alert");
            printLog(`DISPATCH FAILED: ${data.error}`, "#ef4444");
            return;
        }

        activeDispatch = data;
        activePrimaryPath = data.full_path;
        activeReroutePath = [];

        // Update UI Mission Card
        document.getElementById("route-info-box").classList.remove("hidden");
        document.getElementById("mission-title").textContent = `Active Dispatch: ${data.patient_name} (ID #${data.dispatch_id})`;
        document.getElementById("stat-ambulance").textContent = `${data.ambulance.ambulance_id} (${data.ambulance.call_sign})`;
        document.getElementById("stat-dist").textContent = `${data.total_distance_km} km`;
        document.getElementById("stat-time").textContent = `${data.total_time_min} mins`;
        document.getElementById("stat-engine").textContent = "C++ Priority + OSRM";
        document.getElementById("route-path-text").textContent = data.full_path.join(" ➔ ");
        document.getElementById("reroute-comparison").classList.add("hidden");

        printLog(`SUCCESS: Assigned nearest ambulance ${data.ambulance.ambulance_id}. Route: ${data.full_path.join(" ➔ ")} (${data.total_distance_km} km)`, "#10b981");

        // Render on Real Leaflet Map
        clearLeafletRoutes();
        await drawRouteOnLeaflet(data.full_path, false);

        await fetchFleet();
        await fetchHistory();
        drawCanvasGraph();
    } catch (e) {
        showBanner(`Network or server error: ${e.message}`, "alert");
    }
});

// Complete Mission Action
document.getElementById("btn-complete-mission").addEventListener("click", async () => {
    if (!activeDispatch) return;

    try {
        const res = await fetch(`/api/complete/${activeDispatch.ambulance.ambulance_id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                location: activeDispatch.hospital_location,
                dispatch_id: activeDispatch.dispatch_id
            })
        });
        const data = await res.json();
        printLog(`Mission complete! Patient delivered to ${activeDispatch.hospital_location}. ${activeDispatch.ambulance.ambulance_id} is now Available.`, "#10b981");

        document.getElementById("route-info-box").classList.add("hidden");
        activeDispatch = null;
        activePrimaryPath = [];
        activeReroutePath = [];
        clearLeafletRoutes();
        hideBanner();

        await fetchFleet();
        await fetchHistory();
        drawCanvasGraph();
    } catch (e) {
        printLog(`Error completing mission: ${e.message}`, "#ef4444");
    }
});

// Canvas Click handler for traffic toggle
mapCanvas.addEventListener("click", async (e) => {
    const rect = mapCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (mapCanvas.width / rect.width);
    const my = (e.clientY - rect.top) * (mapCanvas.height / rect.height);

    for (let edge of edges) {
        const u = NODE_POSITIONS[edge.u];
        const v = NODE_POSITIONS[edge.v];
        const midX = (u.x + v.x) / 2;
        const midY = (u.y + v.y) / 2;

        if (Math.sqrt((mx - midX)**2 + (my - midY)**2) < 16) {
            let newTraffic = 1.0;
            let newBlocked = false;

            if (!edge.isBlocked && edge.traffic === 1.0) {
                newTraffic = 2.0;
                printLog(`Traffic Congestion: ${edge.u} <-> ${edge.v} set to 2.0x`, "#f59e0b");
            } else if (!edge.isBlocked && edge.traffic === 2.0) {
                newTraffic = 1.0;
                newBlocked = true;
                printLog(`ROAD CLOSED (🚧): ${edge.u} <-> ${edge.v} is completely blocked!`, "#ef4444");
            } else {
                newTraffic = 1.0;
                newBlocked = false;
                printLog(`Road Cleared: ${edge.u} <-> ${edge.v} is back to normal.`, "#10b981");
            }

            edge.traffic = newTraffic;
            edge.isBlocked = newBlocked;

            try {
                await fetch("/api/map/edge", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ u: edge.u, v: edge.v, traffic: newTraffic, isBlocked: newBlocked })
                });
            } catch (err) {}

            if (activeDispatch && isEdgeInPath(edge.u, edge.v, activePrimaryPath)) {
                await checkDynamicReroute();
            }

            drawCanvasGraph();
            break;
        }
    }
});

// Dynamic Rerouting Engine
async function checkDynamicReroute() {
    if (!activeDispatch) return;

    printLog("ROAD BLOCKED ON ACTIVE ROUTE! Recalculating Dijkstra shortest detour...", "#f59e0b");

    try {
        const res = await fetch("/api/reroute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                dispatch_id: activeDispatch.dispatch_id,
                current_node: activeDispatch.ambulance.current_location,
                destination_node: activeDispatch.hospital_location
            })
        });

        const data = await res.json();

        if (res.ok && data.found) {
            activeReroutePath = data.reroute.path;
            const rerouteBox = document.getElementById("reroute-comparison");
            rerouteBox.classList.remove("hidden");

            document.getElementById("reroute-path-text").textContent = activeReroutePath.join(" ➔ ");
            
            const distDelta = (data.reroute.distanceKm - activeDispatch.total_distance_km).toFixed(1);
            const timeDelta = (data.reroute.travelTimeMin - activeDispatch.total_time_min).toFixed(1);

            document.getElementById("reroute-delta-text").textContent = 
                `Comparison: ${data.reroute.distanceKm} km (+${distDelta} km), Est: ${data.reroute.travelTimeMin} mins (+${timeDelta} mins)`;

            showBanner(`Notice: Road obstruction detected. Unit dynamically rerouted via ${activeReroutePath.join(" ➔ ")}`, "alert");
            printLog(`REROUTE FOUND: New route is ${activeReroutePath.join(" ➔ ")} (${data.reroute.distanceKm} km)`, "#10b981");

            // Plot new green alternative route on real Leaflet map
            await drawRouteOnLeaflet(activeReroutePath, true);
            await fetchHistory();
        } else {
            showBanner(`CRITICAL: All routes from ${activeDispatch.ambulance.current_location} to ${activeDispatch.hospital_location} are blocked!`, "alert");
            printLog(`NO ALTERNATE ROUTE: Roads are impassable!`, "#ef4444");
        }
    } catch (e) {
        printLog(`Reroute error: ${e.message}`, "#ef4444");
    }
}

// Reset Map
document.getElementById("btn-reset-map").addEventListener("click", async () => {
    edges.forEach(e => { e.traffic = 1.0; e.isBlocked = false; });
    try {
        await fetch("/api/map/reset", { method: "POST" });
    } catch (e) {}
    activeReroutePath = [];
    document.getElementById("reroute-comparison").classList.add("hidden");
    hideBanner();
    clearLeafletRoutes();
    drawCanvasGraph();
    printLog("All road congestion and roadblocks reset to default normal traffic.");
});

// MySQL History
async function fetchHistory() {
    const search = document.getElementById("history-search").value.trim();
    const status = document.getElementById("filter-status").value;
    const severity = document.getElementById("filter-severity").value;

    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    if (severity) params.append("severity", severity);

    try {
        const res = await fetch(`/api/history?${params.toString()}`);
        const rows = await res.json();
        renderHistoryTable(rows);
    } catch (e) {
        printLog(`Error fetching history: ${e.message}`, "#ef4444");
    }
}

function renderHistoryTable(rows) {
    const tbody = document.getElementById("history-body");
    tbody.innerHTML = "";

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">No dispatch records found.</td></tr>`;
        return;
    }

    rows.forEach(r => {
        const tr = document.createElement("tr");
        const isRerouted = r.rerouted_route ? `<span style="color:#ef4444; font-weight:bold;">Yes (${r.rerouted_distance_km} km)</span>` : "No";
        tr.innerHTML = `
            <td>#${r.dispatch_id}</td>
            <td>${r.dispatch_time || 'Just now'}</td>
            <td><strong>${r.patient_name}</strong></td>
            <td>Lvl ${r.severity}</td>
            <td>${r.ambulance_id}</td>
            <td style="font-family:monospace; font-size:11px;">${r.primary_route}</td>
            <td>${r.total_distance_km}</td>
            <td>${r.estimated_time_min} m</td>
            <td>${isRerouted}</td>
            <td><span class="badge">${r.dispatch_status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById("btn-filter-history").addEventListener("click", fetchHistory);
document.getElementById("btn-reset-history").addEventListener("click", () => {
    document.getElementById("history-search").value = "";
    document.getElementById("filter-status").value = "";
    document.getElementById("filter-severity").value = "";
    fetchHistory();
});
document.getElementById("btn-refresh-fleet").addEventListener("click", fetchFleet);

// Initialize Page
setupDropdowns();
initLeafletMap();
fetchFleet();
fetchHistory();
drawCanvasGraph();
printLog("System initialized. Real Dehradun Map (Leaflet + OSRM) active.");
