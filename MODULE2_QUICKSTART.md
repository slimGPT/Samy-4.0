# 🚀 Module 2 - Talk Mode Quick Start

## ✅ Module 2 is Complete!

Samy can now have voice conversations! Here's what to do next.

---

## 🔧 Setup (First Time Only)

### 1. Install New Dependencies

```bash
cd apps/api
pnpm install
```

This installs:
- `openai` - For Whisper & GPT
- `multer` - For audio uploads
- `axios` & `form-data` - For ElevenLabs API

### 2. Add API Keys to `.env`

Make sure your root `.env` has:

```env
OPENAI_API_KEY=sk-your-key-here
ELEVENLABS_API_KEY=your-key-here
```

**Get ElevenLabs Key:** https://elevenlabs.io/app/settings/api-keys

---

## 🎮 Run & Test

### 1. Start Both Servers

```bash
# Terminal 1 - API Server
pnpm --filter @apps/api dev

# Terminal 2 - Web App
pnpm --filter @apps/web dev
```

### 2. Test in Browser

1. Open http://localhost:3000
2. Click "Start Listening"
3. Scroll to "🎙️ Talk to Samy"
4. Click "🎤 Hold to Talk"
5. Speak a message (e.g., "Hello Samy!")
6. Click to stop recording
7. Watch Samy respond with voice! 🎉

### 3. Test API Endpoints (Optional)

```bash
# Run automated tests
node scripts/test-talk-endpoints.js

# Or test manually
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"demo-session","message":"Hello!"}'
```

---

## 📚 Documentation

- **`MODULE2_COMPLETE.md`** - Full feature summary
- **`MODULE2_TESTING.md`** - Detailed testing guide with cURL examples
- **`scripts/test-talk-endpoints.js`** - Automated test script

---

## 🎯 What's New

### 3 New API Endpoints

1. **`POST /api/listen`** - Transcribe audio → text (Whisper)
2. **`POST /api/chat`** - Get GPT response with emotion
3. **`POST /api/speak`** - Convert text → speech (ElevenLabs)

### New Web Feature

- **"Talk to Samy"** section with:
  - Voice recording from browser
  - Real-time transcript display
  - GPT reply shown
  - Auto-play of speech response
  - Beautiful UI with status indicators

### Firestore Integration

- State updates automatically during conversation:
  - `listening` → while recording
  - `thinking` → while GPT processes
  - `speaking` → while playing audio
  - `idle` → after conversation

---

## 🔍 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| "OPENAI_API_KEY not configured" | Add key to root `.env` |
| "ELEVENLABS_API_KEY not configured" | Add key to root `.env` and restart server |
| "Microphone error" | Allow microphone access in browser |
| No sound playing | Check audio URL in browser console |
| API not responding | Restart API server |

---

## 🎉 Next: Module 3

With voice working, you can now add:
- 🎭 3D Avatar with Three.js
- 😊 Emotion-based facial expressions
- 👄 Lip-sync animation
- 🎨 Gestures and idle animations

---

## 📁 Key Files Modified

```
apps/api/src/
├── services/          # NEW
│   ├── whisper.ts    # Speech-to-text
│   ├── gpt.ts        # Chat with emotion
│   └── tts.ts        # Text-to-speech
├── app.ts            # Added 3 endpoints
└── package.json      # Added dependencies

apps/web/app/
└── page.tsx          # Added Talk UI

scripts/
└── test-talk-endpoints.js  # NEW - Test script
```

---

**That's it! Module 2 is ready to use.** 🎤🐻

Try talking to Samy now at http://localhost:3000!

