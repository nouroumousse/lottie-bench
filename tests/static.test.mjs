import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('index loads the app as a module', async () => {
  const html = await read('index.html');
  assert.match(html, /<script type="module" src="\.\/src\/app\.mjs"><\/script>/);
});

test('app imports modules using deployment-safe relative paths', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /from '\.\/lottie-core\.mjs'/);
  assert.match(app, /from '\.\/history\.mjs'/);
  assert.match(app, /from '\.\/timeline\.mjs'/);
});

test('timeline does not use the old fixed label width constant', async () => {
  const app = await read('src/app.mjs');
  assert.doesNotMatch(app, /\bLW\b/);
  assert.match(app, /getBoundingClientRect\(\)\.width/);
});

test('preview waits for DOMLoaded and reports data failure or timeout', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /addEventListener\('DOMLoaded',finish\)/);
  assert.match(app, /addEventListener\('data_failed',onFailure\)/);
  assert.match(app, /Preview loading timed out/);
  assert.doesNotMatch(app, /setTimeout\(finish,\s*400\)/);
});

test('JSON export does not run a destructive sanitizer', async () => {
  const app = await read('src/app.mjs');
  const core = await read('src/lottie-core.mjs');
  assert.doesNotMatch(app, /function sanitize\(/);
  assert.match(core, /export function exportAnimation\(animation\)\s*\{\s*return clone\(animation\);/);
});
