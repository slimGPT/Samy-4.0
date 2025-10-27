# 🐻 Samy Prototype

A minimal prototype for a 3D avatar system with real-time state management using Firebase Firestore.

## Architecture

This is a **monorepo** with three main packages:

```
/apps/web       → Next.js 14 + TypeScript + Tailwind (Frontend)
/apps/api       → Node.js Express + TypeScript (Backend API)
/packages/shared → Shared types and utilities
```

## Features

- 🔥 **Real-time State Sync**: Live Firestore subscriptions update the UI instantly
- 🎭 **Avatar State Management**: Track phase, emotion, energy, and language
- 📊 **Session Metrics**: Monitor turns, questions, duration, and curiosity index
- 🎤 **Simulation Controls**: Test state updates with simple buttons
- 🌐 **REST API**: Update state via POST /state endpoint

## Prerequisites

- **Node.js** 18+ (preferably 20+)
- **pnpm** (install via `npm install -g pnpm`)
- **Firebase Project** with Firestore and Storage enabled

## Quick Start

### 1. Clone and Install

```bash
# Install dependencies for all packages
pnpm install
```

### 2. Set Up Environment Variables

#### Root `.env` (for API server)
Create a `.env` file in the **root directory**:

```env
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
NEXT_PUBLIC_FIREBASE_API_KEY=your_web_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

#### Web App `.env.local`
Create a `.env.local` file in **apps/web**:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_web_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_API_URL=http://localhost:3001
```

📖 See [ENV_SETUP.md](./ENV_SETUP.md) for detailed instructions on getting Firebase credentials.

### 3. Deploy Firestore Security Rules

```bash
# Install Firebase CLI if you haven't
npm install -g firebase-tools

# Login
firebase login

# Initialize (select Firestore and Storage)
firebase init

# Deploy rules
firebase deploy --only firestore:rules,storage
```

The `firestore.rules` and `storage.rules` files are already configured for development (open until 2030). **Replace with proper authentication in production!**

### 4. Run the Development Servers

Open **two terminal windows**:

#### Terminal 1 - API Server
```bash
pnpm --filter @apps/api dev
```
Runs on http://localhost:3001

#### Terminal 2 - Web App
```bash
pnpm --filter @apps/web dev
```
Runs on http://localhost:3000

## Usage

1. Open http://localhost:3000 in your browser
2. Enter a session ID (default: `demo-session`)
3. Click **Start Listening** to subscribe to real-time updates
4. Use the simulation buttons to test:
   - **Simulate Speaking**: Sets phase to "speaking", emotion to "happy", energy to 0.7
   - **Simulate Idle**: Sets phase to "idle", emotion to "calm", energy to 0.3
5. Watch the UI update in real-time!

## API Endpoints

### `POST /state`
Update session state in Firestore.

**Request:**
```json
{
  "sessionId": "demo-session",
  "patch": {
    "phase": "speaking",
    "emotion": "happy",
    "energy": 0.7,
    "lang": "en"
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "demo-session"
}
```

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890
}
```

## Firestore Data Model

### Collection: `sessions/{sessionId}`

```typescript
{
  state: {
    phase: "idle" | "listening" | "thinking" | "speaking",
    emotion: "happy" | "calm" | "curious" | "sleepy",
    energy: number,         // 0..1
    lastAudioUrl: string | null,
    lang: "ar" | "fr" | "en",
    updatedAt: number       // timestamp
  },
  metrics: {
    turns: number,
    whQuestions: number,
    sessionMinutes: number,
    ci: number              // Curiosity Index
  }
}
```

## Project Structure

```
.
├── apps/
│   ├── api/                    # Express API server
│   │   ├── src/
│   │   │   ├── app.ts         # Express app with routes
│   │   │   ├── index.ts       # Server entry point
│   │   │   └── firebaseAdmin.ts # Firebase Admin SDK setup
│   │   └── package.json
│   └── web/                    # Next.js web app
│       ├── app/
│       │   ├── page.tsx       # Main UI page
│       │   ├── layout.tsx     # Root layout
│       │   └── globals.css    # Tailwind styles
│       ├── lib/
│       │   └── firebase.ts    # Firebase client SDK setup
│       └── package.json
├── packages/
│   └── shared/                 # Shared utilities
│       ├── src/
│       │   ├── types.ts       # TypeScript types
│       │   ├── curiosity.ts   # Curiosity Index calculation
│       │   └── index.ts
│       └── package.json
├── firestore.rules             # Firestore security rules
├── storage.rules               # Storage security rules
├── pnpm-workspace.yaml         # pnpm workspace config
└── package.json                # Root package.json
```

## Development Commands

```bash
# Install all dependencies
pnpm install

# Run API server only
pnpm --filter @apps/api dev

# Run web app only
pnpm --filter @apps/web dev

# Build all packages
pnpm -r build

# Build specific package
pnpm --filter @apps/web build
```

## Editing Firebase Config

### Web App (Client SDK)
Edit `apps/web/lib/firebase.ts` to customize Firebase initialization.

### API Server (Admin SDK)
Edit `apps/api/src/firebaseAdmin.ts` to customize Admin SDK setup.

## Next Steps

This is a minimal prototype. To make it production-ready:

1. ✅ **Authentication**: Add Firebase Auth and secure Firestore rules
2. ✅ **Error Handling**: Add better error boundaries and retry logic
3. ✅ **Validation**: Add request validation (e.g., using Zod)
4. ✅ **Testing**: Add unit and integration tests
5. ✅ **3D Avatar**: Integrate a 3D rendering engine (Three.js, Ready Player Me, etc.)
6. ✅ **Audio Streaming**: Implement ElevenLabs integration for TTS
7. ✅ **AI Integration**: Connect OpenAI for conversational logic
8. ✅ **Deployment**: Deploy to Vercel (web) and Cloud Run (API)

## Troubleshooting

### "Cannot find module '@packages/shared'"
Run `pnpm install` from the root directory to link workspace packages.

### "Firebase: Error (auth/invalid-api-key)"
Double-check your Firebase credentials in `.env` and `.env.local`.

### "CORS error" when calling API
Ensure the API server is running and CORS is enabled in `apps/api/src/app.ts`.

### Firestore permission errors
Deploy the security rules: `firebase deploy --only firestore:rules`

## License

MIT

---

Built with ❤️ for the Samy project

