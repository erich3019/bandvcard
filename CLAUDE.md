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

`Bandvcard.Api` uses controllers with `AddOData()` enabled but no EDM model or routes registered yet. `Microsoft.AspNetCore.OData` and `Npgsql.EntityFrameworkCore.PostgreSQL` are referenced; no `DbContext` or connection string exists.

Full stack (run in the repo root; needs `.env`, copy from `.env.example`):

```bash
docker compose up -d --build   # postgres, minio, backend, frontend, nginx
docker compose logs -f backend
docker compose down            # add -v to also delete the postgres and minio volumes
```

- nginx is the only entry point for the apps: http://localhost:8080. `/api/` goes to the backend with the prefix kept (backend routes must be registered under `/api`), everything else goes to the frontend. TLS termination is not configured yet.
- Host ports are bound to 127.0.0.1 and set in `.env`: postgres 5433 (not 5432), MinIO API 9000, MinIO console 9001.
- The backend container gets `ConnectionStrings__Default` pointing at the `postgres` service. Nothing reads it yet, and no MinIO settings are passed to any service.
- MinIO uses `cgr.dev/chainguard/minio:latest` because official `minio/minio` images are no longer published. Only `latest` is free there, so the version is not pinned.
- The frontend image relies on `output: "standalone"` in `frontend/next.config.ts`.

## What bandvcard is

A digital business card manager: the user photographs a business card, OCR runs in the frontend, and the extracted data is stored as a structured contact, with the original photo kept in object storage.

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
- Photo link (Foto-Link): URL/path of the card image in MinIO
- Audit fields `CreatedAt`, `CreatedBy`, `UpdatedAt`, `UpdatedBy`: set automatically by the backend on save, never by the client

**Postal code directory (Ortsverzeichnis)**: postal code (primary key), place name (Ortsname), optional state/country (Bundesland / Land). It normalises postal codes and place names and is linked to contacts via the postal code.

## Open decisions in v1.0.0

These are explicitly undecided in the spec; ask rather than assume:

- OCR library or service for the frontend (candidates named: Tesseract.js, Google Vision API, Azure Cognitive Services)
- Authorisation concept (roles, access rights) is not specified
- Import source for postal code data (e.g. Deutsche Post, OpenPLZ)
- MinIO bucket structure and access rights
