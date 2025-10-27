# 🎤 Module 2 - Talk Mode Testing Guide

## Overview

Module 2 adds voice conversation capabilities to Samy through three API endpoints:
1. **`/api/listen`** - Speech-to-Text (Whisper)
2. **`/api/chat`** - GPT conversation with emotion detection
3. **`/api/speak`** - Text-to-Speech (ElevenLabs)

---

## Prerequisites

### API Keys Required

Make sure these are set in your root `.env` file:

```env
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
```

### Install Dependencies

```bash
cd apps/api
pnpm install
```

The following packages have been added:
- `openai` - For Whisper and GPT
- `multer` - For file uploads
- `axios` - For HTTP requests
- `form-data` - For multipart data

---

## Testing Each Endpoint

### 1. Test `/api/listen` (Speech-to-Text)

**Endpoint:** `POST http://localhost:3001/api/listen`

**Description:** Uploads an audio file and returns the transcribed text.

**cURL Example:**

```bash
# Record a short audio message or use an existing audio file
curl -X POST http://localhost:3001/api/listen \
  -F "audio=@path/to/your/audio.mp3"
```

**Expected Response:**

```json
{
  "success": true,
  "transcript": "Hello, how are you today?"
}
```

**Supported Audio Formats:**
- MP3
- WAV
- M4A
- WebM
- OGG

**Test with a real audio file:**

1. Record a short voice message on your phone
2. Transfer it to your computer
3. Run the curl command with the file path

---

### 2. Test `/api/chat` (GPT Conversation)

**Endpoint:** `POST http://localhost:3001/api/chat`

**Description:** Sends a message to GPT and gets a response with detected emotion.

**cURL Example:**

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "demo-session",
    "message": "Hi Samy! Tell me about bears."
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "reply": "Oh, I love bears! Bears are amazing creatures with soft fur and curious minds. We love exploring and learning about the world around us!",
  "emotion": "happy"
}
```

**Emotion Types:**
- `happy` - Excited, pleased responses
- `calm` - Thoughtful, explanatory responses
- `curious` - Questioning, exploring responses
- `sleepy` - Tired, winding down responses

**Test Different Scenarios:**

```bash
# Happy response
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "demo-session", "message": "Youre awesome!"}'

# Curious response
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "demo-session", "message": "What do you think about space?"}'

# Sleepy response
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "demo-session", "message": "Goodnight Samy"}'
```

---

### 3. Test `/api/speak` (Text-to-Speech)

**Endpoint:** `POST http://localhost:3001/api/speak`

**Description:** Converts text to speech and returns an audio URL.

**cURL Example:**

```bash
curl -X POST http://localhost:3001/api/speak \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "demo-session",
    "text": "Hello! Im Samy the bear, and Im happy to talk with you!"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "audioUrl": "http://localhost:3001/audio/samy-speech-1234567890.mp3"
}
```

**Play the Audio:**

Open the returned `audioUrl` in your browser or use:

```bash
# On Windows
start http://localhost:3001/audio/samy-speech-1234567890.mp3

# On Mac
open http://localhost:3001/audio/samy-speech-1234567890.mp3

# On Linux
xdg-open http://localhost:3001/audio/samy-speech-1234567890.mp3
```

---

## Testing the Complete Flow

### Using the Web Interface

1. **Start the servers:**

```bash
# Terminal 1 - API Server
pnpm --filter @apps/api dev

# Terminal 2 - Web App
pnpm --filter @apps/web dev
```

2. **Open http://localhost:3000**

3. **Test the Talk to Samy feature:**
   - Click "Start Listening"
   - Click "🎤 Hold to Talk"
   - Speak a message
   - Click again to stop recording
   - Watch the processing steps:
     - Your message is transcribed
     - GPT generates a response
     - Speech audio is generated
     - Audio plays automatically

### Manual Test Script (for API only)

Save this as `test-talk-flow.sh`:

```bash
#!/bin/bash

API_URL="http://localhost:3001"
SESSION_ID="test-session-$(date +%s)"

echo "🎙️ Testing complete Talk Mode flow..."
echo "Session ID: $SESSION_ID"
echo ""

# Test 1: Transcribe audio
echo "1️⃣ Testing /api/listen..."
TRANSCRIPT=$(curl -s -X POST $API_URL/api/listen \
  -F "audio=@test-audio.mp3" | jq -r '.transcript')
echo "✅ Transcript: $TRANSCRIPT"
echo ""

# Test 2: Get GPT response
echo "2️⃣ Testing /api/chat..."
CHAT_RESPONSE=$(curl -s -X POST $API_URL/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"message\":\"$TRANSCRIPT\"}")
REPLY=$(echo $CHAT_RESPONSE | jq -r '.reply')
EMOTION=$(echo $CHAT_RESPONSE | jq -r '.emotion')
echo "✅ Reply: $REPLY"
echo "✅ Emotion: $EMOTION"
echo ""

# Test 3: Generate speech
echo "3️⃣ Testing /api/speak..."
SPEAK_RESPONSE=$(curl -s -X POST $API_URL/api/speak \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"text\":\"$REPLY\"}")
AUDIO_URL=$(echo $SPEAK_RESPONSE | jq -r '.audioUrl')
echo "✅ Audio URL: $AUDIO_URL"
echo ""

echo "🎉 Complete flow test finished!"
echo "Open $AUDIO_URL to hear Samy's response"
```

Make it executable:

```bash
chmod +x test-talk-flow.sh
./test-talk-flow.sh
```

---

## Troubleshooting

### Error: "OPENAI_API_KEY is not configured"

**Solution:** Add your OpenAI API key to the root `.env` file:

```env
OPENAI_API_KEY=sk-your-key-here
```

### Error: "ELEVENLABS_API_KEY is not configured"

**Solution:** Add your ElevenLabs API key to the root `.env` file:

```env
ELEVENLABS_API_KEY=your-key-here
```

Get your ElevenLabs API key from: https://elevenlabs.io/app/settings/api-keys

### Error: "Failed to transcribe audio"

**Possible causes:**
- Audio file format not supported
- Audio file too large (>25MB limit)
- OpenAI API quota exceeded

**Solution:** Check the audio file format and size.

### Error: "Microphone error" in web app

**Solution:** 
- Grant microphone permissions in your browser
- Check browser settings → Privacy → Microphone
- Try using HTTPS (mic access might be blocked on HTTP)

### Audio playback issues

**Solution:**
- Check that the API server is running on port 3001
- Verify the audio file was generated in `apps/api/temp/audio/`
- Try opening the audio URL directly in your browser

### No sound from ElevenLabs

**Solutions:**
1. Verify your ElevenLabs API key is valid
2. Check your ElevenLabs account quota/credits
3. Test with a simple text: "Hello"

---

## Testing Checklist

- [ ] `/api/listen` transcribes audio correctly
- [ ] `/api/chat` returns appropriate responses
- [ ] `/api/chat` detects emotions correctly
- [ ] `/api/speak` generates audio successfully
- [ ] Audio files are accessible via HTTP
- [ ] Web app records audio from microphone
- [ ] Complete flow works end-to-end
- [ ] Firestore state updates during conversation
- [ ] Audio plays automatically after generation
- [ ] State returns to "idle" after audio ends

---

## Next Steps

Once all tests pass:

1. ✅ Module 2 is complete!
2. 🎨 Move to Module 3 - 3D Avatar Integration
3. 🔄 Add conversation history tracking
4. 🌍 Add multi-language support
5. 🎭 Fine-tune emotion detection

---

## API Reference Summary

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/api/listen` | POST | Audio file (multipart) | `{ transcript: string }` |
| `/api/chat` | POST | `{ sessionId, message }` | `{ reply, emotion }` |
| `/api/speak` | POST | `{ sessionId, text }` | `{ audioUrl }` |

---

**Need help?** Check the console logs in both the API server and web app for detailed error messages.

