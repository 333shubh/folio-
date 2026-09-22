import * as THREE from "three";

/**
 * Steering behaviours, as the reference uses them.
 *
 * Its bundle ships Yuka: a `Vehicle` per moving thing, a `SeekBehavior` and
 * a `PursuitBehavior`, run by an entity manager. This is the same handful
 * of formulas written out, which is a few dozen lines against a library
 * whose other ninety percent - navmeshes, fuzzy logic, state machines,
 * goal-driven agents - this page has no use for.
 *
 * The model is the standard one. A behaviour proposes a *desired* velocity;
 * the steering force is the difference between that and the current
 * velocity; the force is capped at `maxForce`, divided by mass to get
 * acceleration, integrated into velocity, and the velocity is capped at
 * `maxSpeed`. Everything that makes the bee feel like an animal rather than
 * a tween falls out of those caps: it cannot turn instantly because the
 * force is limited, and it overshoots because it has momentum.
 */

export type Body = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mass: number;
  maxForce: number;
  maxSpeed: number;
};

export function makeBody(
  mass: number,
  maxForce: number,
  maxSpeed: number
): Body {
  return {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    mass,
    maxForce,
    maxSpeed,
  };
}

/** Scratch, so the frame loop allocates nothing. */
const desired = new THREE.Vector3();
const displacement = new THREE.Vector3();
const predicted = new THREE.Vector3();
const force = new THREE.Vector3();

/**
 * Seek: head straight at a point, at full speed.
 *
 * Note that the force is the *difference* from the current velocity, not
 * the direction to the target. That is what makes a body already moving
 * the wrong way spend its force turning around rather than accelerating
 * sideways, and it is the whole difference between steering and homing.
 */
export function seek(body: Body, target: THREE.Vector3, out: THREE.Vector3) {
  desired.subVectors(target, body.position);
  if (desired.lengthSq() > 1e-12) desired.normalize().multiplyScalar(body.maxSpeed);
  out.subVectors(desired, body.velocity);
}

/**
 * Pursue: head at where the quarry is going to be.
 *
 * The lead time is the gap divided by the closing speed, so a distant or
 * fast evader is led further. The reference passes a prediction factor of
 * 5, which is a deliberately large lead - the bee swings wide and comes
 * back rather than trailing the fruit in a straight line.
 *
 * The special case is worth keeping: when the two are almost head-on and
 * the evader is in front, leading the target sends the pursuer off to one
 * side for no reason, so it just goes straight at it.
 */
export function pursue(
  body: Body,
  evader: Body,
  predictionFactor: number,
  out: THREE.Vector3
) {
  displacement.subVectors(evader.position, body.position);

  const heading = body.velocity.lengthSq() > 1e-12
    ? desired.copy(body.velocity).normalize()
    : desired.set(0, 0, 1);
  const ahead = displacement.dot(heading) > 0;

  const evaderSpeed = evader.velocity.length();
  const facing =
    evaderSpeed > 1e-6 &&
    heading.dot(predicted.copy(evader.velocity).normalize()) < -0.95;

  if (ahead && facing) {
    seek(body, evader.position, out);
    return;
  }

  const lookAhead =
    (displacement.length() / (body.maxSpeed + evaderSpeed)) * predictionFactor;
  predicted.copy(evader.velocity).multiplyScalar(lookAhead).add(evader.position);
  seek(body, predicted, out);
}

/**
 * Integrate one step.
 *
 * Both caps are applied in the order the model needs them: the force is
 * clamped before it becomes acceleration, and the velocity after. Clamping
 * only one of them gives a body that can either turn on a pin or never
 * stop, and neither looks alive.
 */
export function integrate(body: Body, steering: THREE.Vector3, delta: number) {
  force.copy(steering).clampLength(0, body.maxForce);
  // acceleration = F / m
  force.divideScalar(Math.max(body.mass, 1e-6));
  body.velocity.addScaledVector(force, delta).clampLength(0, body.maxSpeed);
  body.position.addScaledVector(body.velocity, delta);

  /*
   * A backstop against a body that has gone non-finite.
   *
   * Velocity is capped, so a body can only diverge if something upstream
   * hands it a target that is already infinite or NaN - and once a single
   * NaN reaches a matrix, three.js propagates it through the whole graph
   * and the tab can take the renderer down with it. Catching it here costs
   * two comparisons a frame and turns a crash into a body that quietly
   * restarts from the origin.
   */
  if (!isFinite(body.position.lengthSq()) || !isFinite(body.velocity.lengthSq())) {
    body.position.set(0, 0, 0);
    body.velocity.set(0, 0, 0);
  }
}

/**
 * Framerate-independent exponential approach.
 *
 * `1 - exp(-rate * dt)` covers the same fraction of the remaining distance
 * per second whatever the refresh rate, which a bare `lerp(a, b, 0.1)` per
 * frame does not - that one moves twice as fast on a 120Hz panel.
 */
export function approach(rate: number, delta: number) {
  return 1 - Math.exp(-rate * delta);
}

/**
 * Elastic ease-out, matching GSAP's `elastic.out(amplitude, period)`.
 *
 * The reference springs the fruit back from its landing squash with
 * `elastic.out(1.25)` over 1.25 seconds. This is that curve: an decaying
 * sine, normalised so it starts at 0 and settles at 1.
 */
export function elasticOut(t: number, amplitude = 1.25, period = 0.3) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const s = (period / (2 * Math.PI)) * Math.asin(1 / Math.max(amplitude, 1));
  return (
    amplitude * Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / period) +
    1
  );
}
