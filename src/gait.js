/**
 * The first-person walker's pace. One step length drives both the camera bob
 * and the footstep sounds, so what is seen and what is heard stay in step.
 */
export const WALK_SPEED = 3.6;
export const SPRINT_SPEED = 7.5;

/** Metres per step: about 1.3 m at an easy run, 1.8 m at a sprint. */
export function strideLength(speed) {
  return .8 + Math.min(1, Math.max(0, speed) / SPRINT_SPEED);
}
