# Auth Flow — authorization and activation

> A profile is created **only** after a key is successfully activated.
> Before that the user is anonymous with a JWT, but has no record in `users`.

---

## Login steps

```
1. User opens the Mini App in Telegram
   │
   ▼
2. Telegram WebApp passes initData (HMAC signature)
   │
   ▼
3. Frontend → POST /auth/token { init_data }
   │
   ▼
4. API: verifies the initData HMAC signature
   API: checks whether the user exists in the DB  (does NOT create)
   API: issues a JWT (valid for 30 days)
   │
   ▼
5. Response:
   {
     token: "...",
     user_exists:      false,     ← NOT in the DB
     needs_activation: true,
     is_admin:         false
   }
   │
   ▼
6. Frontend, based on the needs_activation flag:
   • true  → shows the ActivationScreen (key entry)
   • false → shows the normal UI with tabs
```

## Key activation

```
7. User enters a key in the format XXXX-XXXX → presses «Activate»
   │
   ▼
8. Frontend → POST /auth/key { key } (with JWT)
   │
   ▼
9. API, in a single transaction:
   ├─ Locks the access_keys row (FOR UPDATE)
   ├─ Checks: used_at IS NULL AND expires_at > NOW()
   ├─ INSERT INTO users (id=TG_ID, internal_id=SERIAL, is_active=true)
   ├─ UPDATE access_keys SET used_by, used_at = NOW()
   └─ COMMIT
   │
   ▼
10. Response: { activated: true, internal_id: 0002 }
   Frontend reloads auth → needs_activation=false → main UI
```

## Special cases

### Admin (TG ID in `ADMIN_TG_IDS`)
- Pre-created via `SeedAdmin()` on the API's first start
- `user_exists=true, is_active=true` from the very beginning
- No key needed — goes straight to the main UI

### Existing user
- On reopening the Mini App → JWT is already in localStorage
- `/auth/token` is called again → sees the record → `needs_activation=false`
- Main UI with no delay

### Deleted account
- `DELETE /profile` → the row is removed from `users` (CASCADE)
- On the next login → no record → a new key is needed
- The old key is already used — it won't work

### Expired key (12h)
- The `cleanupKeys` cron removes unused expired keys every hour
- API returns `KEY_NOT_FOUND` or `KEY_EXPIRED`
- The user asks the admin for a new one

---

## What's in the JWT

```json
{
  "user_id":    804716840,
  "username":   "user666id",
  "first_name": "Max",
  "last_name":  "",
  "iat":        1748275200,
  "exp":        1750867200
}
```

`username`, `first_name`, `last_name` are needed so that `/auth/key` can create
the user record without re-checking initData.

---

## Protection against race conditions

When two Mini App instances with the same TG ID send parallel requests:
- `BEGIN TX`
- `SELECT ... FOR UPDATE` locks the key row
- The second call waits for the commit, then sees `used_at IS NOT NULL` → error
- Only one key-user binding happens atomically
