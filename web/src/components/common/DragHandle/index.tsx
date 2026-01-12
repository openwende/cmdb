import React, { useRef, useState } from 'react';
import './style.css';

interface DragHandleProps {
  minWidth: number;
  maxWidth: number;
  currentWidth: number;
  onWidthChange: (width: number) => void;
}

const DragHandle: React.FC<DragHandleProps> = ({
  minWidth,
  maxWidth,
  currentWidth,
  onWidthChange,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isHover, setIsHover] = useState<boolean>(false);
  const dragging = useRef<boolean>(false);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = currentWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragging.current) return;
      const delta = moveEvent.clientX - startX;
      let newWidth = startWidth + delta;
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      onWidthChange(newWidth);
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

  return (
    <div
      className={`drag-handle ${isDragging || isHover ? 'active' : ''}`}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    />
  );
};

export default DragHandle;
