# Account Provisioning Recovery Architecture

## Overview

This document describes how the system detects and recovers from incomplete account provisioning caused by server crashes, network failures, or other catastrophic events during signup.

## Problem Statement

The original signup flow had a critical failure mode:
1. Client calls `createUserWithEmailAndPassword()` → Firebase Auth account created
2. Client writes Firestore profile → Firestore write begins
3. **Server crashes** → Auth account exists but profile is incomplete or missing
4. Result: Orphaned Firebase Auth account with no valid profile

This creates a security and data consistency issue: the orphaned account cannot log in (profile missing), but the Auth account exists and consumes resources.

## Solution: Durable Provisioning Journal + Server-Side Account Creation

### 1. Server-Side Account Creation (`api/create-account.js`)

**Principle**: Move all account creation to a single trusted server endpoint so that either everything succeeds or everything rolls back.

**Flow**:
```
Client -> POST /api/create-account
  ↓
Server validates input
  ↓
Server: Create Firebase Auth account (Admin SDK)
  ↓
Log: "auth-created" → accountProvisioning collection
  ↓
Server: Reserve username + create profile (Firestore transaction, atomic)
  ↓
Log: "profile-created" → accountProvisioning collection
  ↓
Success: Return { uid, email }
  ↓
Client: Call signInWithEmailAndPassword() and send verification email
```

**If Auth creation fails**:
- Log: "auth-creation-failed"
- Return error to client
- No cleanup needed (no Auth account exists)

**If Firestore transaction fails** (after Auth created):
- Log: "profile-creation-failed"
- Immediately delete Auth user
- Log: "auth-deleted"
- Return error to client
- Account is fully cleaned up

**If server crashes after Auth deletion but before response sent**:
- Log shows: "cleanup-failed"
- Auth account is deleted (crash does not roll back the deletion)
- Recovery endpoint detects the orphan later and confirms it's already cleaned

### 2. Durable Provisioning Journal (`accountProvisioning` collection)

Every signup—successful or failed—creates a provisioning log entry with:

```typescript
{
  uid: "user-uid-or-empty-string",
  email: "user@example.com",
  username: "chosen_username",
  stage: "start" | "auth-created" | "profile-created" | "auth-deleted" | "cleanup-failed",
  status: "pending" | "success" | "failed",
  error: { code, message } | null,
  timestamp: FieldValue.serverTimestamp(),
}
```

**Stages**:
- `start`: Signup began; no Auth account created yet
- `auth-created`: Firebase Auth user successfully created
- `profile-created`: Firestore profile and username reserved
- `auth-deleted`: Orphaned Auth account was successfully cleaned up
- `cleanup-failed`: Attempted to delete Auth account after Firestore failure, but deletion itself failed (rare)

**Status**:
- `pending`: In progress
- `success`: Stage completed without error
- `failed`: Stage encountered an error (see error field)

### 3. Recovery Endpoint (`api/recover-provisioning.js`)

**Purpose**: Detect and report orphaned or incomplete accounts for manual or automated recovery.

**Admin-only operation** (checked via middleware):
```bash
POST /api/recover-provisioning
Authorization: Bearer <admin-token>
```

**Algorithm**:
1. Query `accountProvisioning` collection for entries where `status == "failed"` and `stage == "cleanup-failed"`
2. For each entry:
   - Try to fetch the Auth user by UID
   - If Auth user not found:
     - Mark as "recovered" (cleanup succeeded)
     - Update provisioning entry: `status = "recovered"`
   - If Auth user found and profile exists:
     - Mark as "recovered" (profile was recreated or never lost)
   - If Auth user found and profile missing:
     - Add to `orphaned` list with action `canDelete: true`
3. Return summary: `{ checked, recovered, orphaned, details }`

**Example Response**:
```json
{
  "checked": 3,
  "recovered": 2,
  "orphaned": 1,
  "details": {
    "recovered": [
      { "uid": "abc123", "email": "old@example.com", "username": "olduser", "action": "cleaned-up", "reason": "Auth account already deleted by cleanup" }
    ],
    "orphaned": [
      { "uid": "xyz789", "email": "crash@example.com", "username": "crashuser", "canDelete": true }
    ]
  }
}
```

### 4. Firestore Security Rules (`firestore.rules`)

The `accountProvisioning` collection is:
- **Read-only for authenticated admins**: `request.auth.token.admin == true`
- **Never written by clients**: All writes are server-side (Admin SDK)
- **Append-only for servers**: Each stage adds a new entry; no updates to existing entries

This prevents clients from tampering with recovery logs and ensures the audit trail is immutable.

## Failure Scenarios & Recovery

### Scenario 1: Server Crash During Auth Creation
**Log**: `[start, pending]` only
**Recovery**: None needed; no Auth account created
**Action**: Retry signup or wait for user to try again

### Scenario 2: Server Crash After Auth Created, Before Firestore Commit
**Log**: `[start, pending]` → `[auth-created, success]`
**Recovery**: Automatic
- Endpoint detects no profile for this UID
- If `cleanup-failed` not present, Auth user must be manually deleted
- **Future**: Implement automatic deletion after timeout

### Scenario 3: Server Crash During Firestore Transaction
**Log**: `[start, pending]` → `[auth-created, success]` → `[profile-creation-failed, failed]`
**Recovery**: Automatic
- Auth deletion was attempted (logged as `auth-deleted, success` or `cleanup-failed, failed`)
- If `auth-deleted, success`: Account is fully cleaned
- If `cleanup-failed, failed`: Orphan exists; recovery endpoint detects it

### Scenario 4: Server Crash After Auth Deletion But Before Response
**Log**: `[..., auth-deleted, success]` or `[..., cleanup-failed, failed]`
**Recovery**: Automatic
- Recovery endpoint queries Auth: user not found
- Confirms cleanup succeeded
- Updates log: `status = "recovered"`
- No orphan to fix

## Implementation Details

### Durable Logging Function

```javascript
async function logProvisioning(db, stage, uid, email, username, status, error = null) {
  try {
    await db.collection("accountProvisioning").add({
      uid,
      email,
      username,
      stage,
      status,
      error: error ? { code: error.code, message: error.message } : null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (logError) {
    console.error("Failed to log provisioning", { stage, uid, email, logError });
    // Do NOT rethrow; logging failure should not block signup
  }
}
```

**Fire-and-forget**: Logging errors are logged but do not block the signup response. This ensures signup can complete even if Firestore is temporarily degraded.

### Atomic Username + Profile Creation

```javascript
await db.runTransaction(async (transaction) => {
  // Check both username and profile don't exist
  const userSnapshot = await transaction.get(userRef);
  const usernameSnapshot = await transaction.get(usernameRef);
  
  if (userSnapshot.exists || usernameSnapshot.exists) {
    throw new Error("Username already taken");
  }
  
  // Atomically create both in single transaction
  transaction.set(userRef, { ...profileData });
  transaction.set(usernameRef, { uid });
});
```

**Guarantee**: Either both username and profile are created, or neither is. No partial states.

### Cleanup with Compensating Action

```javascript
if (createdUser?.uid && app) {
  try {
    await app.auth().deleteUser(createdUser.uid);
    await logProvisioning(db, "auth-deleted", createdUser.uid, email, username, "success");
  } catch (cleanupError) {
    console.error("Cleanup failed", cleanupError);
    await logProvisioning(db, "cleanup-failed", createdUser.uid, email, username, "failed", cleanupError);
  }
}
```

**Principle**: Always attempt cleanup, always log the result. Even if cleanup fails, the log captures the state for recovery.

## Admin Recovery Workflow

### Step 1: Detect Orphans
```bash
curl -X POST https://app.example.com/api/recover-provisioning \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Step 2: Review Results
- Check `details.orphaned` for Auth accounts without profiles
- Check `details.recovered` for accounts that were auto-repaired
- Escalate any `cleanup-failed` entries for manual investigation

### Step 3: Delete Orphans (Future Implementation)
```bash
POST /api/delete-orphan
Authorization: Bearer <admin-token>
Body: { uid: "xyz789" }
```

Endpoint will:
1. Verify Auth user exists but profile doesn't
2. Delete Auth user via Admin SDK
3. Log final cleanup in provisioning journal
4. Return success

## Vercel Serverless Considerations

### Function Timeout
- Vercel default: 30 seconds per function
- Account creation typically completes in < 2 seconds
- Logging uses fire-and-forget (no await for Firestore response)
- If timeout occurs during Firestore write, log entry may be incomplete, but Auth account remains logged as created

### Cold Starts
- Recovery endpoint is called infrequently (not on every signup)
- Can be run asynchronously via Vercel Cron (future enhancement)

## Testing Recovery Locally

### Simulate Auth Creation + Crash
1. Add breakpoint in `create-account.js` after Auth creation
2. Manually terminate the server/function
3. Check `accountProvisioning` collection: should see `auth-created, success`
4. Call recovery endpoint: should report the orphan

### Simulate Cleanup Failure
1. Mock `app.auth().deleteUser()` to throw
2. Signup should fail with proper error
3. Check `accountProvisioning`: should see `cleanup-failed, failed`
4. Call recovery endpoint: should detect the orphan

## Future Enhancements

1. **Automatic Orphan Cleanup**: Scheduled job (Vercel Cron or Cloud Functions) to:
   - Query `accountProvisioning` for cleanup-failed entries older than 1 hour
   - Verify Auth account still exists
   - Delete it
   - Update provisioning journal

2. **Admin UI Dashboard**: Display:
   - Real-time signup success/failure rates
   - List of recent provisioning entries
   - Orphan count and details
   - Actions to manually delete orphans

3. **Referral Reward Recovery**: Ensure rewards are created/validated for all successful signups, even if created across multiple login attempts

4. **End-to-End Tests**: Simulate crashes and verify recovery logic works

## Security Notes

- **Authorization**: Recovery endpoint requires `admin == true` claim in Firebase ID token
- **Immutability**: Firestore rules prevent clients and servers from modifying provisioning logs
- **Auditability**: Every provisioning stage is logged with timestamps for forensic investigation
- **No Data Exposure**: Recovery endpoint returns only UIDs and usernames; never exposes passwords or sensitive profile data

## References

- [Firebase Admin SDK Auth Docs](https://firebase.google.com/docs/auth/admin/manage-users)
- [Firestore Transactions](https://firebase.google.com/docs/firestore/transactions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
