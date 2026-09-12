# Northstar AI Job Portal

Northstar is a full-stack, AI-ready job portal built for the technical assessment. It supports candidate and employer authentication, job discovery, applications, saved jobs, employer job management, applicant status updates, admin analytics, and permitted job aggregation through the Remotive public API.

## Stack

- Frontend: React, Vite, Lucide icons, responsive CSS
- Backend: Node.js, Express, TypeScript runtime via `tsx`
- Database: PostgreSQL with Prisma 7
- Authentication: JWT and bcrypt
- Job aggregation: Remotive public remote-jobs API

## Project structure

```text
backend/
  prisma/schema.prisma
  prisma/migrations/
  src/server.ts
  src/seed.ts
  docs/openapi.json
frontend/
  src/main.jsx
  src/styles.css
```

## Prerequisites

- Node.js 20+
- PostgreSQL running locally or a hosted PostgreSQL connection

## Configuration

Backend `.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_job_portal"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=4000
```

Frontend `.env` is optional. Copy `frontend/.env.example` to `frontend/.env` when the API is not running on port 4000:

```env
VITE_API_URL=http://localhost:4000
```

## Run locally

Terminal 1, backend:

```powershell
cd backend
npm install
npx prisma migrate dev
npm run db:seed
npm start
```

Terminal 2, frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`. The API health check is available at `http://localhost:4000/health`.

## API documentation

The OpenAPI contract is available as a file at `backend/docs/openapi.json`. The same contract can be served by the backend at:

```text
GET /docs/openapi.json
GET /docs
```

All protected routes use the JWT returned by registration or login:

```text
Authorization: Bearer <token>
```

## Main API routes

- `POST /auth/register`
- `POST /auth/login`
- `GET /jobs`
- `GET /jobs/:id`
- `POST /jobs`
- `PUT /jobs/:id`
- `DELETE /jobs/:id`
- `POST /jobs/:id/apply`
- `POST /jobs/:id/save`
- `GET /employer/jobs`
- `GET /applications`
- `PUT /applications/:id/status`
- `GET /dashboard`
- `POST /scrape/jobs`

## Scraping jobs

Import a permitted public feed through Remotive:

```powershell
$token = "ADMIN_JWT_TOKEN"
Invoke-WebRequest `
  -Uri http://localhost:4000/scrape/jobs `
  -Method Post `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"source":"remotive","search":"frontend"}'
```

The response reports `jobsFetched`, `jobsAdded`, `duplicatesSkipped`, and `errors`. Duplicate source URLs are protected by the database constraint.

For deterministic local development data:

```powershell
cd backend
npm run db:seed
```

## Validation

```powershell
cd backend
npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions src/server.ts src/seed.ts

cd ../frontend
npm run build
```

## Current scope

The working MVP includes role-aware dashboards, job lifecycle management, applicant status management, admin marketplace analytics, responsive frontend screens, and live Remotive ingestion. Deployment, automated tests, resume uploads, email notifications, and AI resume matching remain optional production extensions.
