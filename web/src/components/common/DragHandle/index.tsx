import React, { useRef, useState } from 'react';
import './style.css';

interface DragHandleProps {
  minWidth: number;
  maxWidth: number;
  currentWidth: number;
  onWidthChange: (width: number) => void;
  className?: string;
}

const KEYBOARD_STEP = 10;

const DragHandle: React.FC<DragHandleProps> = ({
  minWidth,
  maxWidth,
  currentWidth,
  onWidthChange,
  className,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isHover, setIsHover] = useState<boolean>(false);
  const dragging = useRef<boolean>(false);

  const clampWidth = (w: number) => Math.min(maxWidth, Math.max(minWidth, w));

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = currentWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragging.current) return;
      const delta = moveEvent.clientX - startX;
      onWidthChange(clampWidth(startWidth + delta));
    };

    const onMouseUp = () => {
      dragging.current = false;
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    setIsDragging(true);
    const startX = e.touches[0].clientX;
    const startWidth = currentWidth;

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (!dragging.current) return;
      const delta = moveEvent.touches[0].clientX - startX;
      onWidthChange(clampWidth(startWidth + delta));
    };

    const onTouchEnd = () => {
      dragging.current = false;
      setIsDragging(false);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };

    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onWidthChange(clampWidth(currentWidth - KEYBOARD_STEP));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onWidthChange(clampWidth(currentWidth + KEYBOARD_STEP));
    }
  };

  return (
    <div
      className={`drag-handle ${isDragging || isHover ? 'active' : ''} ${className || ''}`}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      onKeyDown={onKeyDown}
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={currentWidth}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
    />
  );
};

export default DragHandle;
