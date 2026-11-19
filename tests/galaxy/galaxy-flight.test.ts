import assert from 'node:assert/strict';
import test from 'node:test';
import { galaxyPoint } from '../../src/lib/galaxy';
import {
  buildBackdrop,
  buildGalaxyModel,
  cameraAt,
  FIELD_OF_VIEW,
  GALAXY_PLACEMENTS,
  galaxyDrift,
  localToWorld,
  lookAt,
  multiply,
  perspective,
  project,
} from '../../src/lib/galaxy-flight';

const KINDS = ['blogs', 'papers', 'photos', 'moments'] as const;

function viewProjection(progress: number, aspect: number) {
  const pose = cameraAt(progress, aspect);
  return multiply(perspective(FIELD_OF_VIEW, aspect, 0.05, 3000), lookAt(pose.eye, pose.target, pose.up));
}

test('galaxy models are deterministic, finite and close to their budget', () => {
  for (const kind of KINDS) {
    const first = buildGalaxyModel(kind, 8000);
    const second = buildGalaxyModel(kind, 8000);
    assert.deepEqual(first.light.polar.slice(0, 30), second.light.polar.slice(0, 30), kind);
    assert.ok(first.light.count > 4000 && first.light.count < 14_000, `${kind}: ${first.light.count}`);
    assert.ok(first.dust.count > 0, `${kind} has dust`);
    for (const set of [first.light, first.dust]) {
      for (const value of [...set.polar, ...set.color, ...set.size, ...set.phase]) assert.ok(Number.isFinite(value), kind);
      for (let index = 0; index < set.count; index++) assert.ok(set.polar[index * 3] < 1.6, `${kind} stays near its radius`);
    }
  }
});

test('the camera route is continuous and rests on each galaxy in turn', () => {
  for (const aspect of [0.5, 1, 1.6, 2.4]) {
    let previous = cameraAt(0, aspect).eye;
    for (let step = 1; step <= 300; step++) {
      const { eye } = cameraAt(step / 100, aspect);
      const jump = Math.hypot(eye[0] - previous[0], eye[1] - previous[1], eye[2] - previous[2]);
      assert.ok(jump < 6, `aspect ${aspect}, progress ${step / 100}: jumped ${jump.toFixed(2)}`);
      previous = eye;
    }
  }
  assert.deepEqual(cameraAt(-5, 1.6), cameraAt(0, 1.6));
  assert.deepEqual(cameraAt(99, 1.6), cameraAt(GALAXY_PLACEMENTS.length - 1, 1.6));
});

test('at rest each galaxy is on screen, right of centre on wide screens and centred on phones', () => {
  GALAXY_PLACEMENTS.forEach((placement, index) => {
    const wide = project(viewProjection(index, 16 / 9), placement.center, 1600, 900);
    assert.ok(wide.depth > 0 && wide.x > 800 && wide.x < 1400 && wide.y > 200 && wide.y < 700, `${placement.kind} wide`);
    const tall = project(viewProjection(index, 390 / 844), placement.center, 390, 844);
    assert.ok(Math.abs(tall.x - 195) < 20 && tall.y > 300 && tall.y < 550, `${placement.kind} phone`);
  });
});

test('post stars on arms, rings and clumps land inside the viewport at rest', () => {
  GALAXY_PLACEMENTS.forEach((placement, index) => {
    const matrix = viewProjection(index, 16 / 9);
    for (let arm = 0; arm < 5; arm++) {
      for (const t of [0, 0.5, 1]) {
        const [u, v] = galaxyPoint(placement.kind, arm, t);
        const point = project(matrix, localToWorld(placement, 0, [u, 0, v]), 1600, 900);
        assert.ok(
          point.depth > 0 && point.x > 0 && point.x < 1600 && point.y > 0 && point.y < 900,
          `${placement.kind} ${arm} ${t}`,
        );
      }
    }
  });
});

test('the backdrop is finite and surrounds the route', () => {
  const backdrop = buildBackdrop(3000);
  assert.ok(backdrop.count > 2000);
  for (const value of backdrop.polar) assert.ok(Number.isFinite(value));
});

test('galaxies float gently: small, smooth drift that moves their stars with them', () => {
  const placement = GALAXY_PLACEMENTS[0];
  let previous = galaxyDrift(0, 0);
  for (let step = 1; step <= 600; step++) {
    const drift = galaxyDrift(0, step / 10);
    assert.ok(Math.abs(drift.lift) < 0.08 && Math.abs(drift.sway) < 0.03 && Math.abs(drift.tilt) < 0.06);
    assert.ok(Math.abs(drift.lift - previous.lift) < 0.01, 'no jumps');
    previous = drift;
  }
  const still = localToWorld(placement, 0, [0, 0, 0]);
  const floated = localToWorld(placement, 0, [0, 0, 0], { lift: 0.05, sway: 0, tilt: 0 });
  assert.ok(Math.abs(floated[1] - still[1] - 0.05 * placement.radius) < 1e-9);
});
