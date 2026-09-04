import type { Slide } from "./admin-types";

/** Slides the public site should show: active and not past their expiry. */
export function visibleSlides(slides: Slide[], now: number = Date.now()) {
  return slides.filter((s) => s.active && (!s.expiresAt || s.expiresAt > now));
}
