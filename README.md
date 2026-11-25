# Highway Racer 3D

Endless 3D highway racer (Three.js + Vite). Dodge traffic, chain near misses, reach 220 km/h.
Touch: drag the wheel, hold the right pedal. Keyboard: arrows/WASD, Space = brake.
Modes: Endless, Time Attack, 10 Missions. Collect coins, buy upgrades in the SHOP, try the two-way road for x2 score.

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs /dist
```

## Deploy to GitHub Pages (automatic)
```bash
git init
git add .
git commit -m "Stage 1: playable highway racer"
git branch -M main
git remote add origin https://github.com/<YOUR_USER>/<YOUR_REPO>.git
git push -u origin main
```
Then in the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Every push to `main` builds and publishes to `https://<YOUR_USER>.github.io/<YOUR_REPO>/`.
Track builds in the **Actions** tab.

See **STAGES.md** for what is done, what is next, and a hand-off prompt for any other AI/platform.


## Stage 5 — install, pause and native wrapper

- The game can be installed as a PWA from a supported browser. The service worker caches the app shell and same-origin assets after they are first loaded online.
- Use the **⛶** control to request fullscreen and landscape orientation. Support depends on the browser and device.
- Press **P** or **Escape**, or tap **Ⅱ**, to pause. Hidden tabs auto-pause the race.
- Use **SHARE SCORE** after a run. If the device does not offer a share sheet, the score text is copied when clipboard access is available.
- The leaderboard stores local device records by default. To enable shared online scores, create a Supabase table named `scores` with columns `player_name` (text), `score` (int8), `mode` (text), `distance` (int8), `car` (text), and `created_at` (timestamptz, default now()). Configure public read/insert policies with suitable validation, then add the project URL and anon key to `public/leaderboard-config.js`. Never put a service-role key in the client.
- Capacitor is configured for Android and iOS. After installing dependencies: `npx cap add android` or `npx cap add ios`, then `npm run build` and `npx cap sync`. Native builds still require their respective SDK toolchains.
