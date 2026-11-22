/**
 * Resolve rendered SVG targets to their source Lottie layer.
 * SVGRenderer.elements is indexed in the same order as animationData.layers.
 * Walk each target's ancestors so paths and nested groups resolve to their owner.
 */
function baseElementOf(rendererElement) {
  if (!rendererElement || rendererElement === true) return null;
  try {
    if (typeof rendererElement.getBaseElement === 'function') {
      const base = rendererElement.getBaseElement();
      if (base && base.nodeType === 1) return base;
    }
  } catch (_) {}
  const base = rendererElement.layerElement || rendererElement.baseElement || null;
  return base && base.nodeType === 1 ? base : null;
}

export function findLayerFromTarget(target, rendererElements, layers, locked = {}) {
  if (!target || !Array.isArray(rendererElements) || !Array.isArray(layers)) return null;
  const ancestors = new Set();
  let node = target;
  while (node) {
    ancestors.add(node);
    node = node.parentNode || node.host || null;
  }
  const count = Math.min(rendererElements.length, layers.length);
  // Reverse order gives front-most layer priority for overlapping hit regions.
  for (let index = count - 1; index >= 0; index -= 1) {
    const layer = layers[index];
    if (!layer || layer.hd || locked[layer.ind]) continue;
    const base = baseElementOf(rendererElements[index]);
    if (!base) continue;
    if (ancestors.has(base)) return layer;
    if (typeof base.contains === 'function' && base.contains(target)) return layer;
  }
  return null;
}

export function findLayerFromTargets(targets, rendererElements, layers, locked = {}) {
  if (!Array.isArray(targets)) return null;
  for (const target of targets) {
    const layer = findLayerFromTarget(target, rendererElements, layers, locked);
    if (layer) return layer;
  }
  return null;
}
