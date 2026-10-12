/** 毫秒 → `850 ms` / `3.1 s` */
export const formatDuration = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return '--';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
};
