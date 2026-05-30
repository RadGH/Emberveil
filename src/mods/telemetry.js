/**
 * Shim telemetry — counts every time the mod runtime falls back to a legacy
 * loader or legacy field read. Exposes a dashboard so authors can see which
 * packs / engines still rely on legacy shapes.
 */
const counts = Object.create(null);

export const shimTelemetry = {
  hit(key) {
    counts[key] = (counts[key] || 0) + 1;
  },
  snapshot() {
    return { ...counts };
  },
  reset() {
    for (const k of Object.keys(counts)) delete counts[k];
  }
};

if (typeof window !== 'undefined') {
  window.__emberveilShimTelemetry = shimTelemetry;
}
