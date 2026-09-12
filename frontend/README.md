# Northstar frontend

## Run locally

From this folder:

```powershell
npm install
npm run dev
```

The UI expects the backend API at `http://localhost:4000`. To use another URL, copy `.env.example` to `.env` and set `VITE_API_URL`.

Start the backend separately from `../backend` with `npm start`.

## Included flow

- Search and filter open jobs
- Select a job for details
- Register as a candidate or employer
- Sign in and persist the JWT locally
- Apply to or save jobs when authenticated
- Responsive mobile and desktop layouts
