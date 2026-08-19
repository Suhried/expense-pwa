# Expense Tracker PWA

A native iOS-style expense tracker that runs in the browser and installs on your iPhone home screen.

## Deploy to GitHub Pages (5 minutes)

### Step 1 — Create a GitHub repo
1. Go to github.com → click **New repository**
2. Name it `expense-tracker` (or anything you like)
3. Set to **Public**
4. Click **Create repository**

### Step 2 — Upload the files
1. Click **uploading an existing file** on the repo page
2. Drag ALL files from this ZIP into the upload area
3. Make sure the folder structure is preserved:
   - `index.html`
   - `app.js`
   - `style.css`
   - `manifest.json`
   - `sw.js`
   - `icons/icon-192.png`
   - `icons/icon-512.png`
   - `.github/workflows/deploy.yml`
4. Click **Commit changes**

### Step 3 — Enable GitHub Pages
1. Go to your repo → **Settings** → **Pages**
2. Under **Source** select **GitHub Actions**
3. Wait ~60 seconds for the first deploy

### Step 4 — Get your URL
Your app will be live at:
`https://YOUR-USERNAME.github.io/expense-tracker/`

### Step 5 — Install on iPhone
1. Open the URL in **Safari** on your iPhone
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**

Done! The app icon appears on your home screen and works fully offline.

## Features
- Dashboard with monthly/daily totals and sparkline
- Add expenses with native keypad
- Transactions with search, filter, delete
- Analytics with bar charts and donut chart
- Settings with currency switcher and CSV export
- Full offline support via Service Worker
- Dark mode support
- Data stored locally on your device
