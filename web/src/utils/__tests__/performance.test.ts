import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../performance';

describe('Performance Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('debounce', () => {
    it('should delay function execution', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 200);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should execute only once when called multiple times within delay', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 200);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 200);

      debouncedFn('arg1', 'arg2');
      vi.advanceTimersByTime(200);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should reset timer on each call', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 200);

      debouncedFn();
      vi.advanceTimersByTime(100);

      debouncedFn();
      vi.advanceTimersByTime(100);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should preserve arguments from last call', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 200);

      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');

      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledWith('third');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should work correctly with different delays', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 500);

      debouncedFn();
      vi.advanceTimersByTime(400);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
