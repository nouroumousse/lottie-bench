# Lottie Bench

A lightweight, browser-based editor for Lottie animation JSON. Built as a static app with a clean, light interface inspired by a compact motion-design workspace.

## Features

- Import Lottie JSON by file picker or drag and drop
- Add rectangle, ellipse, star, polygon, solid, and null layers
- Draw custom vector paths
- Edit layer names, visibility, locking, parenting, timing, and transforms
- Edit shape geometry, fills, strokes, and modifiers
- Animate supported properties with keyframes
- Edit cubic Bézier easing with presets
- Scrub, loop, and preview at variable speed
- Duplicate, reorder, delete, undo, and redo
- Configure composition size, frame rate, and duration
- Edit and validate raw animation JSON
- Export Lottie JSON and rendered SVG frames
- Save the current composition locally in the browser

## Run locally

No build step or package installation is required. Serve the project directory with a static server:

```bash
python3 -m http.server 4173
```

Open <http://localhost:4173>.

## Deploy

This is a static site and can be deployed directly to Vercel. Use the repository root as the project root, with no build command. The included `vercel.json` configures a clean static deployment.

## Notes

- Preview rendering loads Lottie Web 5.13.0 from jsDelivr, so an internet connection is required for the animation renderer.
- Properties without dedicated inspector controls remain accessible in the raw JSON editor.
- Autosave is local to the current browser profile; export JSON to keep a portable copy.

## License

MIT. See `LICENSE`.
