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
