# Wulfzx SitePulse

Wulfzx SitePulse is a three-part dashboard for Wulfzx.Underground:

- Part 1: Uptime Monitor
- Part 2: Traffic Analytics
- Part 3: QA Portal

On first launch, the SQLite database is created automatically and preloaded with:

- Wulfzx Main Website — https://wzxu.pro
- Wulfzx 76 Guide — https://wzxu76.pro
- Wulfzx Field Guide — https://wulfzx-field-guide.vercel.app/

## What It Includes

- React frontend with Tailwind CSS
- Node.js + Express backend
- SQLite database
- Uptime checks with response speed history
- Recharts charts for uptime and analytics
- Separate analytics tracking script for each website
- Copy tracking script button
- Traffic analytics ingestion endpoint
- QA tester reports, quick bug reports, and staff report console

## Beginner-Friendly Setup

1. Install Node.js from https://nodejs.org if it is not already installed.

2. Open a terminal in this folder:

   ```powershell
   cd C:\Users\emman\Documents\webdashboard
   ```

3. Install the app dependencies:

   ```powershell
   npm install
   ```

4. Start the frontend and backend together:

   ```powershell
   npm run dev
   ```

5. Open the dashboard:

   ```text
   http://localhost:5173
   ```

The backend runs at:

```text
http://localhost:4000
```

## QA Portal

The QA Portal adds the Wulfzx.Underground QA flow beside SitePulse:

- `/qa` - full QA tester report form
- `/bug` - quick public bug report form
- `/admin/login` - staff login
- `/admin/reports` - private report console

For local development, QA reports are stored in the same SQLite database and uploads are saved under `data/qa-uploads`. For production, use Supabase/Postgres and Supabase Storage.

Required production environment variables:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PASSWORD=choose-a-strong-password
PUBLIC_BASE_URL=https://your-dashboard-domain.example.com
```

Create the Supabase tables and private upload bucket with `supabase-schema.sql`.

## Tracking Scripts

Each default website has its own tracking script in the dashboard. Select a site, click `Copy`, and paste the script before the closing `</body>` tag of that website.

Default scripts:

```html
<script src="https://YOUR-DASHBOARD-DOMAIN.com/tracker.js" data-site="wzxu-pro"></script>
<script src="https://YOUR-DASHBOARD-DOMAIN.com/tracker.js" data-site="wzxu76-pro"></script>
```

If the dashboard is deployed somewhere other than localhost, set `PUBLIC_BASE_URL` for the backend so copied tracking scripts point at the public API:

```powershell
$env:PUBLIC_BASE_URL="https://your-sitepulse-api.example.com"
npm run start
```

## Production Build

Create a frontend build:

```powershell
npm run build
```

Run the Express server:

```powershell
npm run start
```

The server will serve the built frontend from `dist`.

## Deploy To Render

This project includes `render.yaml` and `Dockerfile` for a Render web service with a persistent disk mounted at `/app/data`.

1. Push this folder to a GitHub repository.
2. In Render, choose `New` -> `Blueprint`.
3. Select the repository.
4. Add `PUBLIC_BASE_URL` after Render gives you the service URL:

   ```text
   https://your-render-service.onrender.com
   ```

5. Redeploy so copied tracker scripts use the public domain:

   ```html
   <script src="https://your-render-service.onrender.com/tracker.js" data-site="wzxu-pro"></script>
   <script src="https://your-render-service.onrender.com/tracker.js" data-site="wzxu76-pro"></script>
   ```

## Data

The SQLite database is stored at:

```text
data/sitepulse.db
```

Delete that file only if you want to reset all uptime checks and analytics events.

On Railway, set `DATA_DIR=/data` so the SQLite database uses the mounted persistent volume.
