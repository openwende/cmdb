import { useState, useEffect } from 'react';

const BREAKPOINT_MOBILE = 768;
const BREAKPOINT_TABLET = 1024;

interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
}

/**
 * Lightweight responsive hook that tracks viewport width
 * and exposes mobile / tablet / desktop boolean flags.
 *
 * Breakpoints:
 *   mobile  — width < 768px
 *   tablet  — 768px ≤ width < 1024px
 *   desktop — width ≥ 1024px
 */
export function useResponsive(): ResponsiveState {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : BREAKPOINT_TABLET,
  );

  useEffect(() => {
    let rafId: number;

    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setWidth(window.innerWidth);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return {
    isMobile: width < BREAKPOINT_MOBILE,
    isTablet: width >= BREAKPOINT_MOBILE && width < BREAKPOINT_TABLET,
    isDesktop: width >= BREAKPOINT_TABLET,
    width,
  };
}
