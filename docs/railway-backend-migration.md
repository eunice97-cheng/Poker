# Railway Backend Migration

This repo is ready to move the realtime backend from Render to Railway while keeping the frontend on Vercel.

## Railway service setup

1. In Railway, create a new project.
2. Choose `Deploy from GitHub repo`.
3. Select `eunice97-cheng/Poker`.
4. Open the new service settings.
5. Set `Root Directory` to `/server`.
6. Set `Config as Code` path to `/server/railway.toml`.
7. In `Networking -> Public Networking`, click `Generate Domain`.

Railway documents both the root-directory monorepo flow and the note that config-as-code does not follow the root directory path:
https://docs.railway.com/guides/monorepo

## Railway variables

Add these variables to the Railway backend service:

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
CLIENT_URL=
CORS_ALLOWED_ORIGINS=
SOCKET_ALLOWED_ORIGINS=
NEXT_PUBLIC_SITE_URL=
ACTION_TIMEOUT_SECONDS=30
BETWEEN_HAND_DELAY_SECONDS=5
KOFI_ENABLED=false
KOFI_VERIFICATION_TOKEN=
RESEND_API_KEY=
EMAIL_FROM=
```

Notes:

- `CLIENT_URL`, `CORS_ALLOWED_ORIGINS`, and `SOCKET_ALLOWED_ORIGINS` should contain your Vercel domain.
- If you use both a Vercel default domain and a custom domain, include both as a comma-separated list.
- Railway provides `PORT` automatically, so do not hardcode it unless needed.

Railway variable behavior:
https://docs.railway.com/develop/variables

Railway public domain setup:
https://docs.railway.com/reference/public-domains

## Vercel variables

Once Railway gives you a public backend domain, update these Vercel environment variables:

```env
NEXT_PUBLIC_SOCKET_URL=https://your-service.up.railway.app
NEXT_PUBLIC_SERVER_URL=https://your-service.up.railway.app
```

Redeploy Vercel after updating them.

## Supabase

Make sure the abandoned-table recovery migration is applied:

`supabase/migrations/011_recover_abandoned_tables.sql`

Without this migration, server restarts will still drop rooms without refund recovery.

## Smoke test checklist

1. Open `https://<railway-domain>/health` and confirm JSON is returned.
2. Load the Vercel lobby and confirm the status changes from `Pouring the room...` to `Bar open`.
3. Create a table.
4. Join the table from a second account.
5. Leave and rejoin once to confirm Socket.IO and CORS are healthy.
6. Remove the old Render URL from Vercel after Railway is confirmed stable.
