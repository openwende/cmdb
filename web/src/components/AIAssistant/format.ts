/** token 数 → `850` / `1.2k` / `15k`（一万以上不留小数） */
export const formatTokens = (count: number): string => {
  if (!Number.isFinite(count) || count < 0) return '--';
  if (count < 1000) return String(Math.round(count));
  const k = count / 1000;
  return `${k >= 10 ? Math.round(k) : Number(k.toFixed(1))}k`;
};

/** 毫秒 → `850 ms` / `3.1 s` */
export const formatDuration = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return '--';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
};
