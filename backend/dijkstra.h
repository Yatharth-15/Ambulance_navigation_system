#ifndef DIJKSTRA_H
#define DIJKSTRA_H

#include "graph.h"
#include <vector>
#include <string>
#include <unordered_map>
#include <algorithm>

struct RouteResult {
    bool found;
    std::vector<std::string> path;
    double distanceKm;
    double travelTimeMin;
    int numRoads;
};

// Base speed modeled for city ambulance transit: 35.0 km/h
const double CITY_SPEED_KMH = 35.0;

inline RouteResult findShortestPath(const Graph& graph, const std::string& start, const std::string& end) {
    RouteResult res;
    res.found = false;
    res.distanceKm = 0;
    res.travelTimeMin = 0;
    res.numRoads = 0;

    if (!graph.hasNode(start) || !graph.hasNode(end)) {
        return res;
    }

    if (start == end) {
        res.found = true;
        res.path.push_back(start);
        return res;
    }

    const auto& adjList = graph.getAdjList();
    std::unordered_map<std::string, double> dist;
    std::unordered_map<std::string, std::string> parent;
    std::vector<std::string> unvisited;

    for (const auto& node : adjList) {
        dist[node.first] = 1e9;
        unvisited.push_back(node.first);
    }
    dist[start] = 0.0;

    while (!unvisited.empty()) {
        int minIdx = 0;
        for (size_t i = 1; i < unvisited.size(); i++) {
            if (dist[unvisited[i]] < dist[unvisited[minIdx]]) {
                minIdx = (int)i;
            }
        }

        std::string u = unvisited[minIdx];
        unvisited.erase(unvisited.begin() + minIdx);

        if (u == end) break;
        if (dist[u] >= 1e8) break;

        auto it = adjList.find(u);
        if (it != adjList.end()) {
            for (const auto& edge : it->second) {
                std::string v = edge.to;
                double cost = edge.getCost();
                if (dist[u] + cost < dist[v]) {
                    dist[v] = dist[u] + cost;
                    parent[v] = u;
                }
            }
        }
    }

    if (dist[end] >= 1e8) {
        return res;
    }

    res.found = true;
    res.distanceKm = dist[end];
    res.travelTimeMin = (res.distanceKm / CITY_SPEED_KMH) * 60.0;

    std::string curr = end;
    while (curr != start) {
        res.path.push_back(curr);
        curr = parent[curr];
    }
    res.path.push_back(start);
    std::reverse(res.path.begin(), res.path.end());
    res.numRoads = (int)res.path.size() - 1;

    return res;
}

#endif // DIJKSTRA_H
