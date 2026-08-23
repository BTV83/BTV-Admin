# BTV Admin

Administration panel for the BTV mobile app. Separate repository, separate
deployment, separate credentials.

## Security model

The panel does **not** use Supabase Auth. Admin identities live in `admin_users`
and have no relationship to `auth.users`, so a token issued to the mobile app can
never authenticate an admin action — the two are different systems that happen to
share a database.

| | Mobile app | Admin panel |
|---|---|---|
| Identity | `auth.users` | `admin_users` |
| Credentials | email + password, OTP by email | argon2id password + TOTP authenticator |
| Database access | anon key, RLS enforced | `service_role`, server-side only |
| Session | Supabase JWT in device storage | opaque token, httpOnly cookie, revocable |

Consequences worth keeping in mind:

- **`service_role` bypasses every RLS policy.** It is referenced in exactly one
  file, `src/lib/db.ts`, which imports `server-only` so that any client-component
  import becomes a build error rather than a runtime leak.
- **`requireAdmin()` is the authorisation boundary**, not the middleware. Next.js
  has shipped several middleware-bypass advisories, so `src/middleware.ts` only
  does a cosmetic redirect and checks nothing but the presence of a cookie.
  Every page and server action calls `requireAdmin()` itself.
- **There is no signup route.** The first account comes from `npm run admin:create`;
  after that, superadmins invite from inside the panel.
- **TOTP is mandatory.** An account without an enrolled authenticator is sent to
  enrolment and can reach no data until it completes.

## Setup

Requires Node ≥ 22 (`nvm use 22` — the system default on this machine is v10).

```bash
cp .env.example .env.local     # then fill in the three values
npm install
npm run admin:create           # creates the first superadmin
npm run dev
```

`ADMIN_TOTP_ENC_KEY` encrypts TOTP secrets at rest, so a database dump is not by
itself a second-factor bypass. Generate it with `openssl rand -base64 32`.
Rotating it invalidates every enrolled authenticator.

The database migration lives in the **BTV app repo**, at the end of
`supabase/supabase.sql`, dated 2026-07-28. Apply it before first run.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run admin:create` | Create an admin account from the terminal |

## Roles

| Role | Permissions |
|---|---|
| `superadmin` | Everything, including the team and the audit log |
| `moderator` | Moderation, users, cities |
| `support` | Read-only |

Defined in `src/lib/types.ts` and enforced by `requireAdmin(permission)`.
