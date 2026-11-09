import { describe, expect, it } from 'vitest';

import { formatDuration, formatTokens } from '@/components/AIAssistant/format';

describe('AI assistant formatting', () => {
  it('shows tokens in k above a thousand', () => {
    expect(formatTokens(850)).toBe('850');
    expect(formatTokens(1000)).toBe('1k');
    expect(formatTokens(1234)).toBe('1.2k');
    expect(formatTokens(9960)).toBe('10k');
    expect(formatTokens(15432)).toBe('15k');
    expect(formatTokens(-1)).toBe('--');
  });

  it('keeps durations as before', () => {
    expect(formatDuration(850)).toBe('850 ms');
    expect(formatDuration(3100)).toBe('3.1 s');
  });
});
