"use client";

import { useEffect, useRef, useState } from "react";
import type { CurvePoint } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { selectTitration } from "@/store/selectors";

const WIDTH = 268;
const HEIGHT = 140;
const PAD = { top: 8, right: 8, bottom: 16, left: 22 };
const PH_MAX = 14;

function plotX(titrantMl: number, xMax: number): number {
  const t = xMax > 0 ? Math.min(1, Math.max(0, titrantMl / xMax)) : 0;
  return PAD.left + t * (WIDTH - PAD.left - PAD.right);
}

function plotY(pH: number): number {
  const t = Math.min(1, Math.max(0, pH / PH_MAX));
  return HEIGHT - PAD.bottom - t * (HEIGHT - PAD.top - PAD.bottom);
}

/**
 * Builds an SVG path `d` string from titration points with a known pH, in plot space. Pure so it
 * can be unit tested without mounting anything; the component below is the only caller.
 */
export function curvePath(points: ReadonlyArray<CurvePoint>, width: number, height: number, xMax: number): string {
  const withPh = points.filter((p): p is CurvePoint & { pH: number } => p.pH !== null);
  if (withPh.length === 0) return "";
  const scaleX = (ml: number): number => {
    const t = xMax > 0 ? Math.min(1, Math.max(0, ml / xMax)) : 0;
    return PAD.left + t * (width - PAD.left - PAD.right);
  };
  const scaleY = (pH: number): number => {
    const t = Math.min(1, Math.max(0, pH / PH_MAX));
    return height - PAD.bottom - t * (height - PAD.top - PAD.bottom);
  };
  return withPh.map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(p.titrantMl).toFixed(2)},${scaleY(p.pH).toFixed(2)}`).join(" ");
}

/**
 * Hand-rolled titration curve (C7): x is titrant mL out to 1.3x the upper-bound expected
 * equivalence (never the secret), y is pH 0-14. Points append without animation; the endpoint
 * dot scales in once, the first time it appears.
 */
export function TitrationCurve() {
  const titration = useLabStore(selectTitration);
  const [endpointAppeared, setEndpointAppeared] = useState(false);
  const seenEndpoint = useRef(false);

  useEffect(() => {
    if (titration?.endpointMl != null && !seenEndpoint.current) {
      seenEndpoint.current = true;
      setEndpointAppeared(true);
    }
  }, [titration?.endpointMl]);

  if (!titration) return null;

  const xMax = titration.expectedEquivalenceUpperMl * 1.3;
  const path = curvePath(titration.curve, WIDTH, HEIGHT, xMax);
  const withPh = titration.curve.filter((p): p is CurvePoint & { pH: number } => p.pH !== null);
  const last = withPh[withPh.length - 1];
  const neutralY = plotY(7);
  const endpoint =
    titration.endpointMl != null && withPh.length > 0
      ? withPh.reduce((closest, p) => (Math.abs(p.titrantMl - (titration.endpointMl ?? 0)) < Math.abs(closest.titrantMl - (titration.endpointMl ?? 0)) ? p : closest))
      : null;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} role="img" aria-label="Titration curve, pH against titrant volume">
      <line
        x1={PAD.left}
        x2={WIDTH - PAD.right}
        y1={neutralY}
        y2={neutralY}
        stroke="var(--ink-3)"
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      <text x={2} y={neutralY + 3} className="fill-ink-3 text-2xs">
        7
      </text>
      <text x={PAD.left} y={HEIGHT - 3} className="fill-ink-3 text-2xs">
        0
      </text>
      <text x={WIDTH - PAD.right} y={HEIGHT - 3} textAnchor="end" className="fill-ink-3 text-2xs">
        {xMax.toFixed(1)} mL
      </text>
      {path ? <path d={path} fill="none" stroke="var(--ink)" strokeWidth={1.5} /> : null}
      {last ? <circle cx={plotX(last.titrantMl, xMax)} cy={plotY(last.pH)} r={4} className="fill-ink" /> : null}
      {endpoint ? (
        <circle
          cx={plotX(endpoint.titrantMl, xMax)}
          cy={plotY(endpoint.pH)}
          r={6}
          fill="var(--phenol-pink)"
          style={{
            transformOrigin: `${plotX(endpoint.titrantMl, xMax)}px ${plotY(endpoint.pH)}px`,
            transform: endpointAppeared ? "scale(1)" : "scale(0.6)",
            transition: "transform 200ms var(--ease-out)",
          }}
        />
      ) : null}
    </svg>
  );
}
