# MAU Site Audit — Web Deployment Guide
## Live on the web in under 30 minutes, free

Users open the app in any browser on any device — phone, tablet, or desktop.
On mobile, they can tap "Add to Home Screen" and it behaves exactly like an app icon.

---

## WHAT YOU NEED

| Tool | Cost | Purpose |
|------|------|---------|
| Supabase | Free | Shared database — all sites see each other's audits |
| Vercel | Free | Hosts the web app at a public URL |
| GitHub | Free | Stores the code (makes future updates one click) |
| Node.js | Free | Needed once, on your computer, to build the app |

Total cost: $0

---

## PHASE 1 — SUPABASE (SHARED DATABASE)
*~15 minutes*

All sites write audits to the same database so benchmarking and team views work across locations.

### 1.1 Create account
1. Go to https://supabase.com → click **Start your project**
2. Sign up with GitHub or email
3. Click **New project**
4. Name: `mau-audit` · Region: **US East (N. Virginia)** · set a password → **Create new project**
5. Wait ~2 minutes for it to spin up

### 1.2 Create the database table
1. In your project dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**, paste the following, then click **Run**:

```sql
CREATE TABLE audits (
  id TEXT PRIMARY KEY,
  audit_data JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  site TEXT,
  audit_type TEXT,
  auditor_name TEXT,
  score_pct INTEGER
);

ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON audits FOR ALL USING (true) WITH CHECK (true);
```

### 1.3 Copy your credentials
1. Click **Settings** (gear icon, bottom left) → **API**
2. Copy and save two things:
   - **Project URL** — looks like `https://abcxyz123.supabase.co`
   - **anon public** key — long string starting with `eyJ...`

---

## PHASE 2 — BUILD THE APP
*~10 minutes*

### 2.1 Install Node.js (one time only)
1. Go to https://nodejs.org → download the **LTS** version
2. Run the installer
3. Open Terminal (Mac) or Command Prompt (Windows) and verify: `node --version`

### 2.2 Set up the project
1. Unzip `mau-audit-app.zip` anywhere on your computer
2. Open Terminal/Command Prompt and navigate into the folder:
   ```
   cd path/to/mau-audit-app
   ```
3. Copy the env template:
   ```
   cp .env.example .env
   ```
4. Open `.env` in any text editor (Notepad is fine) and fill in your Supabase values:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...your-full-key-here
   ```
5. Install dependencies:
   ```
   npm install
   ```
6. Build the app:
   ```
   npm run build
   ```
   This creates a `dist/` folder — that's the finished web app.

### 2.3 Test it locally (optional)
```
npm run dev
```
Open http://localhost:5173 in your browser. Everything should work.
Press Ctrl+C when done.

---

## PHASE 3 — DEPLOY TO VERCEL
*~5 minutes — two options*

### Option A: Drag & Drop (simplest, no GitHub needed)

1. Go to https://vercel.com → sign up free
2. From your dashboard, look for **"Import Project"** or drag-and-drop area
3. Drag your entire `mau-audit-app` folder onto the Vercel dashboard
4. Vercel auto-detects it's a Vite app
5. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
6. Click **Deploy**
7. In ~60 seconds you get a live URL like `mau-audit-abc123.vercel.app`

### Option B: GitHub + Vercel (recommended — makes future updates easy)

**Push to GitHub:**
1. Create a free account at https://github.com
2. Click **New repository** → name it `mau-audit` → **Create repository**
3. In Terminal, inside your project folder:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR-USERNAME/mau-audit.git
   git push -u origin main
   ```

**Connect to Vercel:**
1. Go to https://vercel.com → sign up / log in with GitHub
2. Click **Add New Project** → **Import Git Repository**
3. Select `mau-audit` from your GitHub repos
4. Under **Environment Variables**, add both Supabase values (same as Option A)
5. Click **Deploy**
6. Done — live URL appears in ~60 seconds

**Future updates with Option B:** Any time you change the code and push to GitHub, Vercel automatically redeploys in ~60 seconds. No manual steps needed.

---

## PHASE 4 — CUSTOM DOMAIN (OPTIONAL)
*Makes the URL something like `audit.mauworkforce.com`*

1. In Vercel dashboard → your project → **Settings** → **Domains**
2. Type your desired domain (e.g. `audit.mauworkforce.com`) → **Add**
3. Vercel shows you DNS records to add
4. Log in to wherever your domain is registered (GoDaddy, Namecheap, etc.)
5. Add the DNS records Vercel specifies (usually a CNAME record)
6. Takes 5–30 minutes to propagate

If you don't have a domain yet, the free `yourapp.vercel.app` URL works perfectly.

---

## PHASE 5 — SHARE WITH YOUR TEAM

### Send the link
Just share the Vercel URL with everyone at MAU. That's it.
Works on any device, any browser — no install required.

### "Install" on phones (Add to Home Screen)
Tell your team to do this so it looks and launches like a real app:

**iPhone / iPad (Safari only):**
1. Open the app URL in Safari
2. Tap the **Share** button (box with arrow pointing up)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **Add** — the MAU Audit icon appears on their home screen

**Android (Chrome):**
1. Open the app URL in Chrome
2. Tap the **three-dot menu** (top right)
3. Tap **"Add to Home Screen"** or **"Install app"**
4. Tap **Add** — icon appears on home screen

Once added, it opens full-screen with no browser address bar — indistinguishable from an app.

---

## UPDATING THE APP IN THE FUTURE

If you use **Option B (GitHub)**:
1. Make changes to the code
2. Run `npm run build` to verify it builds without errors
3. Commit and push:
   ```
   git add .
   git commit -m "describe your change"
   git push
   ```
4. Vercel redeploys automatically in ~60 seconds
5. Everyone gets the update the next time they refresh

If you use **Option A (drag & drop)**:
1. Make code changes and run `npm run build`
2. Go to Vercel dashboard → your project → **Deployments** → **Redeploy** or drag the folder again

---

## TROUBLESHOOTING

**"Cannot connect to database" or audits not saving:**
- Check your `.env` file — the Supabase URL and key must be exact (no trailing spaces)
- In Vercel dashboard → your project → **Settings** → **Environment Variables** — verify they're set there too
- Re-deploy after adding environment variables

**"npm install" errors:**
- Make sure Node.js version is 18 or higher: `node --version`
- Try: `npm install --legacy-peer-deps`

**App loads but shows blank screen:**
- Open browser developer tools (F12) → Console tab — look for red errors
- Usually means the Supabase keys are missing or wrong

**"Add to Home Screen" option not showing on iPhone:**
- Must use **Safari** — it does not work in Chrome on iOS

---

## QUESTIONS?
- Vercel docs: https://vercel.com/docs
- Supabase docs: https://supabase.com/docs
