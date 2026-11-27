// Saved robots and attachments. A file from a computer or a link may come from anyone, so every
// value is checked and only known settings are kept (they are later shown in the page).
import { DEFAULT_CONFIG, normalizeConfig } from './sim.js';
import { PORTS, PAIRS } from './blocks.js';
import { PHYSICS_DEFAULTS, physicsOf } from './physics.js';

export const ROBOTS_KEY = 'bioglow-robots-v1';
export const ATTACHMENTS_KEY = 'bioglow-attachments-v1';
export const MAX_ITEM_FILE = 100 * 1024;
const MAX_ARMS = 8;
const FACES = ['front', 'right', 'back', 'left'];

const bad = what => { throw new Error(`Invalid value in the robot data: ${what}`); };
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const number = (v, min, max, what) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : bad(what);
const choice = (v, options, what) => options.includes(v) ? v : bad(what);
const point = (v, what) => record(v) ? { x: number(v.x, -2000, 2000, what), y: number(v.y, -2000, 2000, what) } : bad(what);

function cleanArms(list) {
  if (!Array.isArray(list) || list.length > MAX_ARMS) bad('arms');
  const ids = new Set();
  return list.map((a, i) => {
    if (!record(a)) bad('arm');
    const motion = a.motion === undefined ? 'lift' : choice(a.motion, ['lift', 'sweep'], 'motion');
    let id = typeof a.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(a.id) ? a.id : 'a' + (i + 1);
    while (ids.has(id)) id += '-' + i;
    ids.add(id);
    const arm = {
      id, port: choice(a.port, PORTS, 'port'), motion,
      ...point(a, 'arm position'),
      dir: choice(a.dir ?? 'front', FACES, 'direction'),
      len: number(a.len, 1, 2000, 'length'),
      rest: choice(a.rest ?? 'up', ['up', 'down'], 'start position'),
      cw: choice(a.cw ?? (motion === 'sweep' ? 'right' : 'lowers'), motion === 'sweep' ? ['right', 'left'] : ['lowers', 'raises'], 'turn direction'),
      ratio: number(a.ratio ?? 1, 0.001, 1000, 'gear ratio')
    };
    if (motion === 'lift' && a.tool !== undefined) arm.tool = choice(a.tool, ['hoop', 'fork'], 'tool');
    if (a.width !== undefined) arm.width = number(a.width, 1, 1000, 'fork width');
    return arm;
  });
}

export function cleanRobot(input) {
  if (!record(input)) bad('robot');
  const c = normalizeConfig(structuredClone(input));
  const out = {
    wheel: number(c.wheel, 1, 2000, 'wheel'), track: number(c.track, 1, 2000, 'wheel spacing'),
    top: number(c.top, 1, 100000, 'top speed'), ramp: number(c.ramp, 0, 600, 'speed-up time'),
    robotW: number(c.robotW, 1, 3000, 'width'), robotL: number(c.robotL, 1, 3000, 'length'),
    axleBack: number(c.axleBack, -3000, 3000, 'axle position'),
    pair: choice(c.pair, PAIRS, 'drive motors'),
    colorPort: choice(c.colorPort, PORTS, 'color sensor port'), distPort: choice(c.distPort, PORTS, 'distance sensor port'),
    forcePort: choice(c.forcePort, ['none', ...PORTS], 'force sensor port'),
    color: point(c.color, 'color sensor'),
    dist: { ...point(c.dist, 'distance sensor'), dir: choice(c.dist.dir, FACES, 'distance sensor direction') },
    arms: cleanArms(c.arms)
  };
  for (const k of ['yawCW', 'collide', 'shove']) out[k] = Boolean(c[k] ?? DEFAULT_CONFIG[k]);
  if (c.model !== undefined) out.model = choice(c.model, ['ev3'], 'model');
  if (c.physics !== undefined) {
    if (!record(c.physics)) bad('physics');
    out.physics = {};
    for (const k of Object.keys(PHYSICS_DEFAULTS)) if (c.physics[k] !== undefined) out.physics[k] = number(c.physics[k], 0, 1000000, k);
  }
  return out;
}

// An attachment is the set of arms (tools) on the robot, plus how heavy the attachment is.
export function cleanAttachment(input) {
  if (!record(input)) bad('attachment');
  const arms = cleanArms(input.arms);
  if (!arms.length) throw new Error('The robot has no attachment to save. Add an arm first.');
  return { arms, armMassG: number(input.armMassG, 0, 100000, 'attachment mass') };
}
export const takeAttachment = cfg => cleanAttachment({ arms: cfg.arms, armMassG: physicsOf(cfg).armMassG });
export function fitAttachment(cfg, attachment) {
  const { arms, armMassG } = cleanAttachment(attachment);
  cfg.arms = arms;
  cfg.physics = { ...cfg.physics, armMassG };
}
// Attachment motors that share a port with the wheels or a sensor.
export function portClashes(cfg) {
  const used = new Set([...cfg.pair, cfg.colorPort, cfg.distPort, cfg.forcePort]);
  return [...new Set(cfg.arms.map(a => a.port).filter(p => used.has(p)))];
}

// The file a team keeps on a computer or sends to another one.
const TYPES = { robot: cleanRobot, attachment: cleanAttachment };
export function encodeItemFile(type, name, data) {
  return JSON.stringify({ app: 'bioglow-sim', type, version: 1, name, data: TYPES[type](data) }, null, 2) + '\n';
}
export function decodeItemFile(text) {
  if (typeof text !== 'string' || text.length > MAX_ITEM_FILE) throw new Error('This is not a robot or attachment file.');
  let file;
  try { file = JSON.parse(text); } catch { file = null; }
  if (!record(file) || file.app !== 'bioglow-sim' || file.version !== 1 || !Object.hasOwn(TYPES, file.type) || typeof file.name !== 'string')
    throw new Error('This is not a robot or attachment file.');
  return { type: file.type, name: file.name.slice(0, 60), data: TYPES[file.type](file.data) };
}
export const itemFileName = (name, type) => (String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^[. ]+|[. ]+$/g, '') || type) + `.${type}.json`;
