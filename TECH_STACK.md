# 🛠️ Candy AI - Technology Stack

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
| **OpenAI** | GPT-4o-mini | Conversational AI |
| **ElevenLabs** | STT (scribe_v1) | Speech-to-Text |
| **ElevenLabs** | TTS (eleven_multilingual_v2) | Text-to-Speech |
| **Custom** | Sentiment Analysis | Emotion detection |

### Database & Backend
| Technology | Purpose |
|------------|---------|
| **Firebase Admin SDK** | Server-side Firebase access |
| **Firestore** | NoSQL database for sessions, users, emotions |
| **Firebase Auth** | User authentication (anonymous auth) |

---

## 🏗️ Architecture

### Monorepo Structure
```
Candy AI/
├── apps/
│   ├── api/          # Backend Express.js server
│   └── web/          # Frontend Next.js app
├── packages/
│   └── shared/       # Shared TypeScript types
└── scripts/          # Utility scripts
```

**Workspace Manager**: pnpm workspaces for efficient monorepo management

---

## 🔌 API Architecture

### REST Endpoints

#### 1. Health Check
```http
GET /health
Response: { status: "ok", mode: "full", timestamp: 1234567890 }
```

#### 2. Speech-to-Text
```http
POST /listen
Content-Type: multipart/form-data
Body: audio file (webm, mp3, mp4, ogg)
Response: { success: true, text: "transcribed text", duration: 800 }
```

#### 3. Talk (GPT + TTS)
```http
POST /talk
Content-Type: application/json
Body: { text: "user message", sessionId?: "optional-session-id" }
Response: {
  success: true,
  reply: "Candy's response",
  audioUrl: "/audio/candy-speech-123.mp3",
  emotion: "flirty",
  metrics: { gpt: 1200, tts: 700, total: 2500 }
}
```

#### 4. Static Audio Serving
```http
GET /audio/:filename
Response: MP3 audio file
```

### Mode System
Two operational modes controlled via `MINIMAL_MODE` environment variable:

| Mode | File | Features |
|------|------|----------|
| **Full** | `app.full.ts` | Firebase, Emotions, User Context, Sentiment Analysis |
| **Minimal** | `app.minimal.ts` | Core pipeline only (STT → GPT → TTS) for debugging |

---

## 🧠 AI Pipeline Architecture

### 1. Speech-to-Text (STT)
**Service**: `services/elevenlabs-stt.ts`

```typescript
Flow:
1. Receive audio file upload
2. Validate format and size
3. Save to temp/uploads/
4. Call ElevenLabs STT API (scribe_v1 model)
5. Parse transcription response
6. Delete temp file
7. Return text to client

Error Handling:
- Retry logic with exponential backoff (3 attempts)
- Timeout: 30 seconds
- Graceful failure with error messages
```

### 2. Sentiment Analysis
**Service**: `services/sentiment.ts`

```typescript
Flow:
1. Receive user text
2. Analyze for emotion keywords
3. Calculate emotion intensity
4. Determine energy level (0.0 - 1.0)
5. Return detected emotion and energy

Emotion Detection:
- Keyword matching
- Context analysis
- Energy calculation based on message intensity
```

### 3. GPT Conversation
**Service**: `services/gpt.minimal.ts`

```typescript
Flow:
1. Receive user message
2. Build conversation context
3. Call OpenAI GPT-4o-mini API
4. Stream or wait for complete response
5. Return Candy's reply

Configuration:
- Model: gpt-4o-mini
- Temperature: 0.7 (balanced creativity)
- Max tokens: 150
- System prompt: Girlfriend persona
```

### 4. Emotion Engine
**Service**: `services/emotionEngine.ts`

```typescript
Flow:
1. Receive conversation text and GPT response
2. Analyze emotional context
3. Determine emotion transition
4. Update Firebase session state
5. Return new emotion

Supported Emotions:
- flirty, playful, caring, curious, excited
- calm, sad, angry, bitchy, neutral
```

### 5. Text-to-Speech (TTS)
**Service**: `services/tts.ts`

```typescript
Flow:
1. Receive text and emotion
2. Get emotion-based voice settings
3. Call ElevenLabs TTS API (eleven_multilingual_v2)
4. Save audio to temp/audio/
5. Return audio URL

Voice Settings per Emotion:
- stability: 0.60 - 0.80
- similarityBoost: 0.75 - 0.90
- Voice ID: aEO01A4wXwd1O8GPgGlF (Arabella)
```

---

## 🔥 Firebase Architecture

### Firestore Collections

#### `/users`
```typescript
{
  userId: string;
  username: string;
  energyLevel: number;
  lastInteraction: Timestamp;
  createdAt: Timestamp;
}
```

#### `/sessions`
```typescript
{
  sessionId: string;
  userId: string;
  timestamp: Timestamp;
  dominantEmotion: string;
  duration: number;
  context: string[];  // Conversation history
  emotionScore: {
    [emotion: string]: number;
  };
  state: {
    phase: 'listening' | 'thinking' | 'speaking';
    emotion: string;
    energy: number;
    lastAudioUrl?: string;
    updatedAt: number;
  }
}
```

#### `/emotions`
```typescript
{
  emotionName: string;
  emoji: string;
  gradient: string;
  voiceSettings: {
    stability: number;
    similarityBoost: number;
  };
  description: string;
}
```

### Firebase Admin SDK Setup
**File**: `lib/firebaseAdmin.ts`

```typescript
Features:
- Environment variable validation
- Private key parsing (handles \n escaping)
- Graceful initialization with fallback
- Helper functions: getUser, updateUser, getAllEmotions, etc.
- Firestore and Storage access
```

---

## 🎨 Frontend Architecture

### Next.js App Structure
**File**: `apps/web/app/page.tsx`

```typescript
Components:
1. Main conversation interface
2. Emotional state monitor
3. Energy bar with animations
4. Push-to-talk microphone button
5. "Shut up" interrupt button
6. Performance metrics display

State Management:
- React useState for local state
- useRef for MediaRecorder and audio
- No external state library (intentionally simple)

Real-Time Updates:
- Emotion state from API responses
- Phase transitions (listening/thinking/speaking)
- Energy bar animations (1000ms smooth transitions)
```

### CSS Architecture
**File**: `apps/web/app/globals.css`

```css
Tailwind Configuration:
- Custom animations (shimmer, pulse, bounce)
- Dark mode support
- Gradient utilities
- Shadow/glow effects

Custom Animations:
@keyframes shimmer { /* Sliding highlight */ }
.animate-shimmer { animation: shimmer 2s infinite; }
```

### Audio Recording
```typescript
MediaRecorder API:
- Format: audio/webm (preferred) with fallbacks
- Recording interval: 100ms chunks
- Minimum duration: 800ms
- Automatic cleanup on stop

Supported Formats:
1. audio/webm;codecs=opus (preferred)
2. audio/mp4
3. audio/mpeg
4. audio/webm
5. audio/ogg;codecs=opus
```

---

## 🔐 Security Architecture

### API Security
- **CORS**: Configurable origins
- **Rate Limiting**: (Recommended for production)
- **File Upload Validation**: Size and type checks
- **Temp File Cleanup**: Automatic deletion after processing

### Firebase Security
**File**: `firestore.rules`
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User documents
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
    
    // Session documents
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null;
    }
    
    // Emotion metadata (public read)
    match /emotions/{emotionId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

### Environment Variables
**Sensitive Data**:
```env
OPENAI_API_KEY=sk-...           # OpenAI API access
ELEVENLABS_API_KEY=sk_...       # ElevenLabs API access
FIREBASE_PRIVATE_KEY="..."      # Firebase Admin private key
```

**Security Best Practices**:
- Never commit `.env` files
- Use `.env.example` for templates
- Rotate keys regularly
- Use Firebase environment-specific projects

---

## 🚀 Deployment Architecture

### Development
```bash
# API Server
cd apps/api
pnpm dev        # tsx watch src/index.ts (hot reload)

# Web Server
cd apps/web
pnpm dev        # next dev (Turbopack)
```

### Production (Recommended)

#### Option 1: Vercel (Frontend) + Railway/Render (Backend)
```yaml
Frontend (Vercel):
  - Auto-deploy from Git
  - Environment variables in dashboard
  - Next.js optimized hosting

Backend (Railway/Render):
  - Node.js 22+
  - Build: pnpm install && pnpm build
  - Start: pnpm start
  - Environment variables via dashboard
```

#### Option 2: Docker Containers
```dockerfile
# API Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY apps/api/package*.json ./
RUN pnpm install --frozen-lockfile
COPY apps/api .
CMD ["pnpm", "start"]

# Web Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY apps/web/package*.json ./
RUN pnpm install --frozen-lockfile
COPY apps/web .
RUN pnpm build
CMD ["pnpm", "start"]
```

#### Option 3: Monorepo Deploy (Single Server)
```bash
# Build both apps
pnpm install
cd apps/api && pnpm build
cd ../web && pnpm build

# Start with PM2
pm2 start apps/api/dist/index.js --name candy-api
pm2 start apps/web/.next --name candy-web
```

---

## 📊 Performance Optimization

### Backend Optimizations
- **Lazy Loading**: Services initialized on first use
- **Connection Pooling**: Reuse OpenAI/ElevenLabs connections
- **Temp File Cleanup**: Automatic garbage collection
- **Retry Logic**: Exponential backoff for API failures

### Frontend Optimizations
- **Turbopack**: Next.js 16 with fast refresh
- **Code Splitting**: Automatic by Next.js
- **Image Optimization**: (Not used yet, ready for avatars)
- **CSS Animations**: Hardware-accelerated transforms

### API Optimizations
- **Streaming**: Potential for GPT streaming (not yet implemented)
- **Caching**: Firebase queries cached
- **Compression**: Express compression middleware (recommended)

---

## 🧪 Testing Stack

### Current Testing
```bash
# Manual testing endpoints
scripts/test-api.sh              # API health check
scripts/test-elevenlabs.js       # ElevenLabs API test
scripts/test-openai-key.js       # OpenAI API test
scripts/test-emotion-engine.js   # Emotion transitions test
```

### Recommended Testing (Future)
- **Jest**: Unit tests
- **Playwright**: E2E tests
- **Supertest**: API endpoint tests
- **React Testing Library**: Component tests

---

## 📦 Dependencies

### API Dependencies
```json
{
  "express": "^4.21.2",
  "firebase-admin": "^12.x",
  "openai": "^4.x",
  "form-data": "^4.x",
  "multer": "^1.x",
  "dotenv": "^16.x",
  "cors": "^2.x"
}
```

### Web Dependencies
```json
{
  "next": "16.0.0",
  "react": "^19.x",
  "react-dom": "^19.x",
  "typescript": "^5.x",
  "tailwindcss": "^3.x"
}
```

---

## 🔄 CI/CD (Recommended)

### GitHub Actions Pipeline
```yaml
name: Deploy Candy AI
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - Checkout code
      - Install pnpm
      - Run tests
      - Lint check

  deploy-api:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - Deploy to Railway/Render
      - Run health check

  deploy-web:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - Deploy to Vercel
      - Smoke test
```

---

## 🛠️ Development Tools

### Required
- **Node.js**: 22.16.0+
- **pnpm**: 9.x (faster than npm)
- **TypeScript**: 5.x
- **Git**: Version control

### Recommended
- **VSCode**: With TypeScript, Tailwind CSS, and Prettier extensions
- **Postman/Insomnia**: API testing
- **Firebase Console**: Database management
- **Vercel CLI**: Preview deployments

---

## 🔮 Technology Roadmap

### Near-Term
- [ ] WebSocket integration for avatar communication
- [ ] Redis caching for session state
- [ ] GraphQL API layer
- [ ] Rate limiting middleware

### Long-Term
- [ ] Kubernetes deployment
- [ ] Multi-region CDN for audio files
- [ ] Edge computing for STT/TTS
- [ ] Machine learning for emotion prediction

---

## 📚 Additional Resources

### Documentation Links
- [OpenAI API Docs](https://platform.openai.com/docs)
- [ElevenLabs API Docs](https://elevenlabs.io/docs)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Next.js 16 Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Community
- GitHub Issues for bugs
- Discussions for feature requests
- Discord (coming soon) for community

---

**Built with modern, production-ready technologies for scalability and performance.**

