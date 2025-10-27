#!/bin/bash

# Test script for /listen endpoint
# Usage: ./test-listen.sh [path_to_audio_file]
#
# This script tests the /listen endpoint by sending an audio file
# and checking the response format

API_URL="${API_URL:-http://localhost:3001}"
AUDIO_FILE="${1:-}"

echo "🧪 Testing /listen endpoint"
echo "================================"
echo "API URL: $API_URL/listen"
echo ""

# Check if audio file is provided
if [ -z "$AUDIO_FILE" ]; then
    echo "❌ Error: No audio file provided"
    echo ""
    echo "Usage: ./test-listen.sh <path_to_audio_file>"
    echo ""
    echo "Example:"
    echo "  ./test-listen.sh recording.webm"
    echo "  ./test-listen.sh test-audio.mp3"
    echo ""
    echo "Supported formats: webm, mp3, wav, m4a, ogg"
    exit 1
fi

# Check if file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo "❌ Error: Audio file not found: $AUDIO_FILE"
    exit 1
fi

# Get file info
FILE_SIZE=$(wc -c < "$AUDIO_FILE")
echo "📁 File: $AUDIO_FILE"
echo "📊 Size: $FILE_SIZE bytes"
echo ""

# Test the endpoint
echo "🚀 Sending request..."
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -F "file=@$AUDIO_FILE" \
    "$API_URL/listen")

# Extract HTTP status and body
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "📥 Response (HTTP $HTTP_STATUS):"
echo "$BODY" | python -m json.tool 2>/dev/null || echo "$BODY"
echo ""

# Check result
if [ "$HTTP_STATUS" -eq 200 ]; then
    # Check if response contains "text" field
    if echo "$BODY" | grep -q '"text"'; then
        echo "✅ SUCCESS: Received transcription"
        
        # Extract and display the text
        TEXT=$(echo "$BODY" | python -c "import sys, json; print(json.load(sys.stdin).get('text', ''))" 2>/dev/null)
        if [ -n "$TEXT" ]; then
            echo "📝 Transcribed text: \"$TEXT\""
        fi
    else
        echo "⚠️  WARNING: Response is 200 but missing 'text' field"
        echo "Expected format: { \"text\": \"...\" }"
    fi
else
    echo "❌ FAILED: HTTP $HTTP_STATUS"
    echo ""
    echo "Common issues:"
    echo "  - Is the API server running? (npm run dev in apps/api)"
    echo "  - Is OPENAI_API_KEY configured?"
    echo "  - Is the audio file format supported?"
fi

echo ""
echo "================================"

