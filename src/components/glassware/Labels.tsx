import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import NumberFlow from "@number-flow/react";
import * as THREE from "three";
import { useLabStore } from "@/store/labStore";
import { selectContainer } from "@/store/selectors";
import { SPIN_TIMING, TRANSFORM_TIMING } from "@/components/ui/Readout";

export interface LabelsProps {
  readonly kind: "ph" | "temperature";
  readonly containerId: string;
  /** The instrument's own group, whose damped world position the tag follows. */
  readonly anchorRef: RefObject<THREE.Object3D | null>;
  /** Local offset above the instrument, also used as the `<Html>` anchor. */
  readonly offset: readonly [number, number, number];
}

const RIGHT_PANEL_WIDTH = 300;
const worldPos = new THREE.Vector3();
const projected = new THREE.Vector3();

/**
 * Reading tag above an attached probe/thermometer (C3.5, C4.6): the latest canonical reading
 * (never the damped visual, per C5 "readouts read canonical state"), fading in over 150ms and
 * hiding once its vessel drifts behind the right panel.
 */
export function Labels({ kind, containerId, anchorRef, offset }: LabelsProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const container = useLabStore(selectContainer(containerId));

  useFrame(({ camera, size }) => {
    const wrap = wrapRef.current;
    const anchor = anchorRef.current;
    if (!wrap || !anchor) return;
    anchor.getWorldPosition(worldPos);
    worldPos.y += offset[1];
    projected.copy(worldPos).project(camera);
    const screenX = (projected.x * 0.5 + 0.5) * size.width;
    wrap.style.opacity = screenX > size.width - RIGHT_PANEL_WIDTH ? "0" : "1";
  });

  if (!container) return null;
  const value = kind === "ph" ? container.pH : container.temperatureC;

  return (
    <Html position={offset} zIndexRange={[20, 0]} center occlude={false}>
      <div
        ref={wrapRef}
        className="pointer-events-none whitespace-nowrap rounded-full border border-hairline bg-surface-thick px-2 py-0.5 text-2xs text-ink shadow-chip transition-opacity duration-150"
        style={{ opacity: 0 }}
      >
        {value === null ? (
          <span className="tabular text-ink-3">–</span>
        ) : (
          <NumberFlow
            className="tabular"
            value={Number(value.toFixed(2))}
            format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
            suffix={kind === "temperature" ? " °C" : undefined}
            transformTiming={TRANSFORM_TIMING}
            spinTiming={SPIN_TIMING}
          />
        )}
        {kind === "ph" ? <span className="ml-1 text-ink-3">pH</span> : null}
      </div>
    </Html>
  );
}
