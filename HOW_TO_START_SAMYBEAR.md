# 🚀 How to Start SamyBear 4.0

**Simple 3-step launch guide for SamyBear 4.0**

---

## Step 1: Install Dependencies

```bash
# From project root
pnpm install
```

This installs all dependencies for the monorepo (API, Web, and shared packages).

---

## Step 2: Configure Environment Variables

Create a `.env` file in the project root with:

```env
# Required
ELEVENLABS_API_KEY=sk_...  # Your ElevenLabs API key (STT + TTS)
OPENAI_API_KEY=sk-...      # Your OpenAI API key (GPT-4o)

# Optional (for Firebase state persistence)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@....iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional (configuration)
MINIMAL_MODE=false          # Set to true to disable Firebase/emotions
PORT=3001                   # API port (default: 3001)
ENGLISH_ONLY_MODE=false     # Set to true for faster English-only TTS
```

### Getting API Keys

1. **ElevenLabs API Key**:
   - Sign up at https://elevenlabs.io
   - Go to Profile → API Keys
   - Create a new key with STT + TTS permissions
   - Copy the key to `ELEVENLABS_API_KEY`

2. **OpenAI API Key**:
   - Sign up at https://platform.openai.com
   - Go to API Keys section
   - Create a new key
   - Copy the key to `OPENAI_API_KEY`

3. **Firebase** (Optional):
   - Create a Firebase project at https://console.firebase.google.com
   - Go to Project Settings → Service Accounts
   - Generate a new private key
   - Copy the values to your `.env` file

---

## Step 3: Start Servers

### Option A: Using PowerShell Scripts (Windows)

```powershell
# Start API server
.\start-api.ps1

# Start Web server (in new terminal)
.\start-web.ps1
```

### Option B: Manual Start

```bash
# Terminal 1: API Server
cd apps/api
pnpm dev

# Terminal 2: Web Server
cd apps/web
pnpm dev
```

### Option C: One-Liner (PowerShell)

```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; pnpm --filter @apps/api dev"; Start-Sleep 3; Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; pnpm --filter @apps/web dev"; Start-Sleep 10; Start-Process "http://localhost:3000"
```

---

## Step 4: Open Browser

Wait 10-15 seconds for servers to start, then open:
- **Web App**: http://localhost:3000
- **API Health**: http://localhost:3001/health

---

## ✅ Verification

### Check API Server
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "mode": "full",
  "timestamp": 1234567890
}
```

### Check Web App
Open http://localhost:3000 in your browser. You should see:
- SamyBear header and avatar
- Emotion display panel
- Energy bar
- Microphone button
- Development dashboard (right panel)

---

## 🐛 Troubleshooting

### Voice Chat Doesn't Work

1. **Check API Server Window**
   - Look for errors in the PowerShell window
   - Verify `ELEVENLABS_API_KEY` is loaded
   - Check for "ElevenLabs STT (Primary and Only STT Service)" message

2. **Check Browser Console** (F12)
   - Look for `[STT]` errors
   - Check network tab for failed requests

3. **Recording Duration**
   - Speak for at least 2 seconds
   - Minimum recording time is 800ms

### Common Issues

**"No response"** → Check API server is running:
```powershell
Invoke-RestMethod http://localhost:3001/health
```

**"Empty error {}"** → Servers need restart with latest code:
```powershell
# Stop all Node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Restart servers (follow Step 3)
```

**"Recording too short"** → Speak longer (minimum 2 seconds)

**"API key error"** → Verify your `.env` file has the correct keys:
```bash
# Check if keys are loaded
node -e "require('dotenv').config(); console.log('ElevenLabs:', process.env.ELEVENLABS_API_KEY ? 'Found' : 'Missing'); console.log('OpenAI:', process.env.OPENAI_API_KEY ? 'Found' : 'Missing');"
```

---

## 📝 Important Notes

- **Keep both PowerShell/terminal windows open** while using the app
- The API server logs show what's happening in real-time
- Browser console (F12) shows frontend errors
- Development dashboard (right panel) shows real-time agent activity

---

## 🎯 What's Included

✅ ElevenLabs STT only (no fallbacks)  
✅ GPT-4o for conversational AI  
✅ ElevenLabs TTS with natural disfluencies  
✅ Real-time emotion tracking  
✅ Firebase state persistence  
✅ Child-friendly UI  
✅ Development dashboard  

**SamyBear 4.0 is ready to chat!** 🐻

