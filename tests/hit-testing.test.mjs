import test from 'node:test';
import assert from 'node:assert/strict';
import { findLayerFromTarget, findLayerFromTargets } from '../src/hit-testing.mjs';

function node(parent = null) {
  return { parentNode: parent, nodeType: 1, contains(target) {
    let item=target;
    while(item){ if(item===this) return true; item=item.parentNode; }
    return false;
  } };
}
function element(base) { return { getBaseElement: () => base }; }

test('a nested SVG path resolves to the matching Lottie layer', () => {
  const root=node(), group=node(root), path=node(group);
  const layers=[{ind:1,ty:4,nm:'Shape'}];
  assert.equal(findLayerFromTarget(path,[element(group)],layers),layers[0]);
});

test('overlapping SVG layers resolve to the topmost matching Lottie layer', () => {
  const root=node(), back=node(root), front=node(root), path=node(front);
  const layers=[{ind:1,ty:4,nm:'Back'},{ind:2,ty:4,nm:'Front'}];
  assert.equal(findLayerFromTarget(path,[element(back),element(front)],layers),layers[1]);
});

test('locked and hidden top layers fall through to the next element under the pointer', () => {
  const root=node(), back=node(root), front=node(root), frontPath=node(front), backPath=node(back);
  const layers=[{ind:1,ty:4,nm:'Back'},{ind:2,ty:4,nm:'Front'}];
  const rendered=[element(back),element(front)];
  assert.equal(findLayerFromTarget(frontPath,rendered,layers,{2:true}),null);
  assert.equal(findLayerFromTargets([frontPath,backPath],rendered,layers,{2:true}),layers[0]);
  layers[1].hd=true;
  assert.equal(findLayerFromTargets([frontPath,backPath],rendered,layers),layers[0]);
});

test('unmapped SVG descendants and empty renderer entries return null', () => {
  const root=node(), path=node(root);
  assert.equal(findLayerFromTarget(path,[true],[{ind:1,ty:4}]),null);
  assert.equal(findLayerFromTarget(null,[],[]),null);
});

test('target stack ignores unrelated overlay elements and keeps searching', () => {
  const root=node(), back=node(root), path=node(back), overlay=node();
  const layers=[{ind:1,ty:4,nm:'Back'}];
  assert.equal(findLayerFromTargets([overlay,path],[element(back)],layers),layers[0]);
});
