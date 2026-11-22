import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('index loads the app as a module', async () => {
  const html = await read('index.html');
  assert.match(html, /<script type="module" src="\.\/src\/app\.mjs"><\/script>/);
});

test('timeline has a fixed transport column and a separate ruler viewport', async () => {
  const html = await read('index.html');
  assert.match(html, /id="timeline-left"/);
  assert.match(html, /id="tlrulerViewport"/);
  assert.match(html, /id="tlruler"/);
  assert.match(html, /id="tlRulerPh"/);
  assert.match(html, /grid-template-rows:80px minmax\(0,1fr\)/);
  assert.match(html, /width:398px;min-width:398px;max-width:398px/);
});

test('app imports all editor modules using deployment-safe relative paths', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /from '\.\/lottie-core\.mjs'/);
  assert.match(app, /from '\.\/history\.mjs'/);
  assert.match(app, /from '\.\/timeline\.mjs'/);
  assert.match(app, /from '\.\/hit-testing\.mjs'/);
});

test('timeline uses the header column as the shared coordinate origin', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /const left=\$\('#timeline-left'\)/);
  assert.match(app, /clientXToFrame\(clientX,inner\.left,st\.comp\.ip,st\.ppf,timelineLabelWidth\(\)\)/);
  assert.match(app, /ruler\.style\.transform='translateX\('\+\(-sc\.scrollLeft\)/);
});

test('nested vector and animated property rows are generated in the timeline', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /function timelineEntriesForLayer/);
  assert.match(app, /row\.item\.ty/);
  assert.match(app, /row\.prop&&row\.prop\.a/);
  assert.match(app, /class:'track',style:'width:'\+W\+'px'/);
});

test('canvas hit-testing maps descendant SVG nodes back to their source layer', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /findLayerFromTarget\(target,elements,curLayers\(\),st\.locked\)/);
  assert.match(app, /target\?\.closest\?\.\('\.lot'\)/);
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
