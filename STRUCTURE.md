# 📂 Samy Prototype - Complete File Structure

```
samy-prototype/
│
├── 📦 apps/                          # Application packages
│   ├── 🌐 api/                       # Backend API (Express + TypeScript)
│   │   ├── src/
│   │   │   ├── app.ts                # Express routes & middleware
│   │   │   ├── index.ts              # Server entry point
│   │   │   └── firebaseAdmin.ts      # Firebase Admin SDK setup
│   │   ├── package.json              # API dependencies
│   │   ├── tsconfig.json             # TypeScript config
│   │   └── .gitignore
│   │
│   └── 🎨 web/                       # Frontend (Next.js 14 + Tailwind)
│       ├── app/
│       │   ├── page.tsx              # Main UI page (session viewer)
│       │   ├── layout.tsx            # Root layout component
│       │   └── globals.css           # Global Tailwind styles
│       ├── lib/
│       │   └── firebase.ts           # Firebase Client SDK
│       ├── package.json              # Web dependencies
│       ├── tsconfig.json             # TypeScript config
│       ├── next.config.js            # Next.js configuration
│       ├── tailwind.config.ts        # Tailwind configuration
│       ├── postcss.config.js         # PostCSS config
│       └── .gitignore
│
├── 📦 packages/                      # Shared packages
│   └── 🔧 shared/                    # Shared utilities & types
│       ├── src/
│       │   ├── types.ts              # TypeScript type definitions
│       │   ├── curiosity.ts          # Curiosity Index calculation
│       │   └── index.ts              # Package exports
│       ├── package.json              # Shared dependencies
│       └── tsconfig.json             # TypeScript config
│
├── 🔥 Firebase Configuration
│   ├── firebase.json                 # Firebase CLI config
│   ├── firestore.rules               # Firestore security rules
│   ├── firestore.indexes.json        # Firestore index definitions
│   └── storage.rules                 # Storage security rules
│
├── 🛠️ scripts/                       # Utility scripts
│   ├── init-demo-session.js          # Initialize demo Firestore data
│   ├── test-api.sh                   # API testing script (Bash)
│   └── package.json                  # Script dependencies
│
├── 📚 Documentation
│   ├── README.md                     # Main project documentation
│   ├── QUICKSTART.md                 # 5-minute setup guide
│   ├── ENV_SETUP.md                  # Environment variable guide
│   ├── ARCHITECTURE.md               # System architecture & design
│   ├── PROJECT_SUMMARY.md            # Complete feature checklist
│   └── STRUCTURE.md                  # This file!
│
├── ⚙️ Configuration Files
│   ├── package.json                  # Root package.json (monorepo)
│   ├── pnpm-workspace.yaml           # pnpm workspace config
│   └── .gitignore                    # Git ignore rules
│
└── 🔐 Environment Files (create these)
    ├── .env                          # Root env (for API)
    └── apps/web/.env.local           # Web env (for Next.js)
```

## 📝 Key File Descriptions

### Backend Files (apps/api)

| File | Purpose |
|------|---------|
| `src/app.ts` | Express app with routes (`POST /state`, `GET /health`) |
| `src/index.ts` | Server startup (listens on port 3001) |
| `src/firebaseAdmin.ts` | Firebase Admin SDK initialization |

### Frontend Files (apps/web)

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main UI: session viewer with real-time updates |
| `app/layout.tsx` | Root layout with metadata and fonts |
| `app/globals.css` | Tailwind CSS imports and custom styles |
| `lib/firebase.ts` | Firebase Client SDK initialization |

### Shared Package (packages/shared)

| File | Purpose |
|------|---------|
| `src/types.ts` | Shared TypeScript interfaces (SessionState, etc.) |
| `src/curiosity.ts` | Curiosity Index calculation utility |
| `src/index.ts` | Package entry point (exports all modules) |

### Firebase Configuration

| File | Purpose |
|------|---------|
| `firestore.rules` | Security rules for Firestore (dev-friendly) |
| `storage.rules` | Security rules for Storage (dev-friendly) |
| `firebase.json` | Firebase CLI deployment config |
| `firestore.indexes.json` | Firestore index definitions |

### Scripts

| File | Purpose |
|------|---------|
| `init-demo-session.js` | Creates a demo session in Firestore |
| `test-api.sh` | Bash script to test API endpoints |

## 🎯 Entry Points

### Development
```bash
# API Server Entry Point
apps/api/src/index.ts → Express server on port 3001

# Web App Entry Point  
apps/web/app/page.tsx → Next.js page on port 3000
```

### Build Output
```bash
# API Build
apps/api/dist/index.js → Compiled JavaScript

# Web Build
apps/web/.next/ → Next.js production build
```

## 🔗 Import Paths

### From Web App
```typescript
// Shared package
import { SessionState } from '@packages/shared';

// Firebase client
import { db } from '@/lib/firebase';

// Next.js
import { useEffect } from 'react';
```

### From API
```typescript
// Shared package
import type { SessionState } from '@packages/shared';

// Firebase Admin
import { db } from './firebaseAdmin';

// Express
import express from 'express';
```

## 📦 Package Dependencies

### Root
- `typescript` - Shared TypeScript version

### apps/api
- `express` - Web framework
- `cors` - CORS middleware
- `firebase-admin` - Firebase Admin SDK
- `dotenv` - Environment variables
- `tsx` - TypeScript execution (dev)

### apps/web
- `next` - Next.js framework
- `react` - React library
- `firebase` - Firebase Client SDK
- `tailwindcss` - CSS framework
- `typescript` - TypeScript compiler

### packages/shared
- `typescript` - TypeScript compiler
- `@types/node` - Node.js types

## 🌳 Workspace Structure

```
pnpm workspace
├── @apps/api           # apps/api
├── @apps/web           # apps/web
└── @packages/shared    # packages/shared
```

Each package can be targeted individually:
```bash
pnpm --filter @apps/api dev
pnpm --filter @apps/web dev
pnpm --filter @packages/shared build
```

## 🗂️ Data Flow Paths

```
User Input (web)
    ↓
apps/web/app/page.tsx
    ↓
apps/web/lib/firebase.ts
    ↓
Firebase Firestore
    ↓
Real-time Subscription
    ↓
apps/web/app/page.tsx (React state update)
    ↓
UI Re-render
```

```
External API Call
    ↓
apps/api/src/app.ts (POST /state)
    ↓
apps/api/src/firebaseAdmin.ts
    ↓
Firebase Firestore
    ↓
Real-time Subscription
    ↓
apps/web/app/page.tsx
    ↓
UI Update
```

## 📊 File Count Summary

- **Source Files**: 15 (.ts, .tsx, .js)
- **Config Files**: 9 (.json, .yaml, .rules)
- **Documentation**: 6 (.md)
- **Total**: 30 files

## 💾 Approximate Sizes

- **apps/api**: ~200 lines of code
- **apps/web**: ~350 lines of code
- **packages/shared**: ~80 lines of code
- **Documentation**: ~2,000 lines
- **Total LOC**: ~2,630 lines

## 🎨 Tech Stack by Layer

### Frontend Layer
- Next.js 14 (App Router)
- React 18
- TypeScript 5
- Tailwind CSS 3
- Firebase SDK 10

### Backend Layer
- Node.js 20+
- Express 4
- TypeScript 5
- Firebase Admin SDK 12

### Data Layer
- Firebase Firestore (NoSQL)
- Firebase Storage (files)

### Build Tools
- pnpm 8 (package manager)
- Next.js compiler
- TypeScript compiler
- PostCSS (CSS processing)

---

**Last Updated**: 2025
**Version**: 1.0.0
**Status**: Production Ready 🚀

