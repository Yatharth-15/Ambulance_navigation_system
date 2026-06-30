#ifndef MIN_HEAP_H
#define MIN_HEAP_H

#include <vector>
#include <string>
#include <utility>

struct Patient {
    int id;
    std::string name;
    int severity;      // 1 = Critical, 2 = High, 3 = Medium, 4 = Low
    int timestamp;     // Used for FIFO tie-breaking
    std::string start;
    std::string dest;
};

class MinHeap {
private:
    std::vector<Patient> heap;

    int parent(int i) { return (i - 1) / 2; }
    int left(int i) { return 2 * i + 1; }
    int right(int i) { return 2 * i + 2; }

    bool hasHigherPriority(const Patient& a, const Patient& b) {
        if (a.severity != b.severity) {
            return a.severity < b.severity; // Lower severity number = higher priority
        }
        return a.timestamp < b.timestamp;   // Earlier timestamp goes first
    }

    void heapifyUp(int i) {
        while (i > 0 && hasHigherPriority(heap[i], heap[parent(i)])) {
            std::swap(heap[i], heap[parent(i)]);
            i = parent(i);
        }
    }

    void heapifyDown(int i) {
        int size = (int)heap.size();
        while (true) {
            int l = left(i);
            int r = right(i);
            int smallest = i;

            if (l < size && hasHigherPriority(heap[l], heap[smallest])) {
                smallest = l;
            }
            if (r < size && hasHigherPriority(heap[r], heap[smallest])) {
                smallest = r;
            }
            if (smallest != i) {
                std::swap(heap[i], heap[smallest]);
                i = smallest;
            } else {
                break;
            }
        }
    }

public:
    MinHeap() {}

    void insert(const Patient& p) {
        heap.push_back(p);
        heapifyUp((int)heap.size() - 1);
    }

    Patient extractMin() {
        Patient minItem = heap[0];
        heap[0] = heap.back();
        heap.pop_back();
        if (!heap.empty()) {
            heapifyDown(0);
        }
        return minItem;
    }

    bool empty() const {
        return heap.empty();
    }

    size_t size() const {
        return heap.size();
    }

    const std::vector<Patient>& getElements() const {
        return heap;
    }

    void clear() {
        heap.clear();
    }
};

#endif // MIN_HEAP_H
