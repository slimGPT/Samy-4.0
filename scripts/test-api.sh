#!/bin/bash

# Test script for Candy API
# Usage: ./scripts/test-api.sh

API_URL=${API_URL:-http://localhost:3001}

echo "🧪 Testing Candy API at $API_URL"
echo ""

# Test 1: Health check
echo "Test 1: Health Check"
echo "GET $API_URL/health"
curl -s $API_URL/health | json_pp
echo ""
echo ""

# Test 2: Update state to speaking
echo "Test 2: Update State - Speaking"
echo "POST $API_URL/state"
curl -s -X POST $API_URL/state \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "demo-session",
    "patch": {
      "phase": "speaking",
      "emotion": "happy",
      "energy": 0.8,
      "lang": "en"
    }
  }' | json_pp
echo ""
echo ""

# Test 3: Update state to idle
echo "Test 3: Update State - Idle"
echo "POST $API_URL/state"
curl -s -X POST $API_URL/state \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "demo-session",
    "patch": {
      "phase": "idle",
      "emotion": "calm",
      "energy": 0.3,
      "lang": "en"
    }
  }' | json_pp
echo ""
echo ""

# Test 4: Update state to thinking
echo "Test 4: Update State - Thinking"
echo "POST $API_URL/state"
curl -s -X POST $API_URL/state \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "demo-session",
    "patch": {
      "phase": "thinking",
      "emotion": "curious",
      "energy": 0.6,
      "lang": "en"
    }
  }' | json_pp
echo ""
echo ""

echo "✅ Tests complete! Check http://localhost:3000 to see real-time updates."

