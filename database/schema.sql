-- Database Schema for Smart Ambulance Navigation System
-- Database: ambulance_db

CREATE DATABASE IF NOT EXISTS ambulance_db;
USE ambulance_db;

-- 1. Ambulances Table
CREATE TABLE IF NOT EXISTS ambulances (
    ambulance_id VARCHAR(20) PRIMARY KEY,
    call_sign VARCHAR(50) NOT NULL,
    current_location VARCHAR(50) NOT NULL,
    status ENUM('Available', 'Assigned', 'En Route') DEFAULT 'Available',
    vehicle_type VARCHAR(30) DEFAULT 'Advanced Life Support',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Hospitals Table
CREATE TABLE IF NOT EXISTS hospitals (
    hospital_id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    total_beds INT DEFAULT 50,
    emergency_contact VARCHAR(20)
);

-- 3. Emergency Requests Table
CREATE TABLE IF NOT EXISTS emergency_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_name VARCHAR(100) NOT NULL,
    severity INT NOT NULL CHECK (severity BETWEEN 1 AND 4),
    location_node VARCHAR(50) NOT NULL,
    target_hospital VARCHAR(50) NOT NULL,
    status ENUM('Pending', 'Assigned', 'Dispatched', 'Completed', 'Cancelled') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Dispatches Table (History & Active Dispatches)
CREATE TABLE IF NOT EXISTS dispatches (
    dispatch_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    ambulance_id VARCHAR(20) NOT NULL,
    start_location VARCHAR(50) NOT NULL,
    patient_location VARCHAR(50) NOT NULL,
    hospital_location VARCHAR(50) NOT NULL,
    primary_route TEXT NOT NULL,
    total_distance_km DECIMAL(6,2) NOT NULL,
    estimated_time_min DECIMAL(6,2) NOT NULL,
    num_roads INT NOT NULL,
    rerouted_route TEXT DEFAULT NULL,
    rerouted_distance_km DECIMAL(6,2) DEFAULT NULL,
    rerouted_time_min DECIMAL(6,2) DEFAULT NULL,
    dispatch_status ENUM('Assigned', 'En Route to Patient', 'Transporting to Hospital', 'Completed') DEFAULT 'Assigned',
    dispatch_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES emergency_requests(request_id) ON DELETE CASCADE,
    FOREIGN KEY (ambulance_id) REFERENCES ambulances(ambulance_id)
);

-- Initial seed data for Ambulances (if empty)
INSERT IGNORE INTO ambulances (ambulance_id, call_sign, current_location, status, vehicle_type) VALUES
('AMB-101', 'Rescue Unit 1', 'ISBT_Dehradun', 'Available', 'Advanced Life Support'),
('AMB-102', 'Rescue Unit 2', 'Clock_Tower', 'Available', 'Basic Life Support'),
('AMB-103', 'Rescue Unit 3', 'Prem_Nagar', 'Available', 'Advanced Life Support'),
('AMB-104', 'Rescue Unit 4', 'Rajpur_Road', 'Available', 'Basic Life Support');

-- Initial seed data for Hospitals (if empty)
INSERT IGNORE INTO hospitals (hospital_id, name, total_beds, emergency_contact) VALUES
('Synergy_Hospital', 'Synergy Hospital (Ballupur)', 120, '+91-135-222-1111'),
('Doon_Hospital', 'Doon Government Hospital', 250, '+91-135-222-2222'),
('Max_Hospital', 'Max Super Speciality Hospital (Malsi)', 200, '+91-135-222-3333');
