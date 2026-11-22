import test from 'node:test';
import assert from 'node:assert/strict';
import { findLayerFromTarget } from '../src/hit-testing.mjs';

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

test('locked or hidden layers do not intercept selection', () => {
  const root=node(), back=node(root), front=node(root), path=node(front);
  const layers=[{ind:1,ty:4,nm:'Back'},{ind:2,ty:4,nm:'Front'}];
  assert.equal(findLayerFromTarget(path,[element(back),element(front)],layers,{2:true}),layers[0]);
  layers[1].hd=true;
  assert.equal(findLayerFromTarget(path,[element(back),element(front)],layers),layers[0]);
});

test('unmapped SVG descendants and empty renderer entries return null', () => {
  const root=node(), path=node(root);
  assert.equal(findLayerFromTarget(path,[true],[{ind:1,ty:4}]),null);
  assert.equal(findLayerFromTarget(null,[],[]),null);
});
