# Lottie Bench

A lightweight, browser-based editor for working directly with Lottie animation JSON. The interface is arranged around a layers panel, central artboard, inspector, and timeline.

## Features

- Import Lottie `.json` files by selecting a file or dropping it onto the editor
- Create rectangle, ellipse, star, polygon, solid, and null layers
- Draw custom vector paths with the pen tool
- Edit layer names, timing, visibility, parenting, transforms, shape geometry, fills, and strokes
- Animate supported properties with keyframes
- Adjust keyframe easing with a draggable cubic Bézier editor and easing presets
- Scrub and preview animations with playback speed and looping controls
- Duplicate, reorder, and delete layers; undo and redo edits
- Change composition dimensions, frame rate, in/out points, and preview background
- Edit the animation JSON directly, validate it, and apply changes
- Export the animation as `.json` or the current rendered frame as `.svg`
- Automatically save the current composition in this browser's local storage

## Run locally

No build step or package installation is required. Serve this folder with any static web server, for example:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

You can also open `index.html` directly in a modern browser. A local server is recommended for the smoothest file and browser API behavior.

## Deploy

This is a static site. Import the repository into Vercel with no build command and the project root (`.`) as the output directory. `vercel.json` contains the minimal static-site settings.

## Important notes

- The live preview uses the Lottie Web 5.13.0 player loaded from jsDelivr, so a network connection is required for rendering previews.
- The editor is a focused JSON workbench, not a replacement for After Effects or Bodymovin. Imported animation features that do not have dedicated inspector controls can still be retained and edited in the raw JSON panel.
- Autosave is local to the browser profile on the current device. It is not cloud sync or a substitute for exporting project files.
- The Share action copies the current animation JSON to the clipboard.