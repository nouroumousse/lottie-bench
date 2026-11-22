/**
 * Lottie document and keyframe utilities.
 *
 * This module deliberately preserves unknown Lottie fields. The editor only
 * exposes controls for a subset of the format; fields it does not understand
 * must survive import/edit/export unchanged.
 */

export const clone = (value) => JSON.parse(JSON.stringify(value));
export const asArr = (value) => Array.isArray(value) ? value.slice() : [value];
export const fmt = (value) => Math.round(Number(value) * 1000) / 1000;
export const cap = (value) => String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
export const S = (value) => ({ a: 0, k: clone(value) });

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const EPSILON = 1e-7;

export function validateAnimation(animation) {
  const errors = [];
  const warnings = [];

  if (!isObject(animation)) {
    return { valid: false, errors: ['The JSON root must be an object.'], warnings };
  }

  for (const field of ['w', 'h', 'fr', 'op']) {
    if (!finite(animation[field])) errors.push(`Missing or invalid "${field}".`);
  }
  if (finite(animation.w) && animation.w <= 0) errors.push('Composition width must be greater than zero.');
  if (finite(animation.h) && animation.h <= 0) errors.push('Composition height must be greater than zero.');
  if (finite(animation.fr) && animation.fr <= 0) errors.push('Frame rate must be greater than zero.');
  if (!Array.isArray(animation.layers)) errors.push('The animation must contain a "layers" array.');

  if (finite(animation.op) && finite(animation.ip ?? 0) && animation.op <= (animation.ip ?? 0)) {
    errors.push('The out point must be later than the in point.');
  }

  if (Array.isArray(animation.layers)) {
    const ids = new Set();
    const byId = new Map();
    for (const [index, layer] of animation.layers.entries()) {
      if (!isObject(layer)) {
        errors.push(`Layer ${index + 1} is not an object.`);
        continue;
      }
      if (layer.ind != null) {
        if (ids.has(layer.ind)) errors.push(`Duplicate layer index "${layer.ind}".`);
        ids.add(layer.ind);
        byId.set(layer.ind, layer);
      }
      if (layer.parent != null && layer.parent === layer.ind) {
        errors.push(`Layer "${layer.nm || layer.ind || index + 1}" cannot parent itself.`);
      }
      if (finite(layer.ip) && finite(layer.op) && layer.op <= layer.ip) {
        warnings.push(`Layer "${layer.nm || layer.ind || index + 1}" has an empty or reversed time range.`);
      }
    }
    for (const layer of animation.layers) {
      if (!isObject(layer) || layer.parent == null || layer.parent === layer.ind) continue;
      if (!byId.has(layer.parent)) warnings.push(`Layer "${layer.nm || layer.ind}" refers to missing parent index "${layer.parent}".`);
      const seenParents = new Set([layer.ind]);
      let parent = layer.parent;
      while (byId.has(parent)) {
        if (seenParents.has(parent)) {
          warnings.push(`Layer parenting contains a cycle involving layer "${layer.nm || layer.ind}".`);
          break;
        }
        seenParents.add(parent);
        parent = byId.get(parent).parent;
        if (parent == null) break;
      }
    }
  }

  walkObjects(animation, (value) => {
    if (value.a !== 1 || !Array.isArray(value.k) || value.k.length === 0) return;
    const keyframes = value.k;
    if (!keyframes.every(isObject)) {
      errors.push('An animated property contains a non-object keyframe.');
      return;
    }
    let previousTime = -Infinity;
    const sameTimeCounts = new Map();
    keyframes.forEach((keyframe, index) => {
      if (!finite(keyframe.t)) {
        errors.push('An animated property contains a keyframe with an invalid frame time.');
        return;
      }
      if (keyframe.t < previousTime) warnings.push('A keyframe sequence is not sorted by ascending frame time.');
      previousTime = keyframe.t;
      const count = (sameTimeCounts.get(keyframe.t) || 0) + 1;
      sameTimeCounts.set(keyframe.t, count);
      if (count > 2) warnings.push(`More than two keyframes share frame ${keyframe.t}.`);
      if (index < keyframes.length - 1 && keyframe.h !== 1 && (!keyframe.i || !keyframe.o)) {
        warnings.push(`Keyframe at frame ${keyframe.t} is missing interpolation tangents.`);
      }
    });
  });

  return { valid: errors.length === 0, errors, warnings: [...new Set(warnings)] };
}

function baseTransform(width, height) {
  return {
    o: S(100), r: S(0), p: S([width / 2, height / 2, 0]),
    a: S([0, 0, 0]), s: S([100, 100, 100]),
  };
}

function normalizeLayerStack(layers, animation, scopeName) {
  const seen = new Set(layers.filter((layer) => layer && layer.ind != null).map((layer) => layer.ind));
  let nextIndex = Math.max(0, ...[...seen].filter(finite)) + 1;

  for (const [index, layer] of layers.entries()) {
    if (!isObject(layer)) throw new Error(`${scopeName} layer ${index + 1} must be an object.`);
    if (layer.ind == null) {
      while (seen.has(nextIndex)) nextIndex += 1;
      layer.ind = nextIndex;
      seen.add(nextIndex);
      nextIndex += 1;
    }
    if (!layer.ks && [0, 1, 2, 3, 4, 5].includes(layer.ty)) {
      layer.ks = baseTransform(animation.w, animation.h);
    }
    if (layer.ip == null) layer.ip = animation.ip;
    if (layer.op == null) layer.op = animation.op;
    if (layer.st == null) layer.st = 0;
    if (layer.sr == null) layer.sr = 1;
  }
}

/** Validate and add only safe defaults. Never rewrite keyframes or unknown data. */
export function normalizeAnimation(input) {
  if (!isObject(input)) throw new Error('The JSON root must be an object.');
  const animation = clone(input);
  if (!Array.isArray(animation.layers)) throw new Error('Not a Lottie animation: no "layers" array.');

  for (const field of ['w', 'h', 'fr', 'op']) {
    if (!finite(animation[field])) throw new Error(`Missing or invalid "${field}".`);
  }
  if (animation.w <= 0 || animation.h <= 0 || animation.fr <= 0) {
    throw new Error('Composition width, height, and frame rate must be greater than zero.');
  }
  if (animation.ip == null) animation.ip = 0;
  if (!finite(animation.ip)) throw new Error('Invalid composition in point.');
  if (animation.op <= animation.ip) throw new Error('The composition out point must be later than the in point.');
  if (!Array.isArray(animation.assets)) animation.assets = [];
  if (!Array.isArray(animation.markers)) animation.markers = [];
  if (typeof animation.nm !== 'string' || !animation.nm.trim()) animation.nm = 'Composition';

  normalizeLayerStack(animation.layers, animation, 'Composition');
  for (const [index, asset] of animation.assets.entries()) {
    if (isObject(asset) && Array.isArray(asset.layers)) {
      normalizeLayerStack(asset.layers, animation, `Precomposition ${asset.nm || asset.id || index + 1}`);
    }
  }

  const validation = validateAnimation(animation);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return animation;
}

/** A lossless JSON-safe clone suitable for preview and export. */
export function exportAnimation(animation) {
  return clone(animation);
}

export function walkObjects(value, visitor) {
  if (Array.isArray(value)) {
    for (const item of value) walkObjects(item, visitor);
    return;
  }
  if (isObject(value)) {
    visitor(value);
    for (const child of Object.values(value)) walkObjects(child, visitor);
  }
}

export function isKeyframeProperty(property) {
  return isObject(property) && property.a === 1 && Array.isArray(property.k) &&
    property.k.length > 0 && isObject(property.k[0]) && finite(property.k[0].t);
}

function componentAt(value, index, fallback) {
  if (Array.isArray(value)) {
    if (finite(value[index])) return value[index];
    const last = value[value.length - 1];
    return finite(last) ? last : fallback;
  }
  return finite(value) ? value : fallback;
}

/** Cubic Bezier easing. X control points are clamped by the Lottie format; Y may overshoot. */
export function bezierProgress(x1, y1, x2, y2, progress) {
  const t = Math.max(0, Math.min(1, progress));
  if (t === 0 || t === 1) return t;
  x1 = Math.max(0, Math.min(1, finite(x1) ? x1 : 0));
  x2 = Math.max(0, Math.min(1, finite(x2) ? x2 : 1));
  y1 = finite(y1) ? y1 : 0;
  y2 = finite(y2) ? y2 : 1;

  const cubic = (a, b, u) => 3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u ** 2 * b + u ** 3;
  let low = 0;
  let high = 1;
  let u = t;
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const x = cubic(x1, x2, u);
    if (Math.abs(x - t) < 1e-7) break;
    if (x < t) low = u;
    else high = u;
    u = (low + high) / 2;
  }
  return cubic(y1, y2, u);
}

export function easingProgress(keyframe, progress, dimension = 0) {
  if (!keyframe || keyframe.h === 1) return 0;
  const out = keyframe.o || { x: [0], y: [0] };
  const incoming = keyframe.i || { x: [1], y: [1] };
  const x1 = componentAt(out.x, dimension, 0);
  const y1 = componentAt(out.y, dimension, 0);
  const x2 = componentAt(incoming.x, dimension, 1);
  const y2 = componentAt(incoming.y, dimension, 1);
  return bezierProgress(x1, y1, x2, y2, progress);
}

function interpolateDeep(start, end, progress, dimension = 0) {
  if (finite(start) && finite(end)) return start + (end - start) * progress;
  if (Array.isArray(start) && Array.isArray(end)) {
    return start.map((value, index) => interpolateDeep(value, end[index] ?? value, progress, index));
  }
  if (isObject(start) && isObject(end)) {
    const result = {};
    for (const [key, value] of Object.entries(start)) {
      result[key] = key in end ? interpolateDeep(value, end[key], progress, dimension) : clone(value);
    }
    return result;
  }
  return clone(start);
}

function readKeyframeStart(keyframes, index) {
  const current = keyframes[index];
  if (current?.s != null) return current.s;
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    if (keyframes[previous]?.e != null) return keyframes[previous].e;
    if (keyframes[previous]?.s != null) return keyframes[previous].s;
  }
  return 0;
}

function readKeyframeEnd(keyframes, index) {
  const current = keyframes[index];
  if (current?.e != null) return current.e;
  const next = keyframes[index + 1];
  if (next?.s != null) return next.s;
  return readKeyframeStart(keyframes, index);
}

function spatialInterpolate(start, end, keyframe, next, progress) {
  if (!Array.isArray(start) || !Array.isArray(end) || !Array.isArray(keyframe.to) || !Array.isArray(next?.ti)) {
    return null;
  }
  if (start.length < 2 || end.length < 2) return null;
  const u = Math.max(0, Math.min(1, progress));
  const result = start.map((value, index) => {
    const p0 = finite(value) ? value : 0;
    const p3 = finite(end[index]) ? end[index] : p0;
    const p1 = p0 + (finite(keyframe.to[index]) ? keyframe.to[index] : 0);
    const p2 = p3 + (finite(next.ti[index]) ? next.ti[index] : 0);
    const inv = 1 - u;
    return inv ** 3 * p0 + 3 * inv ** 2 * u * p1 + 3 * inv * u ** 2 * p2 + u ** 3 * p3;
  });
  return result;
}

/** Evaluate a Lottie property at its local frame, preserving split and vector semantics. */
export function getValue(property, frame) {
  if (!property || typeof property !== 'object' || !('k' in property)) return 0;
  if (property.a !== 1 || !Array.isArray(property.k)) return property.k;

  const keyframes = property.k;
  if (keyframes.length === 0) return 0;
  if (keyframes.length === 1) return readKeyframeStart(keyframes, 0);

  if (frame <= keyframes[0].t) return readKeyframeStart(keyframes, 0);
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const current = keyframes[index];
    const next = keyframes[index + 1];
    if (!finite(current.t) || !finite(next.t)) continue;
    if (frame < next.t) {
      const start = readKeyframeStart(keyframes, index);
      if (current.h === 1 || next.t <= current.t) return start;
      const end = readKeyframeEnd(keyframes, index);
      const rawProgress = (frame - current.t) / (next.t - current.t);
      const isVector = Array.isArray(start);
      if (isVector && current.to && next.ti) {
        const p = easingProgress(current, rawProgress, 0);
        const spatial = spatialInterpolate(start, end, current, next, p);
        if (spatial) return spatial;
      }
      if (isVector) {
        return start.map((value, dimension) => {
          const p = easingProgress(current, rawProgress, dimension);
          return interpolateDeep(value, Array.isArray(end) ? (end[dimension] ?? value) : value, p, dimension);
        });
      }
      return interpolateDeep(start, end, easingProgress(current, rawProgress, 0));
    }
  }
  return readKeyframeStart(keyframes, keyframes.length - 1);
}

export function newKeyframe(frame, value, dimensions = null) {
  const values = asArr(value);
  const count = Math.max(1, dimensions || values.length || 1);
  return {
    t: frame,
    s: values,
    o: { x: Array(count).fill(0.42), y: Array(count).fill(0) },
    i: { x: Array(count).fill(0.58), y: Array(count).fill(1) },
  };
}

export function addKey(property, frame, value) {
  if (!property || typeof property !== 'object') throw new Error('Cannot keyframe a missing property.');
  if (property.a !== 1 || !Array.isArray(property.k) ||
      (property.k.length > 0 && !isObject(property.k[0]))) {
    const initialValue = clone(property.k ?? value);
    property.a = 1;
    property.k = [newKeyframe(frame, initialValue)];
    return property.k[0];
  }

  const keyframes = property.k;
  const existingIndex = keyframes.findIndex((keyframe) => Math.abs(keyframe.t - frame) < EPSILON);
  if (existingIndex >= 0) {
    keyframes[existingIndex].s = asArr(value);
    if (existingIndex > 0 && keyframes[existingIndex - 1].e != null) {
      keyframes[existingIndex - 1].e = clone(keyframes[existingIndex].s);
    }
    return keyframes[existingIndex];
  }

  const keyframe = newKeyframe(frame, value);
  const insertAt = keyframes.findIndex((candidate) => candidate.t > frame);
  const index = insertAt < 0 ? keyframes.length : insertAt;
  const previous = keyframes[index - 1];
  if (previous?.e != null) previous.e = clone(keyframe.s);
  keyframes.splice(index, 0, keyframe);
  return keyframe;
}

export function writeRow(row, compositionFrame, value) {
  const property = row.property || row.prop;
  if (!property || typeof property !== 'object') throw new Error('Cannot edit a missing property.');
  const localFrame = Math.round((compositionFrame - (row.offset ?? row.off ?? 0)) * 100) / 100;
  if (property.a !== 1 || !Array.isArray(property.k)) {
    property.a = 0;
    property.k = row.kind === 'num' ? value : clone(value);
    return null;
  }

  const index = property.k.findIndex((keyframe) => Math.abs(keyframe.t - localFrame) < EPSILON);
  if (index >= 0) {
    property.k[index].s = asArr(value);
    if (index > 0 && property.k[index - 1].e != null) property.k[index - 1].e = clone(property.k[index].s);
    return property.k[index];
  }
  return addKey(property, localFrame, value);
}

function collapseProperty(row, value) {
  row.prop.a = 0;
  if (row.kind === 'num') row.prop.k = Array.isArray(value) ? value[0] : value;
  else row.prop.k = clone(Array.isArray(value) ? value : [value]);
}

export function toggleAnim(row, compositionFrame) {
  const property = row.prop;
  const localFrame = Math.round((compositionFrame - (row.off || 0)) * 100) / 100;
  if (property.a !== 1 || !Array.isArray(property.k)) {
    const current = clone(property.k);
    property.a = 1;
    property.k = [newKeyframe(localFrame, current)];
    return;
  }
  collapseProperty(row, getValue(property, localFrame));
}

export function removeKey(row, index) {
  const property = row.prop;
  if (!property || !Array.isArray(property.k) || index < 0 || index >= property.k.length) return;
  const removed = property.k[index];
  const previous = property.k[index - 1];
  const next = property.k[index + 1];
  if (previous?.e != null && next?.s != null) previous.e = clone(next.s);
  property.k.splice(index, 1);
  if (property.k.length === 0) collapseProperty(row, removed.s ?? 0);
}

const EASING = {
  lin: [0, 0, 1, 1],
  in: [0.42, 0, 1, 1],
  out: [0, 0, 0.58, 1],
  io: [0.42, 0, 0.58, 1],
};

export function K(list) {
  return {
    a: 1,
    k: list.map(([frame, value, easing = 'io']) => {
      const curve = EASING[easing] || EASING.io;
      const values = asArr(value);
      const count = Math.max(1, values.length);
      return {
        t: frame,
        s: values,
        o: { x: Array(count).fill(curve[0]), y: Array(count).fill(curve[1]) },
        i: { x: Array(count).fill(curve[2]), y: Array(count).fill(curve[3]) },
      };
    }),
  };
}

function shiftValue(value, dx, dy) {
  if (!Array.isArray(value)) return value;
  const next = clone(value);
  if (finite(next[0])) next[0] += dx;
  if (finite(next[1])) next[1] += dy;
  return next;
}

function shiftVectorProperty(property, dx, dy) {
  if (!property || typeof property !== 'object') return;
  if (property.a !== 1 || !Array.isArray(property.k)) {
    property.k = shiftValue(property.k, dx, dy);
    return;
  }
  for (const keyframe of property.k) {
    if (keyframe.s != null) keyframe.s = shiftValue(keyframe.s, dx, dy);
    if (keyframe.e != null) keyframe.e = shiftValue(keyframe.e, dx, dy);
  }
}

function shiftScalarProperty(property, delta) {
  if (!property || typeof property !== 'object') return;
  const shift = (value) => {
    if (Array.isArray(value)) return value.map((number, index) => index === 0 && finite(number) ? number + delta : number);
    return finite(value) ? value + delta : value;
  };
  if (property.a !== 1 || !Array.isArray(property.k)) {
    property.k = shift(property.k);
    return;
  }
  for (const keyframe of property.k) {
    if (keyframe.s != null) keyframe.s = shift(keyframe.s);
    if (keyframe.e != null) keyframe.e = shift(keyframe.e);
  }
}

export function shiftPos(layer, dx, dy) {
  const position = layer?.ks?.p;
  if (!position || (!dx && !dy)) return;
  if (position.s) {
    shiftScalarProperty(position.x, dx);
    shiftScalarProperty(position.y, dy);
  } else {
    shiftVectorProperty(position, dx, dy);
  }
}

/** Used by the custom easing editor; exposes a normalized single-dimension curve. */
export function easingHandles(keyframe, dimension = 0) {
  const out = keyframe?.o || { x: [0], y: [0] };
  const incoming = keyframe?.i || { x: [1], y: [1] };
  return [
    componentAt(out.x, dimension, 0), componentAt(out.y, dimension, 0),
    componentAt(incoming.x, dimension, 1), componentAt(incoming.y, dimension, 1),
  ];
}