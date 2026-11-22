import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAnimation, validateAnimation, exportAnimation, getValue, addKey,
  writeRow, toggleAnim, removeKey, shiftPos, bezierProgress, easingHandles,
} from '../src/lottie-core.mjs';
import { SnapshotHistory } from '../src/history.mjs';
import { timelineScale, frameToTimelineX, clientXToFrame } from '../src/timeline.mjs';

const composition = (layers = []) => ({
  v: '5.7.5', fr: 60, ip: 0, op: 60, w: 512, h: 512,
  nm: 'Test', assets: [], layers,
});
const linear = { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } };

test('normalization preserves keyframe end values and unknown fields without mutating input', () => {
  const input = composition([{ ind: 1, ty: 3, custom: 'preserve', ks: {
    p: { a: 1, k: [{ t: 0, s: [0, 0], e: [100, 50], ...linear }, { t: 10, s: [100, 50], ...linear }] },
  } }]);
  const before = JSON.stringify(input);
  const normalized = normalizeAnimation(input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(normalized.layers[0].ks.p.k[0].e, [100, 50]);
  assert.equal(normalized.layers[0].custom, 'preserve');
});

test('normalization rejects invalid composition dimensions and malformed input', () => {
  assert.throws(() => normalizeAnimation(null), /root must be an object/i);
  assert.throws(() => normalizeAnimation({ ...composition(), w: 0 }), /greater than zero/i);
  assert.equal(validateAnimation(composition()).valid, true);
});

test('validation catches duplicate layer indices and warns about unsorted keyframes', () => {
  const result = validateAnimation(composition([
    { ind: 1, ty: 3, ks: { o: { a: 1, k: [{ t: 10, s: [1] }, { t: 0, s: [0] }] } } },
    { ind: 1, ty: 3 },
  ]));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => /duplicate layer index/i.test(entry)));
  assert.ok(result.warnings.some((entry) => /not sorted/i.test(entry)));
});

test('interpolation uses current keyframe end before next keyframe start', () => {
  const property = { a: 1, k: [
    { t: 0, s: [0], e: [100], ...linear },
    { t: 10, s: [200], ...linear },
  ] };
  assert.deepEqual(getValue(property, 5), [50]);
  assert.deepEqual(getValue(property, 10), [200]);
});

test('interpolation falls back to next keyframe start if segment end is omitted', () => {
  const property = { a: 1, k: [
    { t: 0, s: [0], ...linear },
    { t: 10, s: [100], ...linear },
  ] };
  assert.deepEqual(getValue(property, 5), [50]);
});

test('hold keyframes keep their value until the following keyframe', () => {
  const property = { a: 1, k: [
    { t: 0, s: [7], h: 1, ...linear },
    { t: 10, s: [20], ...linear },
  ] };
  assert.deepEqual(getValue(property, 9), [7]);
  assert.deepEqual(getValue(property, 10), [20]);
});

test('spatial position interpolation uses outgoing and incoming spatial tangents', () => {
  const property = { a: 1, k: [
    { t: 0, s: [0, 0], e: [100, 0], to: [0, 100], ...linear },
    { t: 10, s: [100, 0], ti: [0, 100], ...linear },
  ] };
  const value = getValue(property, 5);
  assert.ok(Math.abs(value[0] - 50) < 1e-8);
  assert.ok(Math.abs(value[1] - 75) < 1e-8);
});

test('Bezier interpolation is stable at endpoints and linear for linear handles', () => {
  assert.equal(bezierProgress(0, 0, 1, 1, 0), 0);
  assert.equal(bezierProgress(0, 0, 1, 1, 1), 1);
  assert.ok(Math.abs(bezierProgress(0, 0, 1, 1, 0.35) - 0.35) < 1e-5);
});

test('vector easing handles are read independently per dimension', () => {
  const keyframe = {
    o: { x: [0.2, 0.4], y: [0, 0.3] },
    i: { x: [0.8, 0.6], y: [1, 0.9] },
  };
  assert.deepEqual(easingHandles(keyframe, 1), [0.4, 0.3, 0.6, 0.9]);
});

test('adding a key to a static vector property creates a valid first keyframe', () => {
  const property = { a: 0, k: [12, 24, 0] };
  addKey(property, 8, [30, 40, 0]);
  assert.equal(property.a, 1);
  assert.equal(property.k.length, 1);
  assert.deepEqual(property.k[0].s, [12, 24, 0]);
});

test('writeRow inserts keyframes in frame order and updates the selected key', () => {
  const row = { kind: 'num', off: 0, prop: { a: 1, k: [
    { t: 0, s: [0], ...linear }, { t: 10, s: [10], ...linear },
  ] } };
  writeRow(row, 5, 5);
  assert.deepEqual(row.prop.k.map((item) => item.t), [0, 5, 10]);
  writeRow(row, 5, 8);
  assert.deepEqual(row.prop.k[1].s, [8]);
});

test('toggling animation on and off preserves the property value', () => {
  const row = { kind: 'num', off: 0, prop: { a: 0, k: 12 } };
  toggleAnim(row, 4);
  assert.equal(row.prop.a, 1);
  toggleAnim(row, 4);
  assert.equal(row.prop.a, 0);
  assert.equal(row.prop.k, 12);
});

test('removing a keyframe does not shift the remaining keyframe time', () => {
  const row = { kind: 'num', off: 0, prop: { a: 1, k: [
    { t: 0, s: [1], ...linear }, { t: 12, s: [2], ...linear },
  ] } };
  removeKey(row, 0);
  assert.equal(row.prop.a, 1);
  assert.equal(row.prop.k[0].t, 12);
});

test('split-dimension position offset moves animated values and explicit ends', () => {
  const layer = { ks: { p: { s: true,
    x: { a: 1, k: [{ t: 0, s: [10], e: [20] }] },
    y: { a: 1, k: [{ t: 0, s: [30], e: [40] }] },
  } } };
  shiftPos(layer, 5, -7);
  assert.deepEqual(layer.ks.p.x.k[0].e, [25]);
  assert.deepEqual(layer.ks.p.y.k[0].e, [33]);
});

test('export keeps one-key animated properties unchanged', () => {
  const input = composition([{ ind: 1, ty: 3, ks: {
    o: { a: 1, k: [{ t: 3, s: [50], e: [60], ...linear, extra: true }] },
  } }]);
  const output = exportAnimation(normalizeAnimation(input));
  assert.deepEqual(output.layers[0].ks.o, input.layers[0].ks.o);
});

test('snapshot history handles undo, redo and redo invalidation after a new edit', () => {
  const history = new SnapshotHistory(3);
  history.record('A');
  history.record('B');
  assert.equal(history.undo('C'), 'B');
  assert.equal(history.redo('B'), 'C');
  history.record('D');
  assert.equal(history.canRedo, false);
});

test('timeline scale and coordinate conversion are inverse', () => {
  for (const labelWidth of [278, 326]) {
    const metrics = timelineScale({ viewportWidth: 1200, labelWidth, duration: 120, zoom: 1.5 });
    const frame = 43.5;
    const x = frameToTimelineX(frame, 10, metrics.pixelsPerFrame, labelWidth);
    const actual = clientXToFrame(x, 0, 10, metrics.pixelsPerFrame, labelWidth);
    assert.ok(Math.abs(frame - actual) < 1e-8);
  }
});
