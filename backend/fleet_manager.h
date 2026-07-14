#ifndef FLEET_MANAGER_H
#define FLEET_MANAGER_H

#include "graph.h"
#include "dijkstra.h"
#include <string>
#include <vector>

struct Ambulance {
    std::string id;
    std::string callSign;
    std::string location;
    std::string status; // "Available", "Assigned", "En Route"
};

class FleetManager {
private:
    std::vector<Ambulance> fleet;

public:
    FleetManager() {
        initDefaultFleet();
    }

    void initDefaultFleet() {
        fleet = {
            {"AMB-101", "Rescue Unit 1", "ISBT_Dehradun", "Available"},
            {"AMB-102", "Rescue Unit 2", "Clock_Tower", "Available"},
            {"AMB-103", "Rescue Unit 3", "Prem_Nagar", "Available"},
            {"AMB-104", "Rescue Unit 4", "Rajpur_Road", "Available"}
        };
    }

    std::vector<Ambulance>& getFleet() {
        return fleet;
    }

    const std::vector<Ambulance>& getFleet() const {
        return fleet;
    }

    // Smart greedy assignment of the nearest reachable available ambulance
    int assignNearestAmbulance(const Graph& graph, const std::string& patientLoc, RouteResult& bestRoute) {
        int bestIdx = -1;
        double minDistance = 1e9;
        std::string bestId = "";

        for (size_t i = 0; i < fleet.size(); i++) {
            if (fleet[i].status != "Available") continue;

            RouteResult r = findShortestPath(graph, fleet[i].location, patientLoc);
            if (!r.found) continue;

            // Deterministic selection: min distance, tie-break by lower ambulance ID
            if (r.distanceKm < minDistance || 
               (r.distanceKm == minDistance && (bestId.empty() || fleet[i].id < bestId))) {
                minDistance = r.distanceKm;
                bestId = fleet[i].id;
                bestIdx = (int)i;
                bestRoute = r;
            }
        }
        return bestIdx;
    }

    bool updateAmbulanceStatus(const std::string& ambId, const std::string& newStatus, const std::string& newLoc = "") {
        for (auto& a : fleet) {
            if (a.id == ambId) {
                a.status = newStatus;
                if (!newLoc.empty()) {
                    a.location = newLoc;
                }
                return true;
            }
        }
        return false;
    }
};

#endif // FLEET_MANAGER_H
