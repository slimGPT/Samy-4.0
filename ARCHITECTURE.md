# 🏗️ Samy Prototype Architecture

## Overview

Samy is a minimal prototype for a real-time 3D avatar system with state management. The architecture follows a **monorepo pattern** with clear separation between frontend, backend, and shared code.

## Tech Stack

### Frontend (`/apps/web`)
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks + Firestore realtime subscriptions
- **Database Client**: Firebase SDK (Firestore)

### Backend (`/apps/api`)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: Firebase Admin SDK (Firestore)
- **CORS**: Enabled for cross-origin requests

### Shared (`/packages/shared`)
- **Purpose**: Shared types and utilities
- **Exports**:
  - TypeScript types (Phase, Emotion, Language, SessionState, etc.)
  - Curiosity Index calculation utility

## Data Flow

```
┌─────────────────┐
│   Web Browser   │
│  (apps/web)     │
└────────┬────────┘
         │
         │ 1. User clicks "Simulate Speaking"
         │
         ▼
┌─────────────────┐
│   Firestore     │  ◄────── 2. Direct write from client
│   (sessions)    │
└────────┬────────┘
         │
         │ 3. Real-time subscription
         │
         ▼
┌─────────────────┐
│   UI Updates    │
│  (React State)  │
└─────────────────┘


Alternative flow via API:

┌─────────────────┐
│  External App   │
└────────┬────────┘
         │
         │ 1. POST /state
         │
         ▼
┌─────────────────┐
│   API Server    │
│  (apps/api)     │
└────────┬────────┘
         │
         │ 2. Write to Firestore
         │
         ▼
┌─────────────────┐
│   Firestore     │
│   (sessions)    │
└────────┬────────┘
         │
         │ 3. Real-time subscription
         │
         ▼
┌─────────────────┐
│   Web Browser   │
│   UI Updates    │
└─────────────────┘
```

## Database Schema

### Firestore Collection: `sessions`

```
sessions/
  {sessionId}/
    state: {
      phase: string          // "idle" | "listening" | "thinking" | "speaking"
      emotion: string        // "happy" | "calm" | "curious" | "sleepy"
      energy: number         // 0.0 to 1.0
      lastAudioUrl: string?  // URL to audio file in Firebase Storage
      lang: string           // "ar" | "fr" | "en"
      updatedAt: number      // Unix timestamp
    }
    metrics: {
      turns: number          // Total conversation turns
      whQuestions: number    // Count of wh-questions asked
      sessionMinutes: number // Duration in minutes
      ci: number            // Curiosity Index (0-100)
    }
```

## Key Components

### 1. Web App (`apps/web/app/page.tsx`)

**Features:**
- Session ID input
- Real-time Firestore subscription
- State visualization (phase, emotion, energy)
- Simulation buttons
- Audio playback support
- Metrics dashboard

**Key Functions:**
- `useEffect` hook for Firestore subscription
- `handleSimulate` for testing state updates
- Real-time UI updates via `setState`

### 2. Firebase Client (`apps/web/lib/firebase.ts`)

**Purpose:**
- Initialize Firebase SDK with client credentials
- Export `db` (Firestore) and `storage` instances
- Uses `NEXT_PUBLIC_*` environment variables (client-safe)

### 3. API Server (`apps/api/src/app.ts`)

**Endpoints:**
- `POST /state` - Update session state
  - Accepts `sessionId` and `patch` (partial state)
  - Merges patch into existing document
  - Auto-updates `updatedAt` timestamp
- `GET /health` - Health check

**Features:**
- CORS enabled for all origins (dev mode)
- JSON body parsing
- Error handling with proper status codes

### 4. Firebase Admin (`apps/api/src/firebaseAdmin.ts`)

**Purpose:**
- Initialize Firebase Admin SDK with service account
- Server-side Firestore access
- Full read/write permissions
- Used by API endpoints

### 5. Shared Types (`packages/shared/src/types.ts`)

**Exports:**
- `Phase` - Union type for avatar states
- `Emotion` - Union type for emotions
- `Language` - Union type for supported languages
- `SessionState` - Complete state interface
- `SessionMetrics` - Metrics interface
- `SessionDocument` - Full document structure

### 6. Curiosity Index (`packages/shared/src/curiosity.ts`)

**Formula:**
```typescript
ci = (turnsPerMinute * 0.3 + questionRatio * 0.7) * 100
```

**Inputs:**
- `turns` - Total conversation turns
- `whQuestions` - Count of wh-questions
- `sessionMinutes` - Session duration

**Output:**
- Score from 0 to 100
- Higher = more engaged/curious user

## Security Model

### Development Rules (Current)
```javascript
// firestore.rules
allow read, write: if request.time < timestamp.date(2030, 1, 1);
```

⚠️ **Warning**: Open to all users until 2030. For dev/testing only!

### Production Rules (Recommended)
```javascript
match /sessions/{sessionId} {
  // Only authenticated users
  allow read: if request.auth != null;
  
  // Only owner can write
  allow write: if request.auth != null 
    && request.auth.uid == resource.data.ownerId;
}
```

## Environment Variables

### Web App (Client-side)
```env
NEXT_PUBLIC_FIREBASE_API_KEY     # Firebase Web API Key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN # Auth domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID  # Project ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET # Storage bucket
NEXT_PUBLIC_FIREBASE_APP_ID      # App ID
NEXT_PUBLIC_API_URL              # API server URL
```

### API Server (Server-side)
```env
FIREBASE_PROJECT_ID      # Project ID
FIREBASE_CLIENT_EMAIL    # Service account email
FIREBASE_PRIVATE_KEY     # Service account private key
OPENAI_API_KEY          # (Optional) For future AI integration
ELEVENLABS_API_KEY      # (Optional) For future TTS
```

## Deployment Strategy

### Web App → Vercel
```bash
cd apps/web
vercel deploy
```

### API Server → Google Cloud Run
```bash
cd apps/api
gcloud run deploy samy-api \
  --source . \
  --platform managed \
  --region us-central1
```

### Firebase Rules
```bash
firebase deploy --only firestore:rules,storage
```

## Extension Points

### 1. Add 3D Avatar
- Integrate Three.js or Ready Player Me
- Map `emotion` and `phase` to avatar animations
- Sync `energy` with avatar activity level

### 2. Add Speech Recognition
- Use Web Speech API or Deepgram
- Update `phase` to "listening" when active
- Increment `turns` on each exchange

### 3. Add AI Conversation
- OpenAI API for generating responses
- Update `whQuestions` count based on user input
- Calculate and store `ci` after each turn

### 4. Add Text-to-Speech
- ElevenLabs or Google TTS
- Generate audio file
- Upload to Firebase Storage
- Update `lastAudioUrl` in state

### 5. Add Multi-language Support
- Detect user language
- Update `lang` field
- Use language-specific AI models

## Performance Considerations

### Firestore Reads/Writes
- Real-time subscriptions count as 1 read per change
- Use `merge: true` to avoid overwriting entire document
- Consider batching updates for high-frequency changes

### Cold Starts (API)
- Express server has ~1-2s cold start on Cloud Run
- Consider Cloud Run "min instances" for production
- Alternatively, use Firestore directly from client

### Bundle Size (Web)
- Firebase SDK adds ~200KB to bundle
- Tree-shaking helps reduce size
- Consider dynamic imports for heavy components

## Testing Strategy

### Manual Testing
```bash
# Run test script
./scripts/test-api.sh

# Initialize demo session
node scripts/init-demo-session.js
```

### Integration Testing
1. Start API server
2. Start web app
3. Open browser to localhost:3000
4. Click "Start Listening"
5. Click simulation buttons
6. Verify real-time updates

### API Testing
```bash
curl -X POST http://localhost:3001/state \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","patch":{"phase":"speaking"}}'
```

## Troubleshooting

### Issue: State not updating in real-time
- Check Firestore rules are deployed
- Verify `sessionId` matches in both apps
- Check browser console for errors
- Ensure "Start Listening" is clicked

### Issue: CORS errors
- Verify API server is running on correct port
- Check `NEXT_PUBLIC_API_URL` in web app
- Ensure CORS is enabled in `apps/api/src/app.ts`

### Issue: Firebase permission denied
- Deploy Firestore rules: `firebase deploy --only firestore:rules`
- Check rules in Firebase Console
- Verify project ID matches in all configs

## Future Enhancements

1. **Authentication**: Firebase Auth integration
2. **Analytics**: Track usage and engagement
3. **Webhooks**: Notify external services on state changes
4. **Caching**: Redis for high-frequency state reads
5. **WebSockets**: For even lower latency updates
6. **Multi-session**: Support multiple concurrent sessions
7. **History**: Store state history for replay/analysis
8. **Admin Dashboard**: Manage sessions and view analytics

---

Built with ❤️ for the Samy project

