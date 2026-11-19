import assert from 'node:assert/strict';
import test from 'node:test';
import type { SkyEnvironment } from '../../src/lib/sky-catalog';
import { NEBULA_FIELD, NEBULA_STRIDE, nebulaParticles, starLayers } from '../../src/lib/sky-nebula';

const ENVIRONMENTS: SkyEnvironment[] = ['rose', 'gold', 'ring', 'cloud', 'disk', 'milkyway', 'remnant', 'group'];

test('every page sky is deterministic, finite and within a reasonable particle budget', () => {
  for (const env of ENVIRONMENTS) {
    const { colors, data } = nebulaParticles(env);
    assert.deepEqual(nebulaParticles(env).data, data, env);
    assert.equal(data.length % NEBULA_STRIDE, 0, env);
    const count = data.length / NEBULA_STRIDE;
    assert.ok(count > 60_000 && count < 300_000, `${env}: ${count}`);
    for (let index = 0; index < data.length; index += NEBULA_STRIDE) {
      const [x, y, r, alpha, color] = data.subarray(index, index + NEBULA_STRIDE);
      assert.ok(Number.isFinite(x) && Number.isFinite(y) && r > 0 && alpha >= 0 && alpha <= 1, env);
      assert.ok(color < colors.length, env);
      assert.ok(x > -600 && x < NEBULA_FIELD.width + 600 && y > -600 && y < NEBULA_FIELD.height + 600, env);
    }
  }
});

test('the sky is all light: no dark colours anywhere', () => {
  for (const env of ENVIRONMENTS) {
    for (const color of nebulaParticles(env).colors) {
      const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(color.slice(at, at + 2), 16));
      assert.ok(Math.max(r, g, b) > 120, `${env}: ${color}`);
    }
  }
});

test('phones get a lighter sky without the columns', () => {
  const full = nebulaParticles('rose').data.length;
  const light = nebulaParticles('rose', { columns: false, share: 0.5 }).data.length;
  assert.ok(light < full * 0.6);
});

test('star layers reach deeper than the screen, farther layers moving least', () => {
  const depths = starLayers('rose').map((layer) => layer.depth);
  assert.deepEqual(
    depths,
    [...depths].sort((a, b) => a - b),
  );
});
