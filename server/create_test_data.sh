#!/bin/bash

# Base URL
URL="http://localhost:8080/api/v1/businesses"

echo "Creating Business 1: Online Mall (Online)..."
curl -X POST $URL \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Online Mall",
    "description": "E-commerce platform",
    "lifecycle": "online",
    "sres": ["sre1@example.com"],
    "developers": ["dev1@example.com", "dev2@example.com"],
    "testers": ["test1@example.com"],
    "bizops": ["biz1@example.com"]
  }'
echo "\n"

echo "Creating Business 2: Payment Gateway (Online)..."
curl -X POST $URL \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payment Gateway",
    "description": "Secure payment processing",
    "lifecycle": "online",
    "sres": ["sre2@example.com"],
    "developers": ["dev3@example.com"]
  }'
echo "\n"

echo "Creating Business 3: Logistics System (Testing)..."
curl -X POST $URL \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Logistics System",
    "description": "Supply chain management",
    "lifecycle": "testing",
    "sres": ["sre3@example.com"],
    "developers": ["dev4@example.com", "dev5@example.com"],
    "testers": ["test2@example.com", "test3@example.com"]
  }'
echo "\n"

echo "Creating Business 4: Internal HR (Offline)..."
curl -X POST $URL \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Internal HR",
    "description": "Human resources management",
    "lifecycle": "offline",
    "bizops": ["hr1@example.com", "hr2@example.com"]
  }'
echo "\n"

echo "Listing all businesses..."
curl -s $URL | python3 -m json.tool
