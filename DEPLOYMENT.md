# Vercel Deployment Guide

## Overview

The MeridianVest project has been fully migrated from Netlify to Vercel. All Netlify references have been removed, and the backend functions are standalone Vercel API routes.

## What's Changed

### Removed
- `netlify/` directory (all Netlify functions)
- `netlify.toml` configuration
- `_netlify-adapter.js` (no longer needed)

### Added
- `api/admin-data.js` - Admin operations and audit logging
- `api/create-referral-reward.js` - Referral reward verification
- `api/send-withdrawal-email.js` and `api/withdrawal-mailer.js` - Branded withdrawal email delivery over Truehost SMTP
- `vercel.json` - Vercel build and function configuration

### Updated
- `README.md` - Now contains Vercel deployment instructions instead of Netlify
- Frontend API calls already use `/api/*` paths (compatible with Vercel)

## Deployment Steps

### 1. Create or Link Vercel Project

```bash
vercel
```

This will prompt you to:
- Authorize with Vercel
- Create a new project or link an existing one
- Confirm project settings

### 2. Configure Environment Variables

In the Truehost hosting panel, create a mailbox on your domain. Open that mailbox's
**Connect Devices**, **Set Up Mail Client**, or similarly named configuration page
and use the displayed outgoing SMTP hostname, port, and encryption setting. Truehost
may show different values for different mail hosting plans, so use the values shown
for your specific mailbox rather than copying a generic server name.

In Vercel project dashboard, add these variables for `Production`, `Preview`, and `Development`:

```
VITE_FIREBASE_API_KEY=<value>
VITE_FIREBASE_AUTH_DOMAIN=<value>
VITE_FIREBASE_PROJECT_ID=<value>
VITE_FIREBASE_STORAGE_BUCKET=<value>
VITE_FIREBASE_MESSAGING_SENDER_ID=<value>
VITE_FIREBASE_APP_ID=<value>
FIREBASE_SERVICE_ACCOUNT=<complete JSON object>
CRON_SECRET=<random secret with at least 16 characters>
SMTP_HOST=mail.meridianvests.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=notifications@meridianvests.com
SMTP_PASS=<password for the notifications mailbox>
MAIL_FROM=MeridianVests <notifications@meridianvests.com>
EMAIL_PROVIDER=smtp
```

**Important:** Store `FIREBASE_SERVICE_ACCOUNT` as the complete JSON string from your Firebase service account key.
SMTP variables are server-only: do not prefix them with `VITE_`, place them in frontend code, or commit their real values. `MAIL_FROM` should use the Truehost mailbox/domain that is authorized to send. After changing Vercel variables, redeploy for them to take effect.

Alternatively, use an HTTP email provider:

```
EMAIL_PROVIDER=resend
RESEND_API_KEY=<server-only API key>
MAIL_FROM=MeridianVests <notifications@meridianvests.com>
```

Verify the sender domain and `MAIL_FROM` with the provider first. Keep the key
server-only and do not add a `VITE_` prefix. When `EMAIL_PROVIDER=resend` is set,
email is sent through the provider's HTTPS API and the SMTP settings are ignored.

### Support chat prerequisites

The customer chat uses a top-level `supportConversations/{customer_uid}` document
and its `messages` and temporary `typing` subcollections. Existing
`users/{uid}/supportTickets` documents and the support request form remain
separate from chat conversations. Support form submissions are saved to
Firestore and their branded notification and confirmation emails are sent by
`/api/send-support-email` through the configured SMTP account. Email delivery
failures are recorded on the ticket and can be retried from the form.
Deploy `firestore.rules` before using the chat:

```bash
firebase deploy --only firestore:rules
```

In Firebase Console, enable **Authentication → Sign-in method → Anonymous** for
the Firebase project used by the site. This is required for visitors who are not
signed in; anonymous credentials use browser-session persistence and are
authorized by the same owner-specific Firestore rules as member sessions.
Administrators must continue to sign in with their verified account and
existing administrator custom claims.

Resolved or closed conversations can be archived from the admin support inbox.
Archiving retains all messages and writes immutable archive/restore events; it
does not delete conversation data. Archived conversations are available through
the Archived filter and can be restored. Customers can still read an archived
conversation, but must contact support or ask an administrator to restore it
before sending another message.

The chat does not use Firebase Storage, Cloud Functions, SMTP, or email
notifications. Attachments and email notifications are not part of this
implementation. Typing state is stored separately from messages and cleared
when the composer becomes idle. Do not deploy a permissive Firestore rule to
work around a missing permission; diagnose and deploy the rules above instead.

`vercel env add` saves a variable to the Vercel project; it does not update an
already-running local `vercel dev` process or redeploy an existing Production
deployment. For local API testing, make the Development variables available in
`.env.local` (the file Vercel Dev loads), then restart `vercel dev`. If
`.env.local` already exists, do not overwrite it with `vercel env pull
.env.local --yes`; pull to another ignored file and merge the required keys
without removing existing Firebase settings. Create a new Production deployment
after changing Production variables. `vercel env ls` confirms that variable
names are configured, but does not verify that Truehost accepts SMTP connections
from the runtime.

Deploy the checked-in Firestore indexes when releasing this admin list update:

```bash
firebase deploy --only firestore:indexes
```

To find the SMTP settings in Truehost:

1. Sign in to the Truehost client area or hosting control panel for your domain.
2. Open **Email Accounts/Mailboxes**, create the sender mailbox, or select an existing one.
3. Choose **Connect Devices**, **Set Up Mail Client**, or **Configure Mail Client**.
4. Copy its outgoing mail server, SMTP port, and SSL/TLS or STARTTLS setting into Vercel. Use the full mailbox address for `SMTP_USER`.
5. Set `SMTP_SECURE=true` when the displayed port uses implicit SSL/TLS (commonly port 465); set it to `false` when the displayed setting is STARTTLS (commonly port 587). Follow the settings shown for your account.

### 3. Deploy to Production

```bash
vercel --prod
```

### 4. Verify Deployment

- Visit your Vercel URL
- Test `/control-room/login` for administrator sign-in
- Confirm `/admin`, `/admin/login`, and other `/admin/*` paths render Not Found
- Test API routes: `/api/admin-data` (should return 401 if not authenticated)

### 5. Attach Custom Domain

1. In Vercel dashboard: **Project Settings → Domains**
2. Add `meridianvests.com`
3. Vercel will provide DNS records to configure
4. Update your domain registrar's DNS records
5. Wait for DNS propagation (typically 5-30 minutes)

### 6. Update Firebase Configuration

In Firebase Console:
1. **Authentication → Settings → Authorized domains**
2. Add your Vercel URL (e.g., `your-project.vercel.app`)
3. Add your custom domain `meridianvests.com`

## API Routes

Backend functions are available at:

- `POST /api/admin-data` - Admin dashboard data and operations
- `GET /api/packages` - Public catalog fields shared by the public and member package pages
- `GET /api/admin-data?resource=admins` - Read-only current administrator directory
- `POST /api/create-referral-reward` - Referral reward processing
- `POST /api/send-deposit-email` - Sends the member's pending deposit confirmation
- `POST /api/send-withdrawal-email` - Sends the authenticated member's withdrawal-processing email
- `POST /api/send-support-email` - Sends support-team and member confirmation emails for a saved ticket
- `GET /api/accrue-investments` - Server-side investment accrual and maturity settlement; Vercel Cron runs daily at 1:00 a.m. Lagos time and authenticates with `CRON_SECRET`

The member receives one pending deposit email after the request is saved and one
success email after an administrator credits the deposit. Both go to the verified
email on the member's Firebase Authentication account; Gmail addresses are supported.
Deposit and withdrawal messages use the configured email sender. Both withdrawal
emails include the USD request amount and selected payout asset but omit wallet
addresses. A saved wallet is optional; when present, it is kept as an immutable
request snapshot and must match the member's saved wallet for the selected asset.
Withdrawal payouts are arranged offline by administrators.

Pending and on-hold requests appear in the decision queue on the admin Withdrawals
page, where administrators can reject a request or approve it after sending the
payout through their offline process. A wallet address is not required. Approval is the final in-app action: it
atomically completes the withdrawal, updates the member balance and ledger once,
records the audit event, and attempts the branded success email. Administrators must
not approve before sending the payout. The action requires recent password
reauthentication and a confirmation that the payout was already sent. If email
delivery fails, the completed withdrawal remains recorded and the failed notification
is saved on the request. Administrators can inspect the safe failure category and
retry only the success email from withdrawal details; the retry cannot change the
completed payout or ledger.

Administrators can delete unpaid withdrawal requests from that page. Deletion
requires recent password reauthentication and typing `DELETE WITHDRAWAL`; no
separate reason is required. Paid or settled withdrawals are protected and
deletions are written to the audit log. Reviewing a withdrawal opens its
dedicated details page, including the member username and email, with the same
withdrawal approval and rejection actions. Deposit-request and user deletions use the same password-confirmation
flow with their respective confirmation phrases.

Each route requires:
- Valid Firebase ID token in `Authorization: Bearer <token>` header
- Appropriate admin claims for admin routes

Passwords remain managed by Firebase Authentication. Administrators change their own
password from the Admins tab in the control room; plaintext passwords are never sent
to the admin API or written to audit records.
- Valid request body with required fields

## Service Account Security

The `FIREBASE_SERVICE_ACCOUNT` environment variable contains sensitive credentials:

1. Never commit it to version control
2. Only add it to Vercel's encrypted environment settings
3. If exposed:
   - Generate a new key in Firebase Console
   - Update the Vercel environment variable
   - Delete the old key

## Troubleshooting

### 401 Unauthorized on API Routes

- Verify the Firebase ID token is valid and fresh
- Check that the token is sent in the `Authorization: Bearer <token>` header
- For admin routes, verify the user has `admin: true` custom claim

### Domain Not Working

- Check DNS propagation status on whatsmydns.net
- Verify Vercel has processed the domain addition
- Check Firebase Authorized Domains includes your domain

### Build Failures

- Check Vercel build logs for errors
- Ensure all environment variables are properly configured
- Verify `vite build` runs locally without errors

## Support

For issues with:
- **Vercel deployment**: Check Vercel dashboard logs
- **Firebase configuration**: See Firebase Console
- **Code issues**: Check local `npm run build` and `npm run lint` output
