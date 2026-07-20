#include <iostream>
#include <vector>
#include <string>
#include <iomanip>
#include "graph.h"
#include "MinHeap.h"
#include "dijkstra.h"
#include "fleet_manager.h"

using namespace std;

// Initialize Dehradun, Uttarakhand Road Network Graph
void setupDehradunMap(Graph& g) {
    g.clear();
    g.addRoad("ISBT_Dehradun", "Ballupur_Chowk", 6.0);
    g.addRoad("ISBT_Dehradun", "Rispana_Pul", 5.0);
    g.addRoad("Ballupur_Chowk", "Prem_Nagar", 5.0);
    g.addRoad("Ballupur_Chowk", "Synergy_Hospital", 1.0);
    g.addRoad("Ballupur_Chowk", "Clock_Tower", 4.0);
    g.addRoad("Prem_Nagar", "Synergy_Hospital", 4.0);
    g.addRoad("Clock_Tower", "Doon_Hospital", 1.0);
    g.addRoad("Clock_Tower", "Rajpur_Road", 2.0);
    g.addRoad("Clock_Tower", "Rispana_Pul", 4.0);
    g.addRoad("Rispana_Pul", "Doon_Hospital", 3.0);
    g.addRoad("Rajpur_Road", "Jakhan", 4.0);
    g.addRoad("Jakhan", "Max_Hospital", 3.0);
    g.addRoad("Synergy_Hospital", "Doon_Hospital", 5.0);
}

// JSON API Helper for programmatic calls
void runJsonApiMode(const Graph& graph, FleetManager& fleet, const string& cmd, const vector<string>& args) {
    if (cmd == "route" && args.size() >= 2) {
        RouteResult r = findShortestPath(graph, args[0], args[1]);
        cout << "{\"found\":" << (r.found ? "true" : "false")
             << ",\"distanceKm\":" << r.distanceKm
             << ",\"travelTimeMin\":" << r.travelTimeMin
             << ",\"numRoads\":" << r.numRoads
             << ",\"path\":[";
        for (size_t i = 0; i < r.path.size(); i++) {
            cout << "\"" << r.path[i] << "\"" << (i + 1 < r.path.size() ? "," : "");
        }
        cout << "]}" << endl;
    }
    else if (cmd == "assign" && args.size() >= 1) {
        RouteResult r;
        int idx = fleet.assignNearestAmbulance(graph, args[0], r);
        if (idx == -1) {
            cout << "{\"assigned\":false,\"message\":\"No available ambulance can reach this location\"}" << endl;
        } else {
            const auto& amb = fleet.getFleet()[idx];
            cout << "{\"assigned\":true"
                 << ",\"ambulanceId\":\"" << amb.id << "\""
                 << ",\"callSign\":\"" << amb.callSign << "\""
                 << ",\"startLocation\":\"" << amb.location << "\""
                 << ",\"distanceKm\":" << r.distanceKm
                 << ",\"travelTimeMin\":" << r.travelTimeMin
                 << ",\"numRoads\":" << r.numRoads
                 << ",\"path\":[";
            for (size_t i = 0; i < r.path.size(); i++) {
                cout << "\"" << r.path[i] << "\"" << (i + 1 < r.path.size() ? "," : "");
            }
            cout << "]}" << endl;
        }
    }
}

int main(int argc, char* argv[]) {
    Graph dehradunGraph;
    setupDehradunMap(dehradunGraph);

    MinHeap patientQueue;
    FleetManager fleetManager;

    int requestCounter = 0;
    int timestampCounter = 0;

    // Check if run in JSON API mode
    if (argc >= 3 && string(argv[1]) == "--api") {
        string cmd = argv[2];
        vector<string> args;
        for (int i = 3; i < argc; i++) args.push_back(argv[i]);
        runJsonApiMode(dehradunGraph, fleetManager, cmd, args);
        return 0;
    }

    int choice;
    while (true) {
        cout << "\n==========================================" << endl;
        cout << "   SMART AMBULANCE NAVIGATION (DEHRADUN)   " << endl;
        cout << "==========================================" << endl;
        cout << "1. Register Emergency (Patient Intake)" << endl;
        cout << "2. Dispatch Next Ambulance (Smart Assignment)" << endl;
        cout << "3. Update Road Congestion / Roadblock" << endl;
        cout << "4. Show Ambulance Fleet Status" << endl;
        cout << "5. Show Waiting Patient Priority Queue" << endl;
        cout << "6. Reset Fleet & Road Network" << endl;
        cout << "7. Exit" << endl;
        cout << "Enter choice (1-7): ";

        if (!(cin >> choice)) break;
        if (choice == 7) break;

        if (choice == 1) {
            Patient p;
            p.id = ++requestCounter;
            p.timestamp = ++timestampCounter;
            cout << "Patient Name: ";
            cin.ignore();
            getline(cin, p.name);
            cout << "Incident Location (e.g. Clock_Tower): ";
            getline(cin, p.start);
            cout << "Target Hospital (Synergy_Hospital, Doon_Hospital, Max_Hospital): ";
            getline(cin, p.dest);
            cout << "Severity (1=Critical, 2=High, 3=Medium, 4=Low): ";
            cin >> p.severity;

            if (!dehradunGraph.hasNode(p.start) || !dehradunGraph.hasNode(p.dest)) {
                cout << "[ERROR] Invalid location node entered!" << endl;
                continue;
            }

            patientQueue.insert(p);
            cout << "SUCCESS: Patient registered under Request ID #" << p.id << endl;
        }
        else if (choice == 2) {
            if (patientQueue.empty()) {
                cout << "[INFO] Waiting priority queue is empty." << endl;
            } else {
                Patient p = patientQueue.extractMin();
                cout << "\nProcessing Emergency Request #" << p.id << " for " << p.name << " (Severity: " << p.severity << ")" << endl;
                cout << "Patient Location: " << p.start << " | Target Hospital: " << p.dest << endl;

                RouteResult ambToPatient;
                int assignedIdx = fleetManager.assignNearestAmbulance(dehradunGraph, p.start, ambToPatient);

                if (assignedIdx == -1) {
                    cout << "[ALERT] No available ambulance can reach " << p.start << "!" << endl;
                    patientQueue.insert(p); // Put patient back in queue
                } else {
                    const auto& amb = fleetManager.getFleet()[assignedIdx];
                    fleetManager.updateAmbulanceStatus(amb.id, "Assigned");

                    cout << "\n>>> SMART DISPATCH SUMMARY <<<" << endl;
                    cout << "Assigned Ambulance : " << amb.id << " (" << amb.callSign << ")" << endl;
                    cout << "Current Station    : " << amb.location << endl;
                    cout << "Distance to Patient: " << fixed << setprecision(1) << ambToPatient.distanceKm << " km" << endl;
                    cout << "Est. Arrival Time  : " << fixed << setprecision(1) << ambToPatient.travelTimeMin << " mins (@ 35 km/h base)" << endl;
                    cout << "Approach Route     : ";
                    for (size_t i = 0; i < ambToPatient.path.size(); i++) {
                        cout << ambToPatient.path[i] << (i + 1 < ambToPatient.path.size() ? " -> " : "");
                    }
                    cout << endl;

                    RouteResult patientToHosp = findShortestPath(dehradunGraph, p.start, p.dest);
                    if (patientToHosp.found) {
                        cout << "Hospital Route     : ";
                        for (size_t i = 0; i < patientToHosp.path.size(); i++) {
                            cout << patientToHosp.path[i] << (i + 1 < patientToHosp.path.size() ? " -> " : "");
                        }
                        cout << "\nHospital Leg Dist  : " << patientToHosp.distanceKm << " km (" 
                             << patientToHosp.travelTimeMin << " mins)" << endl;

                        fleetManager.updateAmbulanceStatus(amb.id, "Available", p.dest);
                    } else {
                        cout << "[WARNING] No clear route from patient to destination hospital!" << endl;
                    }
                }
            }
        }
        else if (choice == 3) {
            string u, v;
            double traffic;
            int block;
            cout << "Location 1: "; cin.ignore(); getline(cin, u);
            cout << "Location 2: "; getline(cin, v);
            cout << "Traffic multiplier (1.0 = normal, 2.0 = medium, 4.0 = heavy): "; cin >> traffic;
            cout << "Roadblock (1 = Closed, 0 = Open): "; cin >> block;

            bool ok = dehradunGraph.updateEdge(u, v, traffic, block == 1);
            if (ok) {
                cout << "SUCCESS: Road between " << u << " and " << v << " updated." << endl;
            } else {
                cout << "[ERROR] Road connection not found." << endl;
            }
        }
        else if (choice == 4) {
            cout << "\n================= AMBULANCE FLEET =================" << endl;
            cout << left << setw(10) << "ID" << setw(18) << "Call Sign" << setw(20) << "Location" << "Status" << endl;
            cout << "---------------------------------------------------" << endl;
            for (const auto& a : fleetManager.getFleet()) {
                cout << left << setw(10) << a.id << setw(18) << a.callSign << setw(20) << a.location << a.status << endl;
            }
            cout << "===================================================" << endl;
        }
        else if (choice == 5) {
            if (patientQueue.empty()) {
                cout << "[INFO] Priority queue is empty." << endl;
            } else {
                cout << "\nWaiting Emergency Queue (Min-Heap Array):" << endl;
                const auto& arr = patientQueue.getElements();
                for (size_t i = 0; i < arr.size(); i++) {
                    cout << "[" << i << "] ID: " << arr[i].id << " | " << arr[i].name 
                         << " | Severity: " << arr[i].severity 
                         << " | " << arr[i].start << " -> " << arr[i].dest << endl;
                }
            }
        }
        else if (choice == 6) {
            setupDehradunMap(dehradunGraph);
            fleetManager.initDefaultFleet();
            cout << "SUCCESS: All road traffic and ambulance fleet reset to default." << endl;
        }
    }
    return 0;
}
