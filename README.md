# MeridianVest

A Vite + React + Tailwind application for the MeridianVest member portal and public marketing site.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in the Firebase web app values before testing login locally. The values come from **Firebase Console -> Project settings -> Your apps -> Web app**.

The Firebase web configuration is safe to expose in a browser bundle. Keep server credentials, service account JSON files, and private API keys out of this repository.

## Deploy to Netlify

1. Push the repository to GitHub. `.env` is ignored, so it will not be committed.
2. In Netlify, choose **Add new project -> Import an existing project -> GitHub**, then select this repository.
3. Netlify will use `netlify.toml` automatically. The build command is `npm run build` and the publish directory is `dist`.
4. In **Site configuration -> Environment variables**, add these variables for the deploy context:

   ```text
   VITE_FIREBASE_API_KEY
   VITE_FIREBASE_AUTH_DOMAIN
   VITE_FIREBASE_PROJECT_ID
   VITE_FIREBASE_STORAGE_BUCKET
   VITE_FIREBASE_MESSAGING_SENDER_ID
   VITE_FIREBASE_APP_ID
   ```

   Use the matching values from the Firebase web app configuration. If the Supabase-backed parts of the project are used, also add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

5. Trigger a new deploy after adding or changing environment variables. Vite injects `VITE_*` values at build time.
6. In Firebase Console, open **Authentication -> Settings -> Authorized domains** and add the Netlify domain, for example `your-site.netlify.app`. Add the custom domain too if one is configured.
7. Under **Authentication -> Sign-in method**, enable **Email/Password**. New accounts must verify their email before the app allows dashboard access.

The Netlify redirect in `netlify.toml` keeps React Router routes such as `/login` and `/dashboard` working after a browser refresh.

## Deploy Firestore rules

The repository includes `firebase.json` and `.firebaserc`, so the rules can be deployed with the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

Review `firestore.rules` before deploying to production. The rules allow each signed-in member to access only their own records, while username lookup is intentionally public for email-or-username login.

## Production build

```bash
npm run build
```
