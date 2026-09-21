# MeridianVest

A Vite + React + Tailwind application for the MeridianVest member portal and public marketing site.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in the Firebase web app values before testing login locally. The values come from **Firebase Console -> Project settings -> Your apps -> Web app**.

The Firebase web configuration is safe to expose in a browser bundle. Keep server credentials, service account JSON files, and private API keys out of this repository.

To run the protected admin API locally with real Firebase users, also set
`FIREBASE_SERVICE_ACCOUNT_FILE` in `.env.local` to the absolute path of a
Firebase Admin service-account JSON file stored outside this repository. This
variable is server-only and is used by `npm run dev:vercel`; it is never sent
to the browser. Plain `npm run dev` serves only the frontend and cannot execute
admin mutations.

## Deploy to Vercel

This project runs on Vercel without requiring Firebase Cloud Functions. The React app is built to `dist`, and the server endpoints in `api/` are Vercel Functions that use the Firebase Admin SDK.

1. Push the repository to GitHub. `.env` is ignored.
2. Create a Vercel account or log in at https://vercel.com.
3. Import the GitHub repository: **Add New -> Project -> Import Git Repository**.
4. In **Environment Variables**, add these variables:

   ```text
   VITE_FIREBASE_API_KEY
   VITE_FIREBASE_AUTH_DOMAIN
   VITE_FIREBASE_PROJECT_ID
   VITE_FIREBASE_STORAGE_BUCKET
   VITE_FIREBASE_MESSAGING_SENDER_ID
   VITE_FIREBASE_APP_ID
   FIREBASE_SERVICE_ACCOUNT
   FIREBASE_SERVICE_ACCOUNT_FILE
   TELEGRAM_BOT_TOKEN
   TELEGRAM_CHAT_ID
   ```

   Use values from **Firebase Console -> Project settings -> Your apps -> Web app** for the `VITE_*` variables.

   `FIREBASE_SERVICE_ACCOUNT` must contain the complete Firebase Admin service account JSON (download from **Project settings -> Service accounts -> Generate new private key**). Never commit this file; use Vercel's encrypted environment settings only.

   For local development, use `FIREBASE_SERVICE_ACCOUNT_FILE` instead and
   point it to the downloaded JSON file outside the repository. Do not add the
   file to Git or use a `VITE_` prefix.

   Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` if deposit notifications are enabled.

5. Click **Deploy**. Vercel's default build command (`npm run build`) and output directory (`dist`) work automatically.
6. After the first deploy, in Firebase Console open **Authentication -> Settings -> Authorized domains** and add the Vercel domain (e.g. `your-app.vercel.app`) and custom domain.
7. Under **Authentication -> Sign-in method**, enable **Email/Password**. New accounts must verify their email before the app allows dashboard access.
8. To attach the custom domain `meridianvests.com`:
   - Add it in Vercel's **Project settings -> Domains**.
   - Update your domain registrar's DNS records with the values Vercel provides.
   - Wait for DNS propagation (typically a few minutes to a few hours).

## Deploy Firestore rules

The repository includes `firebase.json` and `.firebaserc`, so the rules can be deployed with the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

Review `firestore.rules` before deploying to production. The rules allow each signed-in member to access only their own records, while username lookup is intentionally public for email-or-username login.

## Deposit notifications

Deposit requests are saved to Firestore and the Vercel Function `/api/send-deposit-telegram`
sends a formatted notification to a private Telegram chat. Add these private
environment variables in Vercel:

```text
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

Create a bot with Telegram's `@BotFather`, send the bot a message, and obtain
the chat ID from Telegram's `getUpdates` API. The notification contains the
depositor name, email, bundle, chain, amount, and request ID. Never expose the
bot token in frontend code.

## Admin access

The app uses the standard Firebase sign-in flow for both members and administrators.
After authentication, the app checks the signed-in user's trusted Firebase role
information and redirects admins to the private `/control-room` console while
members go to `/dashboard`. Public `/admin/*` paths intentionally render the
normal not-found page.
Set admin authorization in Firebase Auth custom claims or by a trusted backend
process; never store admin credentials in frontend code or browser environment
variables.

### Granting your first admin access

This is a one-time local setup command. It uses the Firebase service-account JSON
from a file on your computer and does not expose that file to the browser.

1. In Firebase Console, open **Project settings -> Service accounts -> Generate new private key**.
2. Save the downloaded JSON outside the project folder.
3. Make sure the admin user already exists under **Authentication -> Users**.
4. From the project folder, run this command in PowerShell:

   ```powershell
   npm run set-admin
   ```

   When prompted, paste the path to the downloaded JSON file and enter the email
   of the Firebase Authentication user.

5. Open `/login`, sign in with that Firebase account, and the app will redirect you
   to `/control-room`. Sign out and sign in again if the account was already logged in.

Never commit the service-account JSON, paste it into `.env`, or use a `VITE_`
prefix for it. The `firebase-admin` package is only used by this local command;
it must not be imported by browser code.

### Offline deposit settlement

Deposit settlement is an administrator-controlled offline workflow. The member
submits a request, the administrator independently confirms that payment was
received outside the website, and then uses **Credit offline payment** in the
admin Deposits page to enter the amount received in USD. This action does not
process a payment, contact a payment provider, or verify a blockchain
transaction.

The protected admin API validates recent authentication, requires a reason and
a positive amount, and uses a Firestore transaction to credit the member's
available balance, create a completed ledger entry, mark the request settled,
and write an audit record. A deterministic settlement record prevents the same
deposit request from being credited twice.

Administrators may delete only pending, rejected, or cancelled request
documents. Deletion requires recent authentication, a password, a reason, and
the exact `DELETE DEPOSIT` confirmation. Approved, completed, settled, or
credited requests are locked and cannot be deleted. Deletion does not change
the member profile, balance, or transaction history and is recorded in the
audit history. Deposit rows show the requesting member's stored username and
email for identification.

## Referral rewards

Referral rewards are created by the trusted Vercel Function `/api/create-referral-reward`,
not by the browser. Configure the private `FIREBASE_SERVICE_ACCOUNT` Vercel
environment variable with the service-account JSON contents. The function verifies
the signed-in user's token, rejects self-referrals, and uses a transaction so a
referred account can only produce one reward.

If a service-account key is ever exposed, immediately generate a replacement
key in Firebase Console, update `FIREBASE_SERVICE_ACCOUNT` in Vercel, wait for
the automatic redeploy, and delete the exposed key from **Project settings -> Service accounts**.

## Production build

```bash
npm run build
```
