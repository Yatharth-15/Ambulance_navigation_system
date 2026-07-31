import unittest
import os
import json
from server import app, traffic_state, calculate_dijkstra, get_db

class TestAmbulanceSystem(unittest.TestCase):

    def setUp(self):
        self.app = app.test_client()
        # Reset traffic state to default
        for k in traffic_state:
            traffic_state[k]["traffic"] = 1.0
            traffic_state[k]["isBlocked"] = False
        # Reset ambulance statuses in database
        conn = get_db()
        if conn:
            cur = conn.cursor()
            cur.execute("UPDATE ambulances SET status = 'Available'")
            conn.commit()
            conn.close()

    def test_dijkstra_correct_shortest_path(self):
        # Prem_Nagar to Synergy_Hospital is direct (4.0 km)
        res = calculate_dijkstra("Prem_Nagar", "Synergy_Hospital", traffic_state)
        self.assertTrue(res["found"])
        self.assertEqual(res["path"], ["Prem_Nagar", "Synergy_Hospital"])
        self.assertEqual(res["distanceKm"], 4.0)

    def test_dijkstra_multi_hop_route(self):
        # Clock_Tower to Max_Hospital: Clock_Tower -> Rajpur_Road (2.0) -> Jakhan (4.0) -> Max_Hospital (3.0) = 9.0 km
        res = calculate_dijkstra("Clock_Tower", "Max_Hospital", traffic_state)
        self.assertTrue(res["found"])
        self.assertEqual(res["path"], ["Clock_Tower", "Rajpur_Road", "Jakhan", "Max_Hospital"])
        self.assertEqual(res["distanceKm"], 9.0)

    def test_dynamic_reroute_after_road_closure(self):
        # Normal Clock_Tower to Doon_Hospital: 1.0 km direct
        direct = calculate_dijkstra("Clock_Tower", "Doon_Hospital", traffic_state)
        self.assertEqual(direct["distanceKm"], 1.0)

        # Block the direct road
        traffic_state["Clock_Tower__Doon_Hospital"]["isBlocked"] = True
        rerouted = calculate_dijkstra("Clock_Tower", "Doon_Hospital", traffic_state)
        self.assertTrue(rerouted["found"])
        # Alternative path: Clock_Tower -> Rispana_Pul (4.0) -> Doon_Hospital (3.0) = 7.0 km
        self.assertEqual(rerouted["path"], ["Clock_Tower", "Rispana_Pul", "Doon_Hospital"])
        self.assertEqual(rerouted["distanceKm"], 7.0)

    def test_disconnected_or_unreachable_node(self):
        # Block both roads into Prem_Nagar
        traffic_state["Ballupur_Chowk__Prem_Nagar"]["isBlocked"] = True
        traffic_state["Prem_Nagar__Synergy_Hospital"]["isBlocked"] = True

        res = calculate_dijkstra("Clock_Tower", "Prem_Nagar", traffic_state)
        self.assertFalse(res["found"])
        self.assertEqual(res["path"], [])

    def test_invalid_node_handling(self):
        res = calculate_dijkstra("NonExistent_Node", "Clock_Tower", traffic_state)
        self.assertFalse(res["found"])

    def test_smart_ambulance_nearest_assignment(self):
        # AMB-102 is stationed at Clock_Tower. If emergency at Clock_Tower, AMB-102 distance is 0 km
        resp = self.app.post("/api/dispatch", json={
            "patient_name": "Emergency Alpha",
            "location_node": "Clock_Tower",
            "target_hospital": "Doon_Hospital",
            "severity": 1
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data["assigned"])
        self.assertEqual(data["ambulance"]["ambulance_id"], "AMB-102")

    def test_prevent_duplicate_active_assignment(self):
        # Dispatch AMB-102 at Clock_Tower
        resp1 = self.app.post("/api/dispatch", json={
            "patient_name": "Patient 1",
            "location_node": "Clock_Tower",
            "target_hospital": "Doon_Hospital",
            "severity": 1
        })
        data1 = resp1.get_json()
        assigned_first = data1["ambulance"]["ambulance_id"]

        # Next emergency at Clock_Tower must NOT assign the same ambulance
        resp2 = self.app.post("/api/dispatch", json={
            "patient_name": "Patient 2",
            "location_node": "Clock_Tower",
            "target_hospital": "Doon_Hospital",
            "severity": 1
        })
        data2 = resp2.get_json()
        assigned_second = data2["ambulance"]["ambulance_id"]
        self.assertNotEqual(assigned_first, assigned_second)

    def test_mysql_persistence(self):
        conn = get_db()
        self.assertIsNotNone(conn, "MySQL connection should be available")
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT COUNT(*) as cnt FROM dispatches")
        initial_count = cur.fetchone()["cnt"]
        conn.close()

        resp = self.app.post("/api/dispatch", json={
            "patient_name": "Database Persistence Test",
            "location_node": "ISBT_Dehradun",
            "target_hospital": "Synergy_Hospital",
            "severity": 2
        })
        self.assertEqual(resp.status_code, 200)

        conn2 = get_db()
        cur2 = conn2.cursor(dictionary=True)
        cur2.execute("SELECT COUNT(*) as cnt FROM dispatches")
        new_count = cur2.fetchone()["cnt"]
        conn2.close()

        self.assertGreater(new_count, initial_count)

if __name__ == "__main__":
    unittest.main()
