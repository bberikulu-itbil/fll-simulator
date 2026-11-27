import test from 'node:test';
import assert from 'node:assert/strict';
import { driveForce, liftCapacityG, physicsOf, G } from '../src/physics.js';
import { Sim, DEFAULT_CONFIG } from '../src/sim.js';

const fork = (ratio = 1) => ({ id: 'a1', port: 'E', motion: 'lift', tool: 'fork', x: 0, y: 100, dir: 'front', len: 90, rest: 'down', cw: 'raises', ratio });
const make = (mass, arm = fork()) => {
  // Piece centre sits 175 mm ahead of the axle: the outer end of the fork.
  const sim = new Sim({ ...DEFAULT_CONFIG, arms: [arm] }, { x: 1000, y: 300, h: 0 },
    [{ id: 'box', name: 'Box', x: 1000, y: 475, w: 30, h: 30, r: 0, mass }]);
  return sim;
};
const raise = (sim, deg) => { for (let a = 1; a <= deg; a++) { if (sim.tryArm('E', a)) return false; sim.arms.E = a; sim.moveCarried(); } return true; };

test('drive force is limited by tyre grip and grows with power until then', () => {
  const p = physicsOf(DEFAULT_CONFIG);
  assert.ok(Math.abs(driveForce(DEFAULT_CONFIG, 100) - p.grip * p.driveLoad * p.massG / 1000 * G) < 1e-9);
  assert.ok(driveForce(DEFAULT_CONFIG, 5) < driveForce(DEFAULT_CONFIG, 100));
  assert.equal(driveForce(DEFAULT_CONFIG, 0), 0);
});
test('gearing down lets an arm lift more', () => {
  assert.ok(liftCapacityG(DEFAULT_CONFIG, fork(1 / 3)) > 2.9 * liftCapacityG(DEFAULT_CONFIG, fork(1)));
});
test('fork picks up a light piece, carries it and sets it down', () => {
  const sim = make(50), box = sim.objects.find(o => o.id === 'box');
  assert.equal(raise(sim, 45), true);
  assert.equal(box.carried, 'E'); assert.ok(box.z > 40);
  sim.pose = { ...sim.pose, x: 1100 }; sim.moveCarried();
  assert.ok(Math.abs(box.x - 1100) < 1e-6);
  sim.arms.E = 0; sim.moveCarried();
  assert.equal(box.carried, undefined); assert.equal(box.z, undefined);
  assert.ok(Math.abs(box.y - 475) < 1e-6);
});
test('a load above the torque limit stays down and stalls the arm', () => {
  const sim = make(900), box = sim.objects.find(o => o.id === 'box');
  assert.equal(raise(sim, 45), false);
  assert.equal(box.carried, undefined);
  assert.match(sim.logLines.at(-1), /too heavy to lift/);
});
test('a flat fork drives under a piece; a plain arm pushes it', () => {
  for (const [tool, moved] of [['fork', false], [undefined, true]]) {
    const sim = new Sim({ ...DEFAULT_CONFIG, arms: [{ ...fork(), tool }] }, { x: 300, y: 300, h: 0 },
      [{ id: 'box', name: 'Box', x: 300, y: 505, w: 30, h: 30, r: 0 }]);
    const next = { x: 300, y: 305, h: 0 };
    assert.equal(sim.tryMove(next), null);
    assert.equal(sim.objects.find(o => o.id === 'box').y !== 505, moved);
  }
});
test('coach limits: too little force or too much speed leaves the model unchanged', () => {
  for (const [limit, done] of [[{ minForce: 99 }, false], [{ maxSpeed: 10 }, false], [{ minForce: 1, maxSpeed: 90 }, true], [undefined, true]]) {
    const sim = new Sim(DEFAULT_CONFIG, { x: 1406, y: 300, h: 0 }, []);
    if (limit) sim.limits.m11 = limit;
    sim.vel = { L: 500, R: 500 };
    sim.touch(sim.objects.find(o => o.key === 'm11'), 'push', [0, 1]);
    sim.runMechanisms(0.004);
    assert.equal(!!sim.mission.m11, done, JSON.stringify(limit));
  }
});

test('the EV3 robot model builds, with and without its fork', async () => {
  const { robotScene, robotMeshData } = await import('../src/robot-3d.js');
  const { EV3_PRESET, normalizeConfig } = await import('../src/sim.js');
  for (const arms of [undefined, []]) {
    const cfg = normalizeConfig(structuredClone(EV3_PRESET)); if (arms) cfg.arms = arms;
    const data = robotMeshData(robotScene(new Sim(cfg)));
    assert.ok(data.polygons.length > 200);
    assert.ok(data.polygons.every(p => p.points.every(q => q.every(Number.isFinite))));
  }
});
