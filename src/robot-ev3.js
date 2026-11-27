// The team's LEGO EV3 robot, modelled by eye from six photos. Sizes follow the Robot tab
// (wheel, track, robotW, robotL, axleBack); everything else is an approximation, not LEGO CAD.
// Robot-local mm: x right, y forward from the wheel axle, z up.
import { armLocalPoint } from './robot-3d.js';

const GREY = ['#8d969c', '#c9d0d4', '#dde2e5'], LIGHT = ['#aeb6bb', '#e3e7e9', '#f1f3f4'];
const BLACK = ['#16191c', '#262b2f', '#353b40'], YELLOW = ['#b98a06', '#e6b20f', '#f7c820'];
const AZURE = ['#1d86a6', '#35aecd', '#52c2de'], RED = ['#8f1f18', '#c4342a', '#da4b3f'];

export function drawEv3(kit, scene) {
  const { box, beam, face, line, circle } = kit, c = scene.cfg;
  const back = -c.axleBack, front = c.robotL - c.axleBack, half = c.robotW / 2, r = c.wheel / 2;
  const innerW = Math.min(half - 8, c.track / 2 - 12);

  // A wheel on a transverse axle: tyre ring, rim and three spokes.
  const wheel = (x, y, radius, width, tyre, rim, spoke, angle, label) => {
    const n = 24, ring = xx => Array.from({ length: n }, (_, i) => [xx, y + Math.cos(i * 2 * Math.PI / n) * radius, radius + Math.sin(i * 2 * Math.PI / n) * radius]);
    const a = ring(x - width / 2), b = ring(x + width / 2);
    for (let i = 0; i < n; i++) face([a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]], tyre, tyre, label);
    for (const [points, xx] of [[a, x - width / 2], [b, x + width / 2]]) {
      const decals = [{ points: circle([xx, y, radius], radius * .72, 'yz'), fill: rim }];
      for (let j = 0; j < 3; j++) {
        const t = (angle + j * 120) * Math.PI / 180, at = (d, o) => [xx, y + Math.cos(t + o) * d, radius + Math.sin(t + o) * d];
        decals.push({ points: [at(radius * .15, -.3), at(radius * .66, -.13), at(radius * .66, .13), at(radius * .15, .3)], fill: spoke });
      }
      decals.push({ points: circle([xx, y, radius], radius * .13, 'yz'), fill: '#9aa3a8' });
      face(points, tyre, tyre, label, decals);
    }
  };

  // Drive: azure-tyred wheels at the back, two large motors lying side by side between them.
  for (const w of scene.wheels) wheel(w.x, 0, r, 14, '#45bcd9', '#1b1f22', '#41484d', w.angle, 'wheel ' + w.port);
  for (const side of [-1, 1]) {
    const mx = side * innerW * .45;
    box(mx, 22, r - 14, innerW * .72, 74, 28, GREY, 'EV3 large motor');
    box(mx, 0, r - 17, innerW * .74, 30, 34, LIGHT, 'EV3 large motor head');
    box(side * (innerW * .86), 0, r - 12, 7, 24, 24, RED, 'motor output');
    line([side * innerW * .86, 0, r], [side * (c.track / 2 - 6), 0, r], '#2c3236', 6, 'drive axle');
  }

  // Black chassis frame, azure rear beam and the angled white corner braces under the robot.
  for (const side of [-1, 1]) {
    beam(side * innerW, (front + back) / 2 + 8, 12, 8, c.robotL - 24, 8, BLACK, 'chassis beam');
    line([side * innerW, front - 38, 10], [side * (innerW - 24), front - 8, 10], '#e3e7e9', 7, 'corner brace');
    line([side * innerW, 26, 10], [side * (innerW - 20), 50, 10], '#e3e7e9', 7, 'corner brace');
  }
  for (const y of [44, front - 8]) box(0, y, 12, innerW * 2, 8, 8, BLACK, 'chassis cross beam');
  box(0, back + 5, r + 10, innerW * 2 + 16, 9, 9, AZURE, 'rear beam');

  // Small free-running front wheels.
  const smallR = Math.max(9, r * .42);
  for (const side of [-1, 1]) {
    wheel(side * (innerW + 12), front - 20, smallR, 7, '#14171a', '#e8ecee', '#aab2b7', 0, 'small front wheel');
    line([side * innerW, front - 20, smallR], [side * (innerW + 12), front - 20, smallR], '#555d62', 4);
  }

  // Black side walls with the yellow beam along their top.
  const wallBack = 40, wallLen = front - wallBack - 4;
  for (const side of [-1, 1]) {
    box(side * (innerW + 1), wallBack + wallLen / 2, 28, 8, wallLen, 40, BLACK, 'side wall');
    box(side * (innerW + 1), wallBack + wallLen / 2, 69, 9, wallLen, 9, YELLOW, 'side top beam');
  }

  // Front attachment face: black frame, two white square mounts, yellow beam with red pins.
  const fy = front - 3;
  for (const z of [20, 62]) box(0, fy, z, innerW * 2 + 10, 6, 7, BLACK, 'front frame');
  for (const x of [-innerW - 1, 0, innerW + 1]) box(x, fy, 27, 8, 6, 35, BLACK, 'front frame');
  for (const side of [-1, 1]) {
    const x = side * innerW * .5, w = innerW * .72;
    for (const z of [31, 55]) box(x, fy + 4, z, w, 6, 6, LIGHT, 'front mount');
    for (const dx of [-w / 2 + 3, w / 2 - 3]) box(x + dx, fy + 4, 37, 6, 6, 18, LIGHT, 'front mount');
    box(x, fy + 1, 39, w * .48, 3, 14, GREY, 'front mount core');
  }
  box(0, fy, 70, innerW * 2 + 12, 9, 9, YELLOW, 'front top beam');
  for (let i = -3; i <= 3; i++) if (i) box(i * innerW / 3.5, fy + 5.5, 72, 5, 3, 5, RED, 'pin');

  // EV3 intelligent brick across the back: screen on the robot's left side, button pad on its right (as seen in the photos).
  const by = back + 40, bz = r + 20, bw = Math.min(112, c.robotW - 24), bl = 72, bh = 38, top = bz + bh + .2;
  const rect = (x, y, w, l, z) => [[x - w / 2, y - l / 2, z], [x + w / 2, y - l / 2, z], [x + w / 2, y + l / 2, z], [x - w / 2, y + l / 2, z]];
  const lid = [
    { points: rect(0, by, bw - 10, bl - 10, top), fill: '#9aa4aa' },
    { points: rect(-bw * .2, by, bw * .44, bl * .68, top), fill: '#2f363a' },
    { points: rect(-bw * .2, by, bw * .38, bl * .56, top), fill: '#a9bda6' },
    { points: circle([bw * .24, by, top], 19), fill: '#dfe4e7' },
    { points: rect(bw * .24, by, 9, 28, top), fill: '#3a4247' },
    { points: rect(bw * .24, by, 28, 9, top), fill: '#3a4247' },
    { points: rect(bw * .24, by, 10, 10, top), fill: '#5b656b' }
  ];
  const rearFace = [
    { points: [[-30, by - bl / 2, bz + 17], [-12, by - bl / 2, bz + 17], [-12, by - bl / 2, bz + 24], [-30, by - bl / 2, bz + 24]], fill: '#30373b' },
    { points: [[8, by - bl / 2, bz + 18], [30, by - bl / 2, bz + 18], [30, by - bl / 2, bz + 22], [8, by - bl / 2, bz + 22]], fill: '#30373b' }
  ];
  box(0, by, bz, bw, bl, bh, ['#9ea7ad', '#dfe4e6', '#eef0f1'], 'EV3 brick', p => p, { 1: rearFace, 5: lid });
  for (let i = 0; i < 4; i++) box((i - 1.5) * 20, by + bl / 2 + 2, bz + 12, 12, 4, 13, BLACK, 'EV3 port');

  // Large yellow perforated plate over the front half, with two black knobs.
  const pBack = by + bl / 2 + 4, pLen = Math.max(24, front - 8 - pBack), pW = innerW * 2 + 10, holes = [];
  const cols = Math.floor(pW / 8) - 1, rows = Math.floor(pLen / 8) - 1;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) holes.push({ points: circle([(i - (cols - 1) / 2) * 8, pBack + pLen / 2 + (j - (rows - 1) / 2) * 8, 84.2], 2.1, 'xy', 8), fill: '#6d5305' });
  box(0, pBack + pLen / 2, 78, pW, pLen, 6, YELLOW, 'yellow plate', p => p, { 5: holes });
  for (const side of [-1, 1]) box(side * pW * .27, front - 22, 84, 8, 8, 9, BLACK, 'knob');

  // Motor cables.
  for (const side of [-1, 1]) {
    const path = [[side * 18, 58, r + 8], [side * (innerW - 6), 66, r + 24], [side * (innerW - 10), by + 50, bz + 10], [side * 20, by + bl / 2 + 4, bz + 14]];
    for (let i = 1; i < path.length; i++) line(path[i - 1], path[i], '#101214', 3.5, 'cable');
  }

  // Attachments from the Robot tab (not on the photographed robot): a flat fork or a hoop.
  for (const arm of scene.arms) {
    const moving = p => armLocalPoint(arm, p), w = arm.tool === 'fork' ? arm.width || 48 : 56;
    for (const side of [-1, 1]) beam(side * (w / 2 - 4), arm.len / 2, -3, 7, arm.len, 6, BLACK, 'attachment tine ' + arm.port, moving);
    line(moving([-w / 2, 6, 0]), moving([w / 2, 6, 0]), '#b9c1c6', 6, 'attachment axle');
    if (arm.tool !== 'fork') line(moving([-w / 2, arm.len - 4, 0]), moving([w / 2, arm.len - 4, 0]), '#b9c1c6', 6, 'hoop bar');
  }
}
