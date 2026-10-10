# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

`frontend/` and `backend/` are fresh scaffolds with no domain code yet. `bandvcard_v1.0.0_context.docx` (German) is the project context/spec for v1.0.0; the stack, flow and domain model sections below are derived from it. The whole stack runs via Docker Compose.

To re-read the spec: `pandoc -t markdown bandvcard_v1.0.0_context.docx` (falls back to `unzip -p bandvcard_v1.0.0_context.docx word/document.xml` if pandoc is missing).

## Commands

Frontend (run in `frontend/`, npm, Next.js 16 with App Router, TypeScript, Tailwind 4, sources in `src/`):

```bash
npm run dev      # dev server on http://localhost:3000
npm run build
npm run lint
```

No frontend test runner is configured yet. Read `frontend/AGENTS.md` before writing Next.js code: this Next.js version has breaking changes and ships its docs in `node_modules/next/dist/docs/`.

Backend (run in `backend/`, .NET 10, solution `Bandvcard.slnx`):

```bash
dotnet build
dotnet run --project Bandvcard.Api                  # http://localhost:5048
dotnet test                                         # xUnit, Bandvcard.Api.Tests
dotnet test --filter "FullyQualifiedName~TestName"  # single test
```

```bash
dotnet tool restore                                               # once, installs dotnet-ef
dotnet ef migrations add <Name> --project Bandvcard.Api
dotnet ef database update --project Bandvcard.Api                 # needs the compose postgres running
```

Backend structure (`Bandvcard.Api`):

- `Entities/`: `User`, `Contact`, `PostalCodeEntry` (the Ortsverzeichnis), in English; see the domain model below for the German spec terms.
- `Data/BandvcardDbContext.cs`: EF Core context for PostgreSQL. It fills the audit fields of every `IAuditable` entity in `SaveChanges`/`SaveChangesAsync` and blocks changes to `CreatedAt`/`CreatedBy` on update. New audited entities only need to implement `IAuditable`.
- `Data/ICurrentUser.cs`: supplies the name for `CreatedBy`/`UpdatedBy`. It reads the HTTP user and falls back to `"system"`, because authentication does not exist yet.
- Migrations live in `Migrations/` and are not applied automatically at startup.
- Passwords and secrets live only in the root `.env` (git-ignored; template `.env.example`), never in `appsettings*.json`. `Data/DotEnv.cs` loads that file for local `dotnet run`/`dotnet ef` and builds `ConnectionStrings:Default` from `POSTGRES_*` (host `localhost`, port `POSTGRES_PORT`) and the `Entra:*` settings from `ENTRA_*`. Real environment variables and explicit configuration win, which is how compose passes its own connection string.
- `Data/EdmModel.cs` defines the OData entity sets `Contacts`, `Users` and `PostalCodes`, served under `/api` (e.g. `/api/Contacts(<guid>)`, `/api/Users('a@b.c')`, `/api/$metadata`). JSON property names are lower camel case. A new entity needs an entry there plus a controller whose name matches the entity set.
- `Controllers/`: one `ODataController` per entity set with `Get`, `Get(key)`, `Post`, `Patch` (via `Delta<T>`) and `Delete`; no `Put`. Query options `$filter`, `$select`, `$orderby`, `$expand`, `$count` are enabled, `$top` is capped at 100 and collections page at 100. Keys cannot be changed, a contact's postal code must exist in `PostalCodes`, and a postal code in use cannot be deleted.
- Every endpoint requires a logged-in user (authorization fallback policy) except `/api/auth/login` and `/api/auth/logout`; there are no roles, so any logged-in user can do everything, including managing users.
- Tests use the EF Core in-memory provider, so they do not need a database. `ODataApiTests` runs the real HTTP pipeline through `WebApplicationFactory`; the in-memory provider does not enforce foreign keys, so those rules are checked in the controllers.

Full stack (run in the repo root; needs `.env`, copy from `.env.example`):

```bash
./scripts/generate-passwords.sh   # once: random POSTGRES_PASSWORD / MINIO_ROOT_PASSWORD in .env (--force replaces existing ones)
docker compose up -d --build   # postgres, minio, backend, frontend, nginx
docker compose logs -f backend
docker compose down            # add -v to also delete the postgres and minio volumes
```

- nginx is the only entry point for the apps: http://localhost:8080. `/api/` goes to the backend with the prefix kept (backend routes must be registered under `/api`), everything else goes to the frontend. TLS termination is not configured yet.
- Host ports are bound to 127.0.0.1 and set in `.env`: postgres 5433 (not 5432), MinIO API 9000, MinIO console 9001.
- The backend container gets `ConnectionStrings__Default` pointing at the `postgres` service. No MinIO settings are passed to any service.
- MinIO uses `cgr.dev/chainguard/minio:latest` because official `minio/minio` images are no longer published. Only `latest` is free there, so the version is not pinned.
- The frontend image relies on `output: "standalone"` in `frontend/next.config.ts`.

## What bandvcard is

A digital business card manager: the user photographs a business card, OCR runs in the frontend, and the extracted data is stored as a structured contact, with the original photo kept in object storage.

## Authentication

Login is handled by the backend, not the frontend: OpenID Connect (authorization code + PKCE) against Microsoft Entra ID, then an HTTP-only session cookie `bandvcard.auth`. This works because nginx serves frontend and API on one origin. No tokens reach the browser.

- Flow: frontend `/login` page links to `GET /api/auth/login?returnUrl=/` -> Microsoft -> `/api/auth/callback` -> cookie -> redirect to `returnUrl`. `GET /api/auth/me` returns the current user, `POST /api/auth/logout` ends the app session only (not the Microsoft session).
- `backend/Bandvcard.Api/Auth/AuthSetup.cs` holds the whole configuration. On a successful Microsoft login `UserSignInService` creates the `User` on first login (email lower-cased, names from the Microsoft claims); a user with status inactive is rejected at login and on every later request.
- The email in the cookie is `User.Identity.Name` and is what `ICurrentUser` writes to `CreatedBy`/`UpdatedBy`.
- Configuration: `Entra:TenantId`, `Entra:ClientId`, `Entra:ClientSecret` (in compose: `ENTRA_*` in `.env`). If any is missing, the app still starts, every protected endpoint returns 401 and `/api/auth/login` returns 503. Single tenant only: the email claim is not a safe identity across tenants.
- Test switch `DEV_LOGIN_EMAIL` in `.env` (`Auth:DevLoginEmail`): when set, `/api/auth/login` signs in as that user without Microsoft, through the same user creation, cookie and inactive check. It takes precedence over Entra. The backend refuses to start with it outside `ASPNETCORE_ENVIRONMENT=Development`. The compose backend defaults to Development for this reason; set `ASPNETCORE_ENVIRONMENT=Production` in `.env` for real use.
- The Entra app registration needs the redirect URI `<origin>/api/auth/callback` (type Web), e.g. `http://localhost:8080/api/auth/callback`. The backend derives the origin from `X-Forwarded-Host`/`X-Forwarded-Proto`, which nginx sets.
- Frontend: `src/proxy.ts` (Next.js 16 name for middleware) redirects requests without the cookie to `/login`; that check is optimistic. `src/lib/auth.ts` `getCurrentUser()` is the real check: it forwards the cookie to `/api/auth/me` using `BACKEND_URL` and redirects to `/login` on 401. Because `cacheComponents` is on, call it only inside a `<Suspense>` boundary. The cookie name is duplicated in `proxy.ts` and `AuthSetup.cs`.
- With `npm run dev` (no nginx), `next.config.ts` rewrites `/api/*` to `BACKEND_URL` (default `http://localhost:5048`).
- Backend tests replace the login with `TestAuthHandler`: send the header `X-Test-User: <email>` to act as that user.
- In compose the cookie encryption keys persist in the `backend-keys` volume (`DataProtection:KeysPath`); without it, sessions end on every backend restart.

## Planned stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js (also runs the OCR) |
| Backend | C# / .NET exposing OData endpoints |
| Database | PostgreSQL |
| Reverse proxy | nginx (routes to frontend and backend, terminates SSL) |
| Object storage / DMS | MinIO (business card photos) |

## Capture flow

1. The user takes a photo of the card in the frontend using the device camera.
2. The frontend runs OCR and extracts fields (name, company, phone, email, address, ...).
3. The recognised data is sent as JSON to the OData backend.
4. The original photo is stored in MinIO; the resulting link is passed to the backend.
5. The backend persists the contact in PostgreSQL, fills the audit fields, and stores the MinIO link on the contact.

The spec does not say explicitly whether the frontend or the backend performs the MinIO upload; it only says the backend receives the link. Clarify before implementing.

## Domain model

The spec uses German names; the terms in parentheses are the spec's originals.

**User (Benutzer)**: first name, last name, email, phone, status (`aktiv` | `inaktiv`). Email is unique and is the primary identifier for identification and authentication.

**Contact (Kontakt)**
- `ID`: UUID, generated automatically
- Salutation (Anrede), first name (Vorname), last name (Nachname), street (Straße), house number (Straßennummer, text), city (Ort), company name (Firmenname), function (Funktion): all text
- Postal code (Postleitzahl): foreign key to the postal code directory
- Phone and email: not in the spec's Kontakt table, added in code because the capture flow extracts them
- Photo link (Foto-Link): URL/path of the card image in MinIO
- Audit fields `CreatedAt`, `CreatedBy`, `UpdatedAt`, `UpdatedBy`: set automatically by the backend on save, never by the client

**Postal code directory (Ortsverzeichnis)**: postal code (primary key), place name (Ortsname), optional state/country (Bundesland / Land). It normalises postal codes and place names and is linked to contacts via the postal code.

## Open decisions in v1.0.0

These are explicitly undecided in the spec; ask rather than assume:

- OCR library or service for the frontend (candidates named: Tesseract.js, Google Vision API, Azure Cognitive Services)
- Authorisation concept (roles, access rights) is not specified; login exists, roles do not
- Import source for postal code data (e.g. Deutsche Post, OpenPLZ)
- MinIO bucket structure and access rights
