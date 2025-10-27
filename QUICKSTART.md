# 🚀 Quick Start Guide

Get Samy prototype running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Firebase project created

## Step 1: Install Dependencies

```bash
pnpm install
```

## Step 2: Configure Environment

### Get Firebase Credentials

1. **Go to Firebase Console** → Your Project → Project Settings
2. **For Web (Client SDK)**:
   - Under "Your apps" → Add web app or select existing
   - Copy the config object values

3. **For API (Admin SDK)**:
   - Go to Service Accounts tab
   - Click "Generate New Private Key"
   - Download the JSON file

### Create Root `.env`

Create `.env` in the root directory:

```env
# API Keys (optional for now)
OPENAI_API_KEY=
ELEVENLABS_API_KEY=

# Firebase Admin SDK (from service account JSON)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Firebase Client SDK (from web app config)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### Create `apps/web/.env.local`

Create `.env.local` in the `apps/web` directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Step 3: Deploy Firebase Rules

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (if not done already)
firebase init
# Select: Firestore, Storage
# Use existing files: firestore.rules, storage.rules

# Deploy
firebase deploy --only firestore:rules,storage
```

## Step 4: Run the Apps

### Terminal 1 - API Server

```bash
pnpm --filter @apps/api dev
```

Should see: `🚀 API server running on http://localhost:3001`

### Terminal 2 - Web App

```bash
pnpm --filter @apps/web dev
```

Should see: `✓ Ready on http://localhost:3000`

## Step 5: Test It!

1. Open http://localhost:3000
2. Keep the default session ID: `demo-session`
3. Click **Start Listening**
4. Click **Simulate Speaking** button
5. Watch the UI update in real-time! 🎉

## Troubleshooting

### "Module not found: @packages/shared"
```bash
pnpm install
```

### "Firebase: Error (auth/invalid-api-key)"
- Check that you copied the correct API key
- Make sure `.env.local` exists in `apps/web`
- Restart the dev server after changing env files

### "Permission denied" in Firestore
```bash
firebase deploy --only firestore:rules
```

### Port already in use
```bash
# API (change port)
PORT=3002 pnpm --filter @apps/api dev

# Web (change port)
PORT=3001 pnpm --filter @apps/web dev
```

## What's Next?

- ✅ The UI updates in real-time when you click simulation buttons
- ✅ Try creating multiple sessions with different IDs
- ✅ Open the Firestore console to see data being written
- ✅ Test the API with curl:

```bash
curl -X POST http://localhost:3001/state \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"demo-session","patch":{"phase":"thinking","emotion":"curious","energy":0.9}}'
```

Need more details? Check the full [README.md](./README.md)!

