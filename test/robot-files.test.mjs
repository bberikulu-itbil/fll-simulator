import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanRobot, cleanAttachment, takeAttachment, fitAttachment, portClashes, encodeItemFile, decodeItemFile, itemFileName } from '../src/robot-files.js';
import { DEFAULT_CONFIG, EV3_PRESET, normalizeConfig } from '../src/sim.js';

const ev3 = () => structuredClone(EV3_PRESET);

test('both starting robots pass unchanged', () => {
  for (const cfg of [ev3(), structuredClone(DEFAULT_CONFIG)]) {
    const clean = cleanRobot(cfg);
    for (const key of Object.keys(cfg)) assert.deepEqual(clean[key], cfg[key], key);
  }
});

test('a robot file round-trips with its physics numbers', () => {
  const cfg = { ...ev3(), track: 119.5, physics: { massG: 910, grip: 0.7, armMassG: 0 } };
  const back = decodeItemFile(encodeItemFile('robot', 'Біздің робот', cfg));
  assert.equal(back.type, 'robot'); assert.equal(back.name, 'Біздің робот');
  assert.deepEqual(back.data, cleanRobot(cfg));
  assert.equal(back.data.physics.armMassG, 0);
});

test('markup, unknown settings and bad values never get in', () => {
  const evil = '<img src=x onerror=alert(1)>';
  for (const change of [
    c => c.arms[0].port = evil, c => c.arms[0].dir = evil, c => c.arms[0].tool = evil, c => c.pair = evil,
    c => c.colorPort = evil, c => c.wheel = evil, c => c.track = '100', c => c.wheel = 0, c => c.dist.dir = evil,
    c => c.model = evil, c => c.physics = { massG: evil }, c => c.arms[0].len = Infinity, c => c.arms = 'none'
  ]) {
    const cfg = ev3(); change(cfg);
    assert.throws(() => cleanRobot(cfg), /Invalid value/, change.toString());
  }
  const extra = { ...ev3(), hacked: evil };
  extra.arms = [{ ...extra.arms[0], id: evil, note: evil }];
  assert.ok(!JSON.stringify(cleanRobot(extra)).includes('<img'));
});

test('arms that lost their ids (share links drop them) get new, different ones', () => {
  const cfg = ev3(); cfg.arms = [cfg.arms[0], { ...cfg.arms[0], port: 'F' }].map(({ id, ...a }) => a);
  const ids = cleanRobot(cfg).arms.map(a => a.id);
  assert.equal(new Set(ids).size, 2);
});

test('an attachment moves to another robot and leaves the rest of it alone', () => {
  const donor = { ...ev3(), physics: { armMassG: 75 } };
  donor.arms = [{ ...donor.arms[0], len: 120 }, { id: 'b', port: 'F', motion: 'sweep', x: 10, y: 100, dir: 'left', len: 80, rest: 'up', cw: 'left', ratio: 2 }];
  const attachment = decodeItemFile(encodeItemFile('attachment', 'M01', takeAttachment(donor))).data;
  const robot = { ...normalizeConfig(), physics: { massG: 640 } };
  fitAttachment(robot, attachment);
  assert.deepEqual(robot.arms.map(a => [a.port, a.len]), [['E', 120], ['F', 80]]);
  assert.deepEqual(robot.physics, { massG: 640, armMassG: 75 });
  assert.equal(robot.track, DEFAULT_CONFIG.track);
  robot.arms[0].len = 1;
  assert.equal(attachment.arms[0].len, 120, 'the saved attachment is not edited through the robot');
});

test('an attachment needs at least one arm, and clashing ports are reported', () => {
  assert.throws(() => takeAttachment({ ...ev3(), arms: [] }), /no attachment/);
  assert.throws(() => cleanAttachment({ arms: ev3().arms, armMassG: -1 }), /Invalid value/);
  const cfg = ev3(); cfg.arms[0].port = 'A';
  assert.deepEqual(portClashes(cfg), ['A']);
  assert.deepEqual(portClashes(ev3()), []);
});

test('other files are refused, and file names are safe', () => {
  for (const text of ['', 'hello', '{}', '{"app":"bioglow-sim","version":1,"type":"constructor","name":"x","data":{}}', 'x'.repeat(200000)])
    assert.throws(() => decodeItemFile(text), /not a robot or attachment file/);
  assert.equal(itemFileName('Миссия: 1/2', 'robot'), 'Миссия_ 1_2.robot.json');
  assert.equal(itemFileName('..', 'attachment'), 'attachment.attachment.json');
});
