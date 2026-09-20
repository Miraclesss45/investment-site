# Vercel Deployment Guide

## Overview

The MeridianVest project has been fully migrated from Netlify to Vercel. All Netlify references have been removed, and the three backend functions are now standalone Vercel API routes.

## What's Changed

### Removed
- `netlify/` directory (all Netlify functions)
- `netlify.toml` configuration
- `_netlify-adapter.js` (no longer needed)

### Added
- `api/admin-data.js` - Admin operations and audit logging
- `api/create-referral-reward.js` - Referral reward verification
- `api/send-deposit-telegram.js` - Deposit notifications
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

In Vercel project dashboard, add these variables for `Production`, `Preview`, and `Development`:

```
VITE_FIREBASE_API_KEY=<value>
VITE_FIREBASE_AUTH_DOMAIN=<value>
VITE_FIREBASE_PROJECT_ID=<value>
VITE_FIREBASE_STORAGE_BUCKET=<value>
VITE_FIREBASE_MESSAGING_SENDER_ID=<value>
VITE_FIREBASE_APP_ID=<value>
FIREBASE_SERVICE_ACCOUNT=<complete JSON object>
TELEGRAM_BOT_TOKEN=<value>
TELEGRAM_CHAT_ID=<value>
```

**Important:** Store `FIREBASE_SERVICE_ACCOUNT` as the complete JSON string from your Firebase service account key.

### 3. Deploy to Production

```bash
vercel --prod
```

### 4. Verify Deployment

- Visit your Vercel URL
- Test `/admin/login` route
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

All three backend functions are available at:

- `POST /api/admin-data` - Admin dashboard data and operations
- `POST /api/create-referral-reward` - Referral reward processing
- `POST /api/send-deposit-telegram` - Deposit notification sending

Each route requires:
- Valid Firebase ID token in `Authorization: Bearer <token>` header
- Appropriate admin claims for admin routes
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
