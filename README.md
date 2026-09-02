# Daiki AI Passport Frontend

Next.js 16 frontend for Daiki AI Passport. The production target is Vercel.

## Architecture

```text
Browser
  -> Vercel / Next.js
  -> encrypted HttpOnly OIDC session
  -> Next.js /api BFF routes
  -> daiki-ai-passport-backend
  -> APISIX / Keycloak / LiteLLM / private Local LLM
```

The frontend never stores LiteLLM master keys, Keycloak admin credentials, database credentials or Local LLM credentials.

## Features
- Keycloak/OIDC login and logout.
- AES-GCM encrypted HttpOnly session cookie.
- User dashboard, chat, models, usage and settings.
- Streaming chat through the Go backend.
- Admin dashboard with users, virtual API keys and platform health.
- Role-aware navigation for `ai-admin`.
- Responsive dark UI.

## Environment
Copy `.env.example` and set the real public backend/identity endpoints. For Vercel, `DAIKI_BACKEND_URL` and `OIDC_ISSUER` must be reachable from Vercel over HTTPS; private service credentials remain on `match-infra` only.

## Validation

```bash
pnpm install
pnpm lint
pnpm build
```
