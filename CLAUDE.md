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
npm test                              # vitest
npx vitest run src/lib/parse-card.test.ts -t "Swiss"   # single file / test name
```

`dev` and `build` first run `scripts/copy-tesseract.mjs`, which copies the Tesseract.js worker, WebAssembly cores and language data from `node_modules` into the git-ignored `public/tesseract/`. Read `frontend/AGENTS.md` before writing Next.js code: this Next.js version has breaking changes and ships its docs in `node_modules/next/dist/docs/`.

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
- `Controllers/`: one `ODataController` per entity set with `Get`, `Get(key)`, `Post`, `Patch` (via `Delta<T>`) and `Delete`; no `Put`. Query options `$filter`, `$select`, `$orderby`, `$expand`, `$count` are enabled, `$top` is capped at 100 and collections page at 100. Keys cannot be changed, an unknown postal code on a contact is added to `PostalCodes` (see Capturing a business card), and a postal code in use cannot be deleted.
- Every endpoint requires a logged-in user (authorization fallback policy) except `/api/auth/login` and `/api/auth/logout`; what a user may do beyond that is described under Roles and permissions.
- Tests use the EF Core in-memory provider, so they do not need a database. `ODataApiTests` runs the real HTTP pipeline through `WebApplicationFactory`; the in-memory provider does not enforce foreign keys, so those rules are checked in the controllers.

Full stack (run in the repo root; needs `.env`, copy from `.env.example`):

```bash
./scripts/generate-cert.sh        # once: self-signed TLS certificate in nginx/certs (git-ignored); nginx does not start without it
./scripts/generate-passwords.sh   # once: random POSTGRES_PASSWORD / MINIO_ROOT_PASSWORD in .env (--force replaces existing ones)
docker compose up -d --build   # postgres, minio, backend, frontend, nginx
docker compose logs -f backend
docker compose down            # add -v to also delete the postgres and minio volumes
```

- nginx is the only entry point for the apps and terminates TLS: https://localhost:8443 (HTTP/2, self-signed certificate, so browsers warn until it is trusted). http://localhost:8080 only redirects there with 308. `/api/` goes to the backend with the prefix kept (backend routes must be registered under `/api`), everything else goes to the frontend. The config is `nginx/default.conf.template`, rendered by the nginx image at start; only `${NGINX_HTTPS_PORT}` is substituted. No HSTS header is sent, on purpose: on `localhost` it would apply to every port and break other local projects.
- nginx binds to `NGINX_BIND` (default 127.0.0.1). `0.0.0.0` makes the app reachable in the network, e.g. for testing the camera on a phone via `https://<ip>:8443`. In the Development environment there is no login, so everyone in that network can then use the app as the developer user. The certificate covers localhost, the host name and the LAN address at creation time; pass further names to `generate-cert.sh --force`.
- Host ports are bound to 127.0.0.1 and set in `.env`: postgres 5433 (not 5432), MinIO API 9000, MinIO console 9001.
- The backend container gets `ConnectionStrings__Default` pointing at the `postgres` service. No MinIO settings are passed to any service.
- MinIO uses `cgr.dev/chainguard/minio:latest` because official `minio/minio` images are no longer published. Only `latest` is free there, so the version is not pinned.
- The frontend image relies on `output: "standalone"` in `frontend/next.config.ts`.

## What bandvcard is

A digital business card manager: the user photographs a business card, OCR runs in the frontend, and the extracted data is stored as a structured contact, with the original photo kept in object storage.

## Authentication

The backend environment decides whether there is a login (`ASPNETCORE_ENVIRONMENT`, set in `.env` for compose; default Development):

- **Development: no login.** `Auth/DevAuthHandler.cs` authenticates every request as the developer user `DEV_USER_EMAIL` (`Auth:DevUserEmail`, default `dev@example.com`). Whoever can reach the app is that user, so do not expose a Development stack to people who should not have that access.
- **Any other environment: Microsoft Entra ID.** OpenID Connect (authorization code + PKCE) in the backend, then an HTTP-only session cookie `bandvcard.auth`. This works because nginx serves frontend and API on one origin; no tokens reach the browser. Needs `Entra:TenantId`, `Entra:ClientId`, `Entra:ClientSecret` (`ENTRA_*` in `.env`); without them every protected endpoint returns 401 and `/api/auth/login` returns 503. Single tenant only: the email claim is not a safe identity across tenants. The app registration needs the redirect URI `<origin>/api/auth/callback` (type Web), e.g. `https://localhost:8443/api/auth/callback`; the backend derives the origin from `X-Forwarded-Host`/`X-Forwarded-Proto`, which nginx sets.

Common to both:

- `Auth/AuthSetup.cs` holds the configuration. Every login goes through `UserSignInService.SignInAsync`, which creates the `User` on first login (email lower-cased) and refreshes first and last name on later ones; an inactive user is rejected. The user table therefore only contains people who have logged in, and there is no user management in the frontend. The admin-only `/api/Users` endpoints still exist.
- The email is `User.Identity.Name` and is what `ICurrentUser` writes to `CreatedBy`/`UpdatedBy`.
- Endpoints: `GET /api/auth/mode` (`development`, `microsoft` or `none`), `GET /api/auth/login?returnUrl=/` (to Microsoft; in Development straight to `returnUrl`), `GET /api/auth/me` (current user, role, `loginRequired`), `POST /api/auth/logout` (ends the app session only, not the Microsoft session).
- Frontend: there is no middleware/`proxy.ts`. Pages are protected by `lib/auth.ts` `getCurrentUser()`, which forwards the cookie to `/api/auth/me` using `BACKEND_URL` and redirects to `/login` on 401. `components/page-shell.tsx` calls it for the account display, so every page built with `PageShell` is protected; a page without it must call `getCurrentUser()` itself. Because `cacheComponents` is on, call it only inside a `<Suspense>` boundary. The `/login` page asks `/api/auth/mode` and redirects to `/` in Development.
- With `npm run dev` (no nginx), `next.config.ts` rewrites `/api/*` to `BACKEND_URL` (default `http://localhost:5048`).
- Backend tests replace the login with `TestAuthHandler`: send the header `X-Test-User: <email>` to act as that user. `EnvironmentAuthTests` covers the real Development and Production wiring; the cookie session check (`ValidateSessionAsync`) has no automated test, because that needs a completed Microsoft login.
- In compose the cookie encryption keys persist in the `backend-keys` volume (`DataProtection:KeysPath`); without it, sessions end on every backend restart.

## Roles and permissions

Two roles, stored in `User.Role` (`UserRole`): `User` (default) and `Admin`. The rules are enforced in the backend; the frontend only hides what would be refused.

- **Contacts and their opportunities:** a user works only with contacts they captured (`Contact.CreatedBy` = their email, set by the audit logic and not changeable); an admin with all. `Data/ContactVisibility.cs` is the one place that decides this, and the contact, opportunity and photo controllers all query through it, so a foreign contact answers 404, not 403. Any new way to reach contacts (endpoint, `$expand` path, export) must go through it too; the navigation from postal code to contacts is removed from the EDM for that reason.
- **Photos:** readable only through a contact the user may see (or by admins), and a contact cannot reference a photo that belongs to another user's contact.
- **Users** (`UsersController`): admins only. Guards: nobody can change their own role or status or delete themselves, and an address in `ADMIN_EMAILS` cannot be demoted.
- **Postal codes:** readable by everyone, changed directly only by admins. Saving a contact still adds unknown postal codes for any user.
- **Who is admin:** `ADMIN_EMAILS` in `.env` (`Auth:AdminEmails`, comma-separated), also for the developer user. Those addresses get the role at every login. Removing an address there does not demote the user; that needs `PATCH /api/Users('<email>')` by an admin, since the frontend has no user management.
- The role is a role claim in the session cookie, used via `[Authorize(Roles = Roles.Admin)]` and `ICurrentUser.IsAdmin`. The cookie is re-checked against the database on every request (`AuthSetup.ValidateSessionAsync`), so role changes, deactivation and deletion apply to running sessions immediately.
- Deleting a user does not block them: with a valid Microsoft login they are created again as a normal user. Deactivate (via the API) to block. Their contacts stay and are then visible to admins only (and to them again if they return).
- Backend tests choose the role with the header `X-Test-Role: Admin` next to `X-Test-User`.

## Capturing a business card

Page `/erfassen` (`frontend/src/app/erfassen/`, UI text in German), a client component with the steps photo -> OCR -> review form -> save:

1. `<input type="file" capture="environment">` takes the photo (camera on phones, file picker on desktops). `lib/image.ts` scales it to max. 2000 px, applies EXIF rotation and makes a JPEG; that JPEG is what gets OCR'd and stored.
2. `lib/image.ts` `prepareOcrImage()` makes a second, OCR-only version of the photo with `lib/enhance.ts`: grey, shadows and uneven light flattened, contrast stretched. `lib/ocr.ts` runs Tesseract.js (German + English, page segmentation `PSM.AUTO`) on it in the browser from the self-hosted files under `/tesseract`; nothing is loaded from a CDN and the photo is not sent anywhere for OCR. Both the enhancement and `PSM.AUTO` matter: without them real photos produce garbage lines (Tesseract.js defaults to treating the photo as one text block). `enhance.ts` is pure pixel maths without canvas so it runs in tests. Adding a language means changing both `lib/ocr.ts` and `scripts/copy-tesseract.mjs` and installing `@tesseract.js-data/<lang>`.
3. `lib/parse-card.ts` turns the OCR text into contact fields with regex heuristics (German/Swiss/Austrian cards). The name is found first through the email address (`gasser@…`, `erika.mustermann@…`), which survives OCR noise, then by shape. It is a pure function; its tests include real OCR output of photographed cards. When a card is read badly, get its OCR text ("Erkannter Text" in the form), add it as a test case and fix the parser there. The user corrects the result in the form.
4. Save (`lib/api.ts`): `POST /api/photos` (multipart field `file`) returns `{ photoLink }`, then `POST /api/Contacts` with the fields and that link.

Backend side:

- `Controllers/PhotosController.cs` + `Storage/`: photos go into the MinIO bucket `business-cards` (created on first upload) under `yyyy/MM/<guid>.<ext>`; JPEG, PNG, WebP up to 15 MB. `PhotoLink` is the relative URL `/api/photos/<key>`, served by the same controller, so photos need a login and MinIO is never exposed to the browser. Tests swap `IPhotoStorage` for an in-memory fake.
- The backend uses the MinIO root credentials (`Minio:*`, from `MINIO_ROOT_*`); a dedicated access key does not exist yet.
- Saving a contact with a postal code that is not in `PostalCodes` adds it with the contact's city as place name (400 if there is no city). The directory therefore grows from captured cards; there is no import.
- Deleting a contact deletes its photo from MinIO unless another contact uses the same link; a storage failure there is only logged. `Storage/PhotoLinks.cs` is the one place that maps between `PhotoLink` and the storage key. Photos still become orphans when a contact's `PhotoLink` is changed or cleared via PATCH, and when the contact save fails after a successful upload.

## Contact list and detail pages

- `/kontakte` (list) and `/kontakte/[id]` (detail) are server-rendered: they call the backend through `lib/backend.ts` `backendFetch()`, which forwards the session cookie and redirects to `/login` on 401. Like `getCurrentUser()` it must run inside a `<Suspense>` boundary, and so must reading `params`/`searchParams`.
- The list state lives in the URL (`?q=` search text, `?seite=` page), the search is a plain GET form. `lib/contacts.ts` builds the OData query (`contactListQuery`, 25 per page, case-insensitive search over name, company, city and email) and holds the `Contact` types; it is shared by server and client code, so keep it free of server-only imports.
- Editing and deleting happen in the client component `kontakte/[id]/contact-detail.tsx` through `lib/api.ts` (browser `fetch` to `/api`), followed by `router.refresh()`.
- `components/contact-fields.tsx` is the one definition of the contact form fields and their German labels, used by capture, edit and the detail view; add a new contact field there (and in `CardFields`). `components/page-shell.tsx` is the common navigation and layout for pages behind the login.

## Opportunities and the Abacus release

Both are additions to the spec, requested later.

- **Opportunities:** a contact has any number of `Opportunity` rows (`Text`, max. 200 characters, trimmed, not empty; audited). They are deleted with their contact (database cascade). OData entity set `Opportunities` with `OpportunitiesController`; an opportunity cannot be moved to another contact. They follow the visibility of their contact (see Roles and permissions).
- **Abacus status:** `Contact.AbacusStatus` is `None`, `ToImport` (shown as "übernehmen") or `Imported` ("übernommen"), with `AbacusImportedAt` as the date of the transfer. People only switch between `None` and `ToImport`, by hand with a normal `PATCH` on the contact, because only hand-picked contacts are to be transferred. `Imported` and its date are set by the import alone; `ContactsController` refuses them from anyone else, and clears the date when a person releases an imported contact again. The transfer itself is an n8n workflow outside this repository.
- **Access for the import (n8n):** a request with the header `X-Api-Key: <ABACUS_API_KEY>` (`Integration:ApiKey`) is the integration, in every environment (`Auth/ApiKeyAuthHandler.cs`, role `Integration`, not a user and not stored in the user table). `Data/ContactVisibility.cs` limits it to contacts with `ToImport`, their opportunities and their photos. It is read-only, enforced centrally in `Program.cs` for every non-GET request, except actions marked `[IntegrationWrite]`. The workflow is: `GET /api/Contacts?$expand=opportunities`, transfer each contact, then `POST /api/abacus/contacts/<id>/imported` (`AbacusController`, integration only), which sets `Imported` and the date; after that the contact is no longer returned. Repeating the POST is harmless. A wrong key is a 401 and never falls back to the browser login or the developer user. An empty key disables the access; `scripts/generate-passwords.sh` creates one.
- Frontend: both live on the contact detail page in `kontakte/[id]/contact-extras.tsx`; the list marks released contacts.

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

Decided since: OCR is Tesseract.js in the browser, and the frontend uploads the photo through the backend (see Capturing a business card).

## Domain model

The spec uses German names; the terms in parentheses are the spec's originals.

**User (Benutzer)**: first name, last name, email, phone, status (`aktiv` | `inaktiv`). Email is unique and is the primary identifier for identification and authentication.

**Contact (Kontakt)**
- `ID`: UUID, generated automatically
- Salutation (Anrede), first name (Vorname), last name (Nachname), street (Straße), house number (Straßennummer, text), city (Ort), company name (Firmenname), function (Funktion): all text
- Postal code (Postleitzahl): foreign key to the postal code directory
- Phone, mobile and email: not in the spec's Kontakt table, added in code because the capture flow extracts them. The parser puts numbers with a mobile label or a CH/DE/AT mobile prefix into mobile, the landline into phone, and ignores fax numbers
- Photo link (Foto-Link): URL/path of the card image in MinIO
- Audit fields `CreatedAt`, `CreatedBy`, `UpdatedAt`, `UpdatedBy`: set automatically by the backend on save, never by the client

**Postal code directory (Ortsverzeichnis)**: postal code (primary key), place name (Ortsname), optional state/country (Bundesland / Land). It normalises postal codes and place names and is linked to contacts via the postal code.

## Open decisions in v1.0.0

These are explicitly undecided in the spec; ask rather than assume:

- Import source for postal code data (e.g. Deutsche Post, OpenPLZ)
- MinIO access rights (a single bucket and the root credentials are used for now)
