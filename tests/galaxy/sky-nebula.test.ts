import assert from 'node:assert/strict';
import test from 'node:test';
import type { SkyEnvironment } from '../../src/lib/sky-catalog';
import { nebulaSvg, starLayers } from '../../src/lib/sky-nebula';

const ENVIRONMENTS: SkyEnvironment[] = ['rose', 'gold', 'ring', 'cloud', 'disk', 'milkyway', 'remnant', 'group'];

test('every page sky is deterministic and has its dust columns', () => {
  for (const env of ENVIRONMENTS) {
    const svg = nebulaSvg(env);
    assert.equal(svg, nebulaSvg(env), env);
    assert.equal(svg.match(/class="sky-pillars"/g)?.length, 3, env);
    assert.match(svg, /feDiffuseLighting/, env);
    assert.doesNotMatch(svg, /NaN|undefined/, env);
  }
});

test('each page has its own sky', () => {
  const skies = new Set(ENVIRONMENTS.map((env) => nebulaSvg(env)));
  assert.equal(skies.size, ENVIRONMENTS.length);
});

test('star layers reach deeper than the screen, farther layers moving least', () => {
  const depths = starLayers('rose').map((layer) => layer.depth);
  assert.deepEqual(
    depths,
    [...depths].sort((a, b) => a - b),
  );
  for (const layer of starLayers('rose')) assert.doesNotMatch(layer.shadow, /NaN/);
});
