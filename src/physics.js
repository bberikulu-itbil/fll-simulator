// Simplified statics: how hard the robot can push and how much an attachment can lift.
// Every constant is an ESTIMATE until measured on the real robot (editable on the Robot tab).
export const G = 9.81;
export const PHYSICS_DEFAULTS = Object.freeze({
  massG: 800,        // robot mass, grams
  grip: 0.8,         // tyre-to-mat friction coefficient
  driveLoad: 0.7,    // share of the weight resting on the driven wheels
  driveTorque: 40,   // stall torque of one drive motor, N·cm
  armTorque: 20,     // stall torque of the attachment motor, N·cm
  armMassG: 40,      // mass of the attachment itself, grams
  slide: 0.4         // loose-piece-to-mat friction coefficient
});
export const PIECE_MASS = Object.freeze({ keystone: 60, seed: 5, other: 30 }); // grams

export const physicsOf = cfg => ({ ...PHYSICS_DEFAULTS, ...(cfg.physics || {}) });
const power = pct => Math.min(100, Math.abs(pct)) / 100;

// Newtons: the smaller of what two motors can deliver and what the tyres can grip.
export function driveForce(cfg, pct) {
  const p = physicsOf(cfg);
  const motors = 2 * (p.driveTorque / 100) * power(pct) / (cfg.wheel / 2000);
  return Math.min(motors, p.grip * p.driveLoad * (p.massG / 1000) * G);
}
// Output torque in N·m. arm.ratio = arm degrees per motor degree, so a smaller ratio is stronger.
const armTorqueNm = (cfg, arm, pct) => (physicsOf(cfg).armTorque / 100) * power(pct) / (arm.ratio || 1);
export const sweepForce = (cfg, arm, pct) => armTorqueNm(cfg, arm, pct) / (arm.len / 1000);
// Grams the tip of a horizontal lift arm can raise (its own weight acts at mid length).
export function liftCapacityG(cfg, arm, pct = 100) {
  const holding = armTorqueNm(cfg, arm, pct) / (G * arm.len / 1000) * 1000;
  return Math.max(0, holding - physicsOf(cfg).armMassG / 2);
}
export const pieceMass = o => o.mass ?? (o.seed ? PIECE_MASS.seed : o.id === 'keystone' ? PIECE_MASS.keystone : PIECE_MASS.other);
export const slideForce = (cfg, o) => physicsOf(cfg).slide * pieceMass(o) / 1000 * G;
