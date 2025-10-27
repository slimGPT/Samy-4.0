# Environment Variables Setup

This file explains how to set up your environment variables for the Samy prototype.

## Root `.env` File (for API server)

Create a `.env` file in the **root directory** with the following variables:

```env
OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
NEXT_PUBLIC_FIREBASE_API_KEY=your_web_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

## Web App `.env.local` File

Create a `.env.local` file in the **apps/web** directory with:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_web_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Getting Firebase Credentials

### For Web App (Client SDK):
1. Go to Firebase Console → Project Settings
2. Under "Your apps", select your web app or create one
3. Copy the config values (apiKey, authDomain, etc.)

### For API Server (Admin SDK):
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file
4. Extract values:
   - `project_id` → FIREBASE_PROJECT_ID
   - `client_email` → FIREBASE_CLIENT_EMAIL
   - `private_key` → FIREBASE_PRIVATE_KEY (keep the quotes and newlines)

## Important Notes

- The `FIREBASE_PRIVATE_KEY` must include the quotes and `\n` characters as shown
- Never commit `.env` or `.env.local` files to version control
- The `NEXT_PUBLIC_` prefix exposes variables to the browser (client-side)
- Variables without the prefix are server-side only

