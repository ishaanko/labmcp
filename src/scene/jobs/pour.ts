import { setTarget } from "../visualStore";
import type { Schedule, Vec3, VesselSnapshot } from "../animationQueue";

const TILT_RAD = (38 * Math.PI) / 180;

/**
 * Human/agent transfer between two vessels (C5 `POUR`): lift beside the target, tilt and
 * stream, tilt back, then return to the rest pose. Each stage just retargets `pose`/volume and
 * lets the driver's damp draw the motion between them, so a grab mid-pour (a future phase)
 * only has to stop scheduling further stages.
 */
export function pourJob(
  schedule: Schedule,
  from: VesselSnapshot & { readonly restPose: Vec3 },
  to: VesselSnapshot & { readonly pos: Vec3 },
  ml: number,
  reducedMotion: boolean,
): void {
  if (reducedMotion) {
    setTarget(from.id, { displayedVolumeMl: from.volumeMl, displayedColor: from.color });
    setTarget(to.id, { displayedVolumeMl: to.volumeMl, displayedColor: to.color });
    return;
  }

  const streamMs = Math.min(600, Math.max(240, 200 + ml * 6));
  const side = to.pos.x >= from.restPose.x ? -0.7 : 0.7;
  const liftPose = { x: to.pos.x + side, y: 1.15, z: to.pos.z, tiltRad: 0 };

  setTarget(from.id, { pose: liftPose });
  schedule(from.id, 220, () => {
    setTarget(from.id, { pose: { ...liftPose, tiltRad: TILT_RAD } });
    setTarget(to.id, { displayedVolumeMl: to.volumeMl, displayedColor: to.color });
  });
  schedule(from.id, 220 + streamMs, () => {
    setTarget(from.id, { pose: { ...liftPose, tiltRad: 0 } });
    setTarget(from.id, { displayedVolumeMl: from.volumeMl, displayedColor: from.color });
  });
  schedule(from.id, 220 + streamMs + 160, () => {
    setTarget(from.id, { pose: { ...from.restPose, tiltRad: 0 } });
  });
  schedule(from.id, 220 + streamMs + 160 + 240, () => {
    setTarget(from.id, { pose: null });
  });
}
