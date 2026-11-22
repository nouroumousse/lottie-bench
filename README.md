# Lottie Bench

A browser-based Lottie JSON workbench with a compact motion-editor interface: layers on the left, artboard in the centre, inspector on the right, and a timeline along the bottom.

## Features

- Import `.json` Lottie files through the file picker or drag and drop
- Create rectangle, ellipse, star, polygon, solid, and null layers
- Draw custom vector paths with the pen tool
- Edit layer name, parent, visibility, timing, transforms, shape geometry, fills, and strokes
- Animate supported properties with keyframes
- Edit cubic Bézier easing per vector or colour component, with easing presets
- Scrub, loop, and preview animations at variable speed
- Duplicate, reorder, and delete layers; undo and redo
- Change composition size, frame rate, in/out points, and preview background
- Inspect and edit the source JSON directly
- Validate composition essentials and flag suspicious keyframe ordering, missing easing tangents, duplicate indices, and parent references
- Export Lottie JSON or the current rendered frame as SVG
- Autosave the working composition in the current browser profile

## Architecture

The app is a static ES-module project with no build step and no runtime framework dependency.

```text
index.html
src/
  app.mjs          UI, DOM events, inspector, stage, import/export orchestration
  lottie-core.mjs  Lottie normalization, lossless export, keyframe and easing math
  history.mjs      Bounded undo/redo snapshots
  timeline.mjs     Timeline scale and coordinate conversion
 tests/
  core.test.mjs    Core model, keyframe, interpolation, history, and timeline tests
  static.test.mjs  Static app wiring and regression checks
```

The core keeps a JSON-safe clone of imported documents and adds only safe defaults. Unknown Lottie fields are preserved on export; keyframe end values (`e`), metadata, and single-key animated properties are not stripped or collapsed. The inspector intentionally exposes a subset of Lottie controls, so features without dedicated controls remain available in the raw JSON editor.

## Run locally

Serve the project directory over HTTP (ES modules are not supported reliably from a `file://` URL):

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Checks and tests

Node.js 20 or newer is recommended. There are no test dependencies.

```bash
npm run check
npm test
```

The test suite covers import/export preservation, malformed documents, legacy segment end values, linear and hold interpolation, per-component easing, spatial position tangents, keyframe editing, undo/redo, timeline coordinate conversion, and static app wiring.

## Deploy

This is a static site. Import the repository into Vercel with the repository root as the project root and no build command. The project uses relative module paths and includes `vercel.json` for static deployment.

## Runtime notes and limits

- Live preview uses Lottie Web 5.13.0 from jsDelivr. Preview rendering therefore needs a network connection; JSON editing and export do not depend on the player being loaded.
- The official Lottie specification is still being expanded. This editor preserves unknown data rather than trying to rewrite every possible Lottie feature.
- This is not a complete replacement for After Effects or Bodymovin. Text, masks, gradients, expressions, and some advanced shape/layer features do not have dedicated inspector tools yet, although their JSON fields are retained during ordinary edits.
- Autosave is local to this browser profile; it is not cloud sync. Export important work as JSON.
- The Share control copies the current animation JSON to the clipboard.

## Open-source references

The project uses the official Lottie Web player for preview and takes architectural/testing inspiration from [Lottie Open Studio](https://github.com/marciogranzotto/lottie-tools), an MIT-licensed open-source editor. No source code from that project is copied into this repository.

The Lottie format reference is the [official Lottie specification](https://lottie.github.io/lottie-spec/latest/single-page/).