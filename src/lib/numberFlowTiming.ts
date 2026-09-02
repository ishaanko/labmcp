/**
 * NumberFlow timings for readouts that change on every keypress (the D key dispenses, slider
 * drags). The library default rolls digits for about a second; these settle in 200ms.
 */
export const FAST_FLOW = {
  transformTiming: { duration: 200, easing: "cubic-bezier(0.23,1,0.32,1)" },
  spinTiming: { duration: 200, easing: "cubic-bezier(0.23,1,0.32,1)" },
  opacityTiming: { duration: 120, easing: "ease-out" },
};
