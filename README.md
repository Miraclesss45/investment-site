# MeridianVest

A Vite + React + Tailwind application for the MeridianVest member portal and public marketing site.

## Local development

```bash
npm install
npm run dev:vercel
```

In a second terminal, run the Vite frontend:

```bash
npm run dev
```

Vite forwards every `/api/*` request to the local Vercel Functions server on
port 5174. Install the Vercel CLI (`npm install -g vercel`) if it is not
available, and link the project when prompted. Running only `npm run dev`
serves the frontend without the server endpoints.

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
   ```

   Use values from **Firebase Console -> Project settings -> Your apps -> Web app** for the `VITE_*` variables.

   `FIREBASE_SERVICE_ACCOUNT` must contain the complete Firebase Admin service account JSON (download from **Project settings -> Service accounts -> Generate new private key**). Never commit this file; use Vercel's encrypted environment settings only.

   For local development, use `FIREBASE_SERVICE_ACCOUNT_FILE` instead and
   point it to the downloaded JSON file outside the repository. Do not add the
   file to Git or use a `VITE_` prefix.

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

Review `firestore.rules` before deploying to production. Members can access
only their own records. Username mappings are reserved and looked up by trusted
server code; member sign-in uses the account email.

## Deposit email notifications

Deposit requests are saved to Firestore. The member receives one pending
confirmation email at the verified email address on their Firebase Authentication
account (Gmail addresses are supported). After an administrator confirms the
offline payment and credits the deposit, the member receives one success email.
Both use the server-only email settings listed in `DEPLOYMENT.md`. A failed
pending email can be retried from the confirmation page; administrators can retry
failed deposit emails from the Deposits list and withdrawal success emails from
withdrawal details without repeating a payout.

## Support ticket email notifications

Support requests are saved under the member's Firestore profile, then the
server sends a branded notification to the support inbox and a confirmation to
the member's verified account email. Both use the email settings in
`DEPLOYMENT.md`. If email delivery fails, the saved ticket remains available
in the admin portal and the member can retry the notifications from the support
form.

## Admin access

The app uses the standard Firebase sign-in flow for both members and administrators.
After authentication, the app checks the signed-in user's trusted Firebase role
information and redirects admins to the private `/control-room` console while
members go to `/dashboard`. Public `/admin/*` paths intentionally render the
normal not-found page.
Set admin authorization in Firebase Auth custom claims or by a trusted backend
process; never store admin credentials in frontend code or browser environment
variables.

Administrators can use **Add funds** in the control room to issue a withdrawable
account credit. Previous admin-issued credits that were labeled promotional
are also withdrawable. Referral rewards remain non-withdrawable. Credited funds
are available for withdrawal even while committed to an active investment.
An early withdrawal reduces the principal returned at maturity by the amount
paid out; the package's original profit calculation is unchanged.

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

The protected admin API validates recent authentication and a positive amount,
and uses a Firestore transaction to credit the member's
available balance, create a completed ledger entry, mark the request settled,
and write an audit record. A deterministic settlement record prevents the same
deposit request from being credited twice.

Administrators may delete only pending, rejected, or cancelled request
documents. Deletion requires recent authentication, a password, and the exact
`DELETE DEPOSIT` confirmation. Approved, completed, settled, or
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
