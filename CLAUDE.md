# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

A working application: Next.js frontend in `frontend/`, .NET OData backend in `backend/`, run together with PostgreSQL, MinIO and nginx via Docker Compose. `bandvcard_v1.0.0_context.docx` (German) is the original project context/spec for v1.0.0; the stack, capture flow and domain model sections at the end are derived from it. The application has since grown beyond the spec (login, roles, mobile number, opportunities, Abacus status, dictation); those additions are described in the sections in between, and where they differ from the spec, this file and the code are right.

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

`dev` and `build` first run `scripts/copy-tesseract.mjs`, which copies the Tesseract.js worker, WebAssembly cores and language data from `node_modules` into the git-ignored `public/tesseract/`. They also run `scripts/copy-guidelines.mjs`, which copies the design guide's CSS from `guidelines/` into the git-ignored `src/styles/guidelines/` (Turbopack does not load CSS from outside `frontend/`); compose passes `guidelines/` to the frontend image as the additional build context `guidelines`. Read `frontend/AGENTS.md` before writing Next.js code: this Next.js version has breaking changes and ships its docs in `node_modules/next/dist/docs/`.

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
- `Data/ICurrentUser.cs`: supplies the name for `CreatedBy`/`UpdatedBy`. It reads the email of the logged-in user and falls back to `"system"` outside of a request (tools, background work); it also tells whether the caller is an admin or the integration.
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
- nginx binds to `NGINX_BIND` (default 127.0.0.1). `0.0.0.0` makes the app reachable in the network, e.g. for testing the camera on a phone via `https://<ip>:8443`. In the Development environment there is no login, so everyone in that network can then use the app as the developer user. The certificate covers localhost, the host name and one LAN address at creation time (the one of the default route); pass further names or addresses to `generate-cert.sh --force` and then run `docker compose up -d --force-recreate nginx`.
- The URL with an IP address is `https://<ip>:${NGINX_HTTPS_PORT}`. `ip -4 -o addr show scope global` lists the machine's addresses (ignore `docker0` and `br-*`); they come from DHCP, so look them up instead of writing them down. A machine on Wi-Fi and cable has two, and only the one in the certificate opens without a name mismatch: `openssl x509 -in nginx/certs/server.crt -noout -ext subjectAltName` shows which.
- Host ports are bound to 127.0.0.1 and set in `.env`: postgres 5433 (not 5432), MinIO API 9000, MinIO console 9001.
- The backend container gets `ConnectionStrings__Default` pointing at the `postgres` service and `Minio__*` pointing at the `minio` service with the root credentials. The frontend container only gets `BACKEND_URL`.
- MinIO uses `cgr.dev/chainguard/minio:latest` because official `minio/minio` images are no longer published. Only `latest` is free there, so the version is not pinned.
- The frontend image relies on `output: "standalone"` in `frontend/next.config.ts`.

Deploying to another machine (needs only Docker, git and openssl there; the images build from source):

```bash
git clone https://github.com/erich3019/bandvcard.git && cd bandvcard
./scripts/generate-passwords.sh        # also creates .env from .env.example
./scripts/generate-cert.sh <ip> ...    # every address the app is opened with
docker compose up -d --build
# later: git pull --ff-only && docker compose up -d --build
```

- `.env` and `nginx/certs/` are git-ignored, so each machine has its own passwords, API key and certificate. Decide `ASPNETCORE_ENVIRONMENT` and `NGINX_BIND` in that `.env` before starting (see Authentication), and pick other `NGINX_*` ports if 8080/8443 are taken.
- The images contain no .NET SDK, so `dotnet ef database update` cannot run on such a machine. Create the SQL on a development machine and pipe it into the remote database; the script is idempotent, so it is safe to repeat after every update:

```bash
dotnet ef migrations script --idempotent --project Bandvcard.Api -o migrate.sql    # in backend/
ssh <host> 'cd bandvcard && docker compose exec -T postgres sh -c "psql -q -v ON_ERROR_STOP=1 -U \$POSTGRES_USER -d \$POSTGRES_DB"' < migrate.sql
```

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

The same page offers two ways without a card, both ending in the same review form and saved without a photo (`PhotoLink` empty):

- **Dictating a contact:** the speaker names each field and then its value ("Vorname Andreas, Nachname Gasser, Firma …"). `lib/parse-spoken.ts` assigns the text by those spoken field names; it is a pure function with tests, and the list of accepted field names lives there. Speech has no layout to guess from, so free speech without field names is deliberately not supported.
- **Typing by hand:** the empty review form.

Every field of the contact form (`components/contact-fields.tsx`, also used when editing) has a microphone button that dictates into that one field and replaces its content. All dictation goes through the hook `lib/use-dictation.ts` (German, browser speech recognition, see the note on dictation under Opportunities).

Backend side:

- `Controllers/PhotosController.cs` + `Storage/`: photos go into the MinIO bucket `business-cards` (created on first upload) under `yyyy/MM/<guid>.<ext>`; JPEG, PNG, WebP up to 15 MB. `PhotoLink` is the relative URL `/api/photos/<key>`, served by the same controller, so photos need a login and MinIO is never exposed to the browser. Tests swap `IPhotoStorage` for an in-memory fake.
- The backend uses the MinIO root credentials (`Minio:*`, from `MINIO_ROOT_*`); a dedicated access key does not exist yet.
- Saving a contact with a postal code that is not in `PostalCodes` adds it with the contact's city as place name (400 if there is no city). The directory therefore grows from captured cards; there is no import.
- Deleting a contact deletes its photo from MinIO unless another contact uses the same link; a storage failure there is only logged. `Storage/PhotoLinks.cs` is the one place that maps between `PhotoLink` and the storage key. Photos still become orphans when a contact's `PhotoLink` is changed or cleared via PATCH, and when the contact save fails after a successful upload.

## Contact list and detail pages

- `/kontakte` (list) and `/kontakte/[id]` (detail) are server-rendered: they call the backend through `lib/backend.ts` `backendFetch()`, which forwards the session cookie and redirects to `/login` on 401. Like `getCurrentUser()` it must run inside a `<Suspense>` boundary, and so must reading `params`/`searchParams`.
- The list state lives in the URL (`?q=` search text, `?seite=` page), the search is a plain GET form. `lib/contacts.ts` builds the OData query (`contactListQuery`, 25 per page, case-insensitive search over name, company, city and email) and holds the `Contact` types; it is shared by server and client code, so keep it free of server-only imports.
- Editing and deleting happen in the client component `kontakte/[id]/contact-detail.tsx` through `lib/api.ts` (browser `fetch` to `/api`), followed by `router.refresh()`.
- `components/contact-fields.tsx` is the one definition of the contact form fields and their German labels, used by capture, edit and the detail view; add a new contact field there (and in `CardFields`). `components/page-shell.tsx` is the common shell for pages behind the login (see Layout and design guide).

## Layout and design guide

The frontend follows the design guide in `guidelines/` (v4, German; `guidelines/README.md` holds the rules). Change tokens only in `guidelines/tokens.json` and regenerate with `node guidelines/scripts/build-tokens.mjs`, which also checks the contrasts.

- **Profile `standard`** (navy primary, orange action), imported in `src/app/globals.css` together with `tokens.css` and `tailwind-theme.css`. Font Inter via `next/font`, icons Lucide (`lucide-react`).
- Colours only as token classes (`bg-surface`, `text-muted`, `border-input`, `bg-action text-on-action` …), never Tailwind palette colours or hex values; both themes then work without `dark:` variants. The theme is `data-theme` on `<html>` via `next-themes`; the user menu offers Hell, Dunkel, System.
- Building blocks in `components/ui.tsx`: `buttonClass(variant, size)` (classes, so links and the photo input label can use them), `inputClass`, `PageHeader`, `Panel` (`main`/`rail`), `Badge`, `ErrorNote`. One `primary` (action) button per view; destructive actions are the `danger` ghost button.
- Shell (`components/page-shell.tsx`, client parts in `shell-client.tsx`): sidebar with navigation and user card, topbar with breadcrumbs (`crumbs` prop) and user menu, skip link to `<main id="inhalt">`. Below 1024px the sidebar is a drawer. `usePathname()` must stay inside a `<Suspense>` boundary (cacheComponents).
- Pages: start page as work list (key figures, recently captured), list as table, detail with main area (contact data, opportunities) and a rail (card photo, Abacus, history). Rail and main area are side by side from 1280px (`xl`).
- Text: Swiss spelling with "ss" (Strasse), guillemets «…», dates and numbers through `lib/format.ts` (de-CH, Europe/Zurich).
- Status colours: Abacus `None` neutral, `ToImport` warning, `Imported` success. Contacts have no object numbers.
- Deliberate deviations: no global search and no notifications in the topbar (the contact list has its own search, there is nothing to notify); form labels sit above the fields instead of in a left column, because capture happens on phones; buttons are a class helper instead of `cva`.

## Opportunities and the Abacus release

Both are additions to the spec, requested later.

- **Opportunities:** a contact has any number of `Opportunity` rows (`Text`, max. 200 characters, trimmed, not empty; audited). They are deleted with their contact (database cascade). OData entity set `Opportunities` with `OpportunitiesController`; an opportunity cannot be moved to another contact. They follow the visibility of their contact (see Roles and permissions).
- **Abacus status:** `Contact.AbacusStatus` is `None`, `ToImport` (shown as "übernehmen") or `Imported` ("übernommen"), with `AbacusImportedAt` as the date of the transfer. People only switch between `None` and `ToImport`, by hand with a normal `PATCH` on the contact, because only hand-picked contacts are to be transferred. `Imported` and its date are set by the import alone; `ContactsController` refuses them from anyone else, and clears the date when a person releases an imported contact again. The transfer itself is an n8n workflow outside this repository; the n8n instance is the Compose project in `/home/erich/Projects/bandn8n` (renamed from `n8n-server` on 2026-10-18).
- **Access for the import (n8n):** a request with the header `X-Api-Key: <ABACUS_API_KEY>` (`Integration:ApiKey`) is the integration, in every environment (`Auth/ApiKeyAuthHandler.cs`, role `Integration`, not a user and not stored in the user table). `Data/ContactVisibility.cs` limits it to contacts with `ToImport`, their opportunities and their photos. It is read-only, enforced centrally in `Program.cs` for every non-GET request, except actions marked `[IntegrationWrite]`. The workflow is: `GET /api/Contacts?$expand=opportunities`, transfer each contact, then `POST /api/abacus/contacts/<id>/imported` (`AbacusController`, integration only), which sets `Imported` and the date; after that the contact is no longer returned. Repeating the POST is harmless. A wrong key is a 401 and never falls back to the browser login or the developer user. An empty key disables the access; `scripts/generate-passwords.sh` creates one.
- Frontend: both live on the contact detail page in `kontakte/[id]/contact-extras.tsx`; the list marks released contacts.
- **Dictation:** an opportunity can be dictated in German with the browser's built-in speech recognition (Web Speech API, `lib/dictation.ts`): Chrome, Edge and Safari, not Firefox, HTTPS only. The browser usually sends the audio to its vendor for recognition, a deliberate choice, unlike the card OCR that stays on the device. One utterance per press (`continuous = false`, because continuous mode repeats text on Android); the text is appended to the field and still has to be saved.

## Stack

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

## Open points

Undecided; ask rather than assume:

- Import source for postal code data (e.g. Deutsche Post, OpenPLZ); the directory currently fills itself from captured contacts
- MinIO access rights (a single bucket and the root credentials are used for now)
- A real TLS certificate and host name for production (the certificate is self-signed, no HSTS)

Built but never run for real, as of 2026-10-11; treat as unverified until someone has tried them:

- The Microsoft Entra login end to end (callback, claims, session cookie): there is no app registration yet. Only the redirect to Microsoft was checked with placeholder values.
- Everything that needs a browser with camera or microphone was only tested through its pure functions and the HTTP API: taking a photo, the in-browser image enhancement and OCR, dictation of opportunities, contacts and single fields. The user tried card capture on a phone; dictation has no feedback yet.
- The n8n workflow for Abacus does not exist in this repository (n8n instance: `/home/erich/Projects/bandn8n`); the API it would use was tested with curl.
