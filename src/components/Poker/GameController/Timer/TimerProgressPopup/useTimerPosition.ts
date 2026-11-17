import { KeyboardEvent, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';

const MARGIN = 16;

// Keep a margin where possible, even on viewports smaller than the popup.
const clampOffset = (offset: number, size: number, viewport: number) => {
  const available = Math.max(0, viewport - size);
  const margin = Math.min(MARGIN, available / 2);
  return Math.min(available - margin, Math.max(margin, offset));
};

export const useTimerPosition = () => {
  const popupRef = useRef<HTMLDivElement>(null);
  const dragRef =
    useRef<{
      pointerId: number;
      x: number;
      y: number;
      right: number;
      bottom: number;
    } | null>(null);
  const [position, setPosition] = useState({ right: MARGIN, bottom: MARGIN });
  const [isDragging, setIsDragging] = useState(false);

  const constrain = useCallback((next: typeof position) => {
    const popup = popupRef.current;
    if (!popup) return next;
    const { width, height } = popup.getBoundingClientRect();
    return {
      right: clampOffset(next.right, width, window.innerWidth),
      bottom: clampOffset(next.bottom, height, window.innerHeight),
    };
  }, []);

  useEffect(() => {
    const keepInViewport = () =>
      setPosition((previous) => {
        const next = constrain(previous);
        return next.right === previous.right && next.bottom === previous.bottom ? previous : next;
      });
    keepInViewport();
    window.addEventListener('resize', keepInViewport);
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(keepInViewport) : null;
    if (popupRef.current) observer?.observe(popupRef.current);
    return () => {
      window.removeEventListener('resize', keepInViewport);
      observer?.disconnect();
    };
  }, [constrain]);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || dragRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ...position,
    };
    setIsDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    setPosition(
      constrain({
        right: drag.right - (event.clientX - drag.x),
        bottom: drag.bottom - (event.clientY - drag.y),
      }),
    );
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== dragRef.current?.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 50 : 10;
    const offsets: Record<string, { right: number; bottom: number }> = {
      ArrowLeft: { right: step, bottom: 0 },
      ArrowRight: { right: -step, bottom: 0 },
      ArrowUp: { right: 0, bottom: step },
      ArrowDown: { right: 0, bottom: -step },
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    setPosition((previous) =>
      constrain({ right: previous.right + offset.right, bottom: previous.bottom + offset.bottom }),
    );
  };

  return {
    popupRef,
    position,
    isDragging,
    dragHandleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
      onKeyDown,
    },
  };
};
