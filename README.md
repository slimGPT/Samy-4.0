# 🐻 SamyBear 4.0

**An emotionally intelligent teddy bear AI companion for children ages 5-10.**

SamyBear is a voice-first conversational AI designed to encourage curiosity, wonder, and imagination through natural, child-friendly interactions. Built with real-time emotion tracking, natural speech patterns, and screen-free learning principles.

---

## 🎯 What is SamyBear?

SamyBear is a curious, caring teddy bear companion that:
- 🎤 **Listens** to children's voices in real-time
- 🧠 **Understands** context and emotion using GPT-4o
- 🎭 **Responds** with child-appropriate emotions (curious, happy, calm, excited, etc.)
- 🗣️ **Speaks** with natural, expressive voice synthesis (including "hmm...", "weeeell...", laughter)
- 💾 **Remembers** conversations via Firebase
- 🎨 **Shows** emotions through a playful, child-friendly UI
- 🤖 **Integrates** with 3D avatars (Unity, Unreal Engine, etc.)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- ElevenLabs API key (with STT + TTS)
- OpenAI API key (for GPT-4o)
- Firebase project (optional, for state persistence)

### Installation

```bash
# Install dependencies
pnpm install

# Setup environment variables
# Copy .env.example to .env and configure:
# - ELEVENLABS_API_KEY (required for STT + TTS)
# - OPENAI_API_KEY (required for GPT-4o)
# - FIREBASE_PROJECT_ID (optional)
# - FIREBASE_CLIENT_EMAIL (optional)
# - FIREBASE_PRIVATE_KEY (optional)

# Start API server
cd apps/api
pnpm dev

# Start web interface (in new terminal)
cd apps/web
pnpm dev
```

### Access
- **Web UI**: http://localhost:3000
- **API**: http://localhost:3001

For detailed setup instructions, see [HOW_TO_START_SAMYBEAR.md](./HOW_TO_START_SAMYBEAR.md).

---

## 🏗️ Architecture

### Voice Pipeline
```
User Speaks
    ↓
🎤 ElevenLabs STT (Speech-to-Text)
    ↓
🎭 Sentiment Analysis (Detect emotion)
    ↓
🧠 GPT-4o (Generate contextual response)
    ↓
🔥 Firebase Update (Save state: "thinking")
    ↓
🎭 Emotion Engine (Update SamyBear's emotion)
    ↓
🗣️ ElevenLabs TTS (Text-to-Speech with natural disfluencies)
    ↓
🔥 Firebase Update (Save state: "speaking")
    ↓
🎨 UI Updates (Animate emotions, energy bar)
    ↓
🔊 Audio Playback (User hears SamyBear)
```

### Technology Stack
- **STT**: ElevenLabs Real-Time STT (no fallbacks)
- **LLM**: GPT-4o with SamyBear personality prompt
- **TTS**: ElevenLabs TTS with natural speech disfluencies
- **Backend**: Express.js + TypeScript
- **Frontend**: Next.js 16 + React + Tailwind CSS
- **Database**: Firebase Firestore (real-time state)
- **Avatar**: Unity/WebGL ready (placeholder)

See [TECH_STACK.md](./TECH_STACK.md) for complete architecture details.

---

## 🎭 Key Features

### 1. Child-Friendly Voice Interaction
- Push-to-talk recording
- ElevenLabs STT for accurate transcription
- Natural speech disfluencies ("hmm...", "weeeell...", "ooooh!", laughter)
- Emotional voice synthesis

### 2. Emotional Intelligence
- 8 child-appropriate emotions: curious, happy, calm, sleepy, confused, excited, empathetic, sad
- Dynamic emotion transitions based on conversation
- Energy levels that affect voice tone and UI
- Real-time emotion state sync via Firebase

### 3. Playful UI
- Child-friendly color palette (sky blue, warm yellows, gentle greens, soft purples)
- Animated emotion display with bear emojis
- Dynamic energy progress bar with playful labels
- Real-time performance metrics dashboard
- Horizontal development dashboard for debugging

### 4. Natural Speech Patterns
- Automatic injection of thinking sounds ("hmm...", "weeeell...")
- Emotion-based laughter and giggles
- Natural pauses and breathing sounds
- Context-aware disfluencies

### 5. Safety & Content Filtering
- Multi-layer content safety checks
- Automatic redirection of inappropriate topics
- Age-appropriate language only
- Child-safe response generation

---

## 📚 Documentation

- **[HOW_TO_START_SAMYBEAR.md](./HOW_TO_START_SAMYBEAR.md)** - Setup and launch guide
- **[TECH_STACK.md](./TECH_STACK.md)** - Complete architecture and technology details
- **[PERSONALITY_PROMPT.md](./PERSONALITY_PROMPT.md)** - SamyBear's personality system prompt
- **[AVATAR_INTEGRATION.md](./AVATAR_INTEGRATION.md)** - Unity/3D avatar integration guide
- **[RELEASE_NOTES.md](./RELEASE_NOTES.md)** - Version history and roadmap

---

## 🛠️ Project Structure

```
SamyBear 4.0/
├── apps/
│   ├── api/               # Express.js backend
│   │   ├── src/
│   │   │   ├── app.full.ts          # Full mode API (Firebase + Emotions)
│   │   │   ├── app.minimal.ts       # Minimal mode API (debugging)
│   │   │   ├── index.ts             # Entry point
│   │   │   ├── lib/
│   │   │   │   └── firebaseAdmin.ts # Firebase initialization
│   │   │   └── services/
│   │   │       ├── elevenlabs-stt-only.ts  # Speech-to-Text (ElevenLabs only)
│   │   │       ├── gpt.minimal.ts          # GPT-4o integration
│   │   │       ├── sentiment.ts            # Sentiment analysis
│   │   │       ├── emotionEngine.ts        # Emotion state manager
│   │   │       ├── tts.ts                  # Text-to-Speech
│   │   │       ├── tts-streaming.ts         # Streaming TTS
│   │   │       └── tts-disfluencies.ts      # Natural speech patterns
│   │   └── .env                           # API configuration
│   │
│   └── web/               # Next.js 16 frontend
│       ├── app/
│       │   ├── page.tsx              # Main UI
│       │   ├── layout.tsx            # Root layout
│       │   └── globals.css           # Styles
│       ├── components/
│       │   ├── AgentDashboard.tsx    # Development dashboard
│       │   ├── DebugPanel.tsx        # Debug tools
│       │   └── STTRecorder.tsx       # Voice recorder
│       └── lib/
│           └── transcriptUtils.ts    # Transcript processing
│
├── packages/
│   └── shared/            # Shared TypeScript types
│       └── src/
│           └── types.ts   # Emotion, Phase, SessionState types
│
└── scripts/               # Utility scripts
```

---

## 🎯 Performance Targets

| Stage | Target | Status |
|-------|--------|--------|
| STT (Speech-to-Text) | < 2000ms | ✅ Optimized |
| GPT-4o Response | < 2500ms | ✅ Optimized |
| TTS (Text-to-Speech) | < 1500ms | ✅ Optimized |
| **Total Pipeline** | **< 5000ms** | ✅ **Optimized** |

---

## 🔑 Environment Variables

### Required (`apps/api/.env` or root `.env`)
```env
ELEVENLABS_API_KEY=sk_...  # Required for STT + TTS
OPENAI_API_KEY=sk-...      # Required for GPT-4o
```

### Optional (Firebase)
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@....iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Optional (Configuration)
```env
MINIMAL_MODE=false          # Set to true to disable Firebase/emotions
PORT=3001                   # API port (default: 3001)
ENGLISH_ONLY_MODE=false     # Set to true for faster English-only TTS
```

---

## 🧪 Testing

```bash
# API health check
curl http://localhost:3001/health

# Test transcription
curl -X POST -F "file=@test.mp3" http://localhost:3001/listen

# Test conversation
curl -X POST -H "Content-Type: application/json" \
  -d '{"text":"Hello SamyBear!"}' \
  http://localhost:3001/talk
```

---

## 🐛 Debug Mode

To run in minimal mode (without Firebase/emotions for debugging):

```bash
# In .env or apps/api/.env
MINIMAL_MODE=true

# Restart API server
cd apps/api
pnpm dev
```

---

## 🎨 Design Principles

- **Child-Friendly**: All interactions are age-appropriate (5-10 years)
- **Screen-Free Focus**: Short, attention-span-safe interactions
- **Curiosity-Driven**: Encourages questions, wonder, and imagination
- **Emotionally Intelligent**: Responds with appropriate empathy and support
- **Voice-First**: Optimized for natural voice conversations
- **Safety-First**: Multi-layer content filtering and safety checks

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details

---

## 🙏 Acknowledgments

- **OpenAI** - GPT-4o language model
- **ElevenLabs** - Voice synthesis and transcription
- **Firebase** - Backend infrastructure
- **Next.js** - Web framework
- **Tailwind CSS** - UI styling

---

## 📞 Support

For questions or issues:
- Open a GitHub issue
- Check the documentation files
- Review the console logs for debugging

---

**Built with ❤️ for curious, imaginative children everywhere** 🐻✨
