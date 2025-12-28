# Mastermind (Offline iPhone Ready)

A lightweight Mastermind game that can be installed on an iPhone and played fully offline after the first load.

## Run locally

```bash
# From the project root
python -m http.server 8080
```

Then open <http://localhost:8080> in a desktop browser.

## Install on iPhone for offline play

1. Start a local server on your computer (example above).
2. Make your iPhone and computer use the same network.
3. Find your computer's local IP address (for example `192.168.1.50`).
4. On iPhone Safari, open `http://<your-ip>:8080`.
5. Wait for the page to fully load once (this caches the assets for offline use).
6. Tap the **Share** button → **Add to Home Screen**.
7. Launch the app from the home screen.
8. Turn on Airplane Mode to confirm the game still loads and plays offline.

## Notes

- Offline support is powered by a service worker that precaches the HTML, CSS, JS, and icons.
- iOS home screen icons are supplied as an SVG to avoid binary assets in the repo.
- If you update files, you may need to reload once while online to refresh the cache.

## Tests

```bash
npm test
```
