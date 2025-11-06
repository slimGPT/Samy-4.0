# 🛠️ SamyBear 4.0 - Technology Stack

**Complete technical architecture and technology choices.**

---

## 📦 Core Technologies

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.0.0 | React framework with Turbopack |
| **React** | 19.x | UI library |
| **TypeScript** | 5.x | Type safety |
| **Tailwind CSS** | 3.x | Styling and animations |
| **pnpm** | 9.x | Package manager |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 22.x | Runtime environment |
| **Express.js** | 4.x | Web server framework |
| **TypeScript** | 5.x | Type safety |
| **tsx** | 4.x | TypeScript execution with hot reload |
| **dotenv** | 16.x | Environment configuration |

### AI & Voice Services
| Service | Model/Version | Purpose |
|---------|---------------|---------|
| **OpenAI** | GPT-4o | Conversational AI (child-friendly responses) |
| **ElevenLabs** | STT API | Speech-to-Text (primary and only) |
| **ElevenLabs** | TTS API | Text-to-Speech (with natural disfluencies) |
| **Custom** | Sentiment Analysis | Emotion detection |

### Database & Backend
| Technology | Purpose |
|------------|---------|
| **Firebase Admin SDK** | Server-side Firebase access |
| **Firestore** | NoSQL database for sessions, emotions, state |
| **Firebase Auth** | User authentication (optional) |

---

## 🏗️ Architecture

### Monorepo Structure
```
SamyBear 4.0/
├── apps/
│   ├── api/          # Backend Express.js server
│   │   ├── src/
│   │   │   ├── app.full.ts       # Full mode (Firebase + Emotions)
│   │   │   ├── app.minimal.ts    # Minimal mode (debugging)
│   │   │   ├── index.ts          # Entry point
│   │   │   └── services/
│   │   │       ├── elevenlabs-stt-only.ts  # STT service
│   │   │       ├── gpt.minimal.ts          # GPT-4o integration
│   │   │       ├── sentiment.ts            # Emotion detection
│   │   │       ├── tts.ts                   # TTS service
│   │   │       ├── tts-streaming.ts         # Streaming TTS
│   │   │       └── tts-disfluencies.ts      # Natural speech patterns
│   │   └── package.json
│   │
│   └── web/          # Next.js frontend
│       ├── app/
│       │   ├── page.tsx          # Main UI
│       │   └── layout.tsx        # Root layout
│       ├── components/
│       │   ├── AgentDashboard.tsx  # Dev dashboard
│       │   ├── DebugPanel.tsx      # Debug tools
│       │   └── STTRecorder.tsx     # Voice recorder
│       └── package.json
│
├── packages/
│   └── shared/       # Shared TypeScript types
│       └── src/
│           └── types.ts
│
└── package.json      # Root package.json
```

---

## 🔄 Data Flow Architecture

### Voice Pipeline Flowchart
```
┌─────────────┐
│  User Speaks │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  ElevenLabs STT      │ ◄─── Audio Buffer (webm/mp3)
│  (Speech-to-Text)     │
└──────┬────────────────┘
       │
       ▼
┌─────────────────────┐
│  Transcript Text      │
└──────┬────────────────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  Sentiment     │  │  Content     │
│  Analysis      │  │  Safety      │
│  (Emotion)     │  │  Filter      │
└──────┬─────────┘  └──────┬───────┘
       │                    │
       └────────┬───────────┘
                │
                ▼
┌─────────────────────┐
│  GPT-4o             │ ◄─── SamyBear Personality Prompt
│  (Response Gen)      │      + Emotion Context
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Firebase Update     │ ◄─── State: "thinking"
│  (State Sync)        │      Emotion: detected
└──────┬───────────────┘
       │
       ▼
┌─────────────────────┐
│  Emotion Engine      │ ◄─── Update SamyBear's emotion
│  (State Transition)   │      Energy level
└──────┬───────────────┘
       │
       ▼
┌─────────────────────┐
│  TTS Disfluencies    │ ◄─── Add "hmm...", "weeeell..."
│  (Natural Speech)     │      Laughter, pauses
└──────┬───────────────┘
       │
       ▼
┌─────────────────────┐
│  ElevenLabs TTS     │ ◄─── Enhanced text + emotion
│  (Text-to-Speech)    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Firebase Update     │ ◄─── State: "speaking"
│  (State Sync)        │      Audio URL
└──────┬───────────────┘
       │
       ▼
┌─────────────────────┐
│  Frontend UI         │ ◄─── Emotion display
│  (React)             │      Energy bar
└──────┬───────────────┘
       │
       ▼
┌─────────────────────┐
│  Audio Playback      │
│  (Browser)           │
└─────────────────────┘
```

---

## 🔌 API Endpoints

### Core Endpoints
- `POST /listen` - Transcribe audio using ElevenLabs STT
- `POST /talk` - Generate response (GPT-4o) + TTS audio
- `GET /state` - Get current emotion/phase state
- `GET /health` - Health check

### State Management
- Firebase Firestore: Real-time state synchronization
- Session-based: Each user has a unique session ID
- Emotion tracking: Persistent emotion history

---

## 🎤 STT Service (ElevenLabs Only)

### Architecture
- **Primary Service**: ElevenLabs STT API
- **No Fallbacks**: Single service architecture
- **Format Support**: webm, mp3, mp4, ogg
- **Latency**: ~1-2 seconds average

### Implementation
- File: `apps/api/src/services/elevenlabs-stt-only.ts`
- Endpoint: `POST /listen`
- Response: `{ text: string, duration: number }`

---

## 🧠 LLM Service (GPT-4o)

### Architecture
- **Model**: GPT-4o
- **Personality**: SamyBear child-friendly prompt
- **Emotion Context**: Dynamic prompt based on detected emotion
- **Max Tokens**: 400 (for detailed responses)
- **Temperature**: 1.0 (maximum personality)

### Implementation
- File: `apps/api/src/services/gpt.minimal.ts`
- System Prompt: Child-friendly, emotionally intelligent
- Emotion Guidance: 8 child-appropriate emotions

---

## 🗣️ TTS Service (ElevenLabs with Natural Disfluencies)

### Architecture
- **Primary Service**: ElevenLabs TTS API
- **Voice**: Samy Bear 4.0 (UgBBYS2sOqTuMpoF3BR0)
- **Natural Speech**: Automatic disfluency injection
- **Emotion-Based**: Disfluencies adapt to emotion

### Natural Disfluencies
- **Thinking Sounds**: "hmm...", "weeeell...", "ooooh!"
- **Laughter**: "*giggles*", "*chuckles*" (for happy/excited)
- **Pauses**: Natural breathing pauses
- **Emotion-Based**: Different disfluencies per emotion

### Implementation
- File: `apps/api/src/services/tts.ts` (standard TTS)
- File: `apps/api/src/services/tts-streaming.ts` (streaming TTS)
- File: `apps/api/src/services/tts-disfluencies.ts` (disfluency injection)

---

## 🔥 Firebase Integration

### Schema
```typescript
interface SessionState {
  phase: "idle" | "listening" | "thinking" | "speaking";
  emotion: "curious" | "happy" | "calm" | "sleepy" | "confused" | "excited" | "empathetic" | "sad";
  energy: number; // 0-1
  lang: "en" | "fr" | "ar";
  lastAudioUrl: string | null;
  updatedAt: number;
}
```

### Collections
- `sessions/{sessionId}` - Session state
- `sessions/{sessionId}/state` - Real-time state updates

### Real-Time Updates
- State changes broadcast to Firebase
- Frontend can subscribe to real-time updates
- Avatar integration ready

---

## 🎨 Frontend Architecture

### Components
- `page.tsx` - Main UI with horizontal dashboard layout
- `AgentDashboard.tsx` - Development dashboard (right panel)
- `STTRecorder.tsx` - Voice recording component
- `DebugPanel.tsx` - Debug tools (collapsible)

### State Management
- React hooks (`useState`, `useRef`)
- Real-time emotion state
- Performance metrics tracking
- Debug logs and timings

### UI Design
- Child-friendly color palette
- Horizontal layout (main + dashboard)
- Real-time emotion display
- Energy bar with playful labels
- Development dashboard for monitoring

---

## 🚀 Performance Optimization

### Pipeline Optimization
- **Parallel Processing**: GPT + Sentiment analysis run in parallel
- **Streaming TTS**: Audio chunks streamed as generated
- **Buffer Management**: Direct audio buffer processing (no file save)
- **Caching**: Firebase state caching

### Latency Targets
| Stage | Target | Actual |
|-------|--------|--------|
| STT | < 2000ms | ~1500ms |
| GPT | < 2500ms | ~2000ms |
| TTS | < 1500ms | ~1000ms |
| **Total** | **< 5000ms** | **~4500ms** |

---

## 🔒 Security & Safety

### Content Filtering
- Multi-layer safety checks
- Keyword-based filtering
- Theme-based blocking
- Automatic redirection for inappropriate content

### API Key Security
- Environment variables only
- Never exposed to frontend
- Server-side validation

---

## 📊 Monitoring & Debugging

### Development Dashboard
- Real-time logs
- Performance metrics
- Agent state monitoring
- Error tracking

### Logging
- Structured console logs
- Timing breakdowns
- Error tracking
- State transitions

---

## 🔮 Future Roadmap

### Planned Enhancements
- **WebSocket STT**: Real-time streaming transcription
- **Multilingual Support**: Expanded language detection
- **SamyLLM**: Fine-tuned model for SamyBear
- **Avatar Integration**: Unity/WebGL avatar support
- **Parental Controls**: Admin dashboard for content management

---

## 📚 Additional Resources

- [ElevenLabs API Docs](https://elevenlabs.io/docs)
- [OpenAI GPT-4o Docs](https://platform.openai.com/docs)
- [Firebase Firestore Docs](https://firebase.google.com/docs/firestore)
- [Next.js 16 Docs](https://nextjs.org/docs)

---

**SamyBear 4.0 - Built for curious children everywhere** 🐻✨
