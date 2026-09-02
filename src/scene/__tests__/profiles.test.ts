import { describe, expect, it } from "vitest";
import {
  BEAKER_PROFILE,
  BURETTE_PROFILE,
  ERLENMEYER_PROFILE,
  GRAD_CYLINDER_PROFILE,
  TEST_TUBE_PROFILE,
  heightForVolume,
  innerProfile,
  radiusAt,
} from "../profiles";

const PROFILES = [
  ["beaker", BEAKER_PROFILE],
  ["erlenmeyer", ERLENMEYER_PROFILE],
  ["test tube", TEST_TUBE_PROFILE],
  ["graduated cylinder", GRAD_CYLINDER_PROFILE],
  ["burette", BURETTE_PROFILE],
] as const;

describe("heightForVolume", () => {
  it.each(PROFILES)("%s: full capacity reaches capacityHeight exactly", (_name, profile) => {
    expect(heightForVolume(profile, profile.capacityMl)).toBeCloseTo(profile.capacityHeight, 9);
  });

  it.each(PROFILES)("%s: empty is height 0", (_name, profile) => {
    expect(heightForVolume(profile, 0)).toBe(0);
  });

  it.each(PROFILES)("%s: height increases monotonically with volume", (_name, profile) => {
    let prev = 0;
    for (let ml = 5; ml <= profile.capacityMl; ml += 5) {
      const h = heightForVolume(profile, ml);
      expect(h).toBeGreaterThanOrEqual(prev);
      prev = h;
    }
  });

  it("overfilling clamps to capacityHeight", () => {
    expect(heightForVolume(BEAKER_PROFILE, BEAKER_PROFILE.capacityMl * 2)).toBe(BEAKER_PROFILE.capacityHeight);
  });
});

describe("radiusAt", () => {
  it("clamps outside the profile's range to the end radii", () => {
    const first = BEAKER_PROFILE.points[0]!;
    const last = BEAKER_PROFILE.points[BEAKER_PROFILE.points.length - 1]!;
    expect(radiusAt(BEAKER_PROFILE, -1)).toBeCloseTo(first.r, 9);
    expect(radiusAt(BEAKER_PROFILE, 100)).toBeCloseTo(last.r, 9);
  });
});

describe("innerProfile", () => {
  it("shrinks every radius by the wall thickness without going negative", () => {
    const inner = innerProfile(BEAKER_PROFILE, 0.02);
    for (let i = 0; i < BEAKER_PROFILE.points.length; i++) {
      const outer = BEAKER_PROFILE.points[i]!;
      const shrunk = inner.points[i]!;
      expect(shrunk.r).toBeCloseTo(Math.max(0, outer.r - 0.02), 9);
    }
  });
});
