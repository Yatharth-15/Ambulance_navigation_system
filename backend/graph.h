#ifndef GRAPH_H
#define GRAPH_H

#include <string>
#include <vector>
#include <unordered_map>

struct Edge {
    std::string to;
    double weight;
    double traffic;
    bool isBlocked;
    
    double getCost() const {
        return isBlocked ? 1e9 : weight * traffic;
    }
};

class Graph {
private:
    std::unordered_map<std::string, std::vector<Edge>> adjList;

public:
    Graph() {}

    void addNode(const std::string& u) {
        if (adjList.find(u) == adjList.end()) {
            adjList[u] = std::vector<Edge>();
        }
    }

    void addRoad(const std::string& u, const std::string& v, double d) {
        addNode(u);
        addNode(v);
        adjList[u].push_back({v, d, 1.0, false});
        adjList[v].push_back({u, d, 1.0, false});
    }

    bool hasNode(const std::string& u) const {
        return adjList.find(u) != adjList.end();
    }

    const std::unordered_map<std::string, std::vector<Edge>>& getAdjList() const {
        return adjList;
    }

    bool updateEdge(const std::string& u, const std::string& v, double traffic, bool isBlocked) {
        bool found = false;
        if (adjList.find(u) != adjList.end()) {
            for (auto& edge : adjList[u]) {
                if (edge.to == v) {
                    edge.traffic = traffic;
                    edge.isBlocked = isBlocked;
                    found = true;
                }
            }
        }
        if (adjList.find(v) != adjList.end()) {
            for (auto& edge : adjList[v]) {
                if (edge.to == u) {
                    edge.traffic = traffic;
                    edge.isBlocked = isBlocked;
                    found = true;
                }
            }
        }
        return found;
    }

    void clear() {
        adjList.clear();
    }
};

#endif // GRAPH_H
