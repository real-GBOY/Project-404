# Walkthrough video (Arabic, captions only, no audio)

`record.mjs` drives the real system in Chrome and records it, with an on-screen layer from `overlay.mjs` (Arabic captions,
visible cursor, highlight rings, chapter cards). Labels come from the app's own string tables (`ar.mjs`), so the script
follows the UI when its text changes. It records on a throw-away database, never on production.

```bash
# 1. a seeded backend on :3399 (resets the raqib_video database; run from raqib/web)
bash video/reset-stack.sh
# 2. the client-demo build on :4599 (proxying /api to :3399)
VITE_DEMO=true VITE_DEMO_SCOPE=client npx vite build
VITE_DEMO=true RAQIB_API_PROXY_TARGET=http://localhost:3399 npx vite preview --port 4599 --strictPort &
# 3. rehearse fast (screenshots in <dir>), then record for real (needs a fresh reset-stack first)
node video/record.mjs ../video-out/dry --dry
node video/record.mjs ../video-out/raw
# 4. encode (trims the blank first second; no audio track)
ffmpeg -ss 0.9 -i ../video-out/raw/*.webm -an -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart ../video-out/raqib-walkthrough-ar.mp4
```

Output lives in `raqib/video-out/` (git-ignored). Re-record after UI changes; edit the captions in `record.mjs`.
