import { useState, useRef } from 'react';

interface Position {
  x: number
  y: number
}

interface UseDraggableProps {
  isPet?: boolean
  componentId: string
}

/**
 * A custom hook that provides dragging functionality for components
 * @param isPet - Whether the current mode is pet mode or not
 * @param componentId - Unique identifier for the component
 * @returns Object containing refs and handlers for dragging functionality
 */
export function useDraggable({ isPet = false, componentId }: UseDraggableProps) {
  // Track if the element is currently being dragged
  const [isDragging, setIsDragging] = useState(false);

  // Refs to store position data that persists between renders
  const positionRef = useRef<Position>({ x: 0, y: 0 });
  const dragStartRef = useRef<Position>({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);

  /**
   * Handle mouse enter event
   */
  const handleMouseEnter = () => {
    // Web-only hover effects can be added here
  };

  /**
   * Handle mouse leave event
   */
  const handleMouseLeave = () => {
    // Web-only hover effects can be added here
  };

  /**
   * Handles the start of dragging operation
   * Sets up mouse move and mouse up listeners
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    // Calculate the initial offset
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };

    /**
     * Updates element position during mouse movement
     */
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!elementRef.current) return;

      // Calculate new position
      const newPosition = {
        x: moveEvent.clientX - dragStartRef.current.x,
        y: moveEvent.clientY - dragStartRef.current.y,
      };

      // Update position ref for future calculations
      positionRef.current = newPosition;

      elementRef.current.style.transform = `translateX(-50%) translate(${positionRef.current.x}px, ${positionRef.current.y}px)`;
    };

    /**
     * Cleanup function for mouse events
     */
    const handleMouseUp = () => {
      setIsDragging(false);
      // Clean up event listeners
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
    };

    // Add event listeners with capture phase
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
  };

  return {
    elementRef,
    isDragging,
    handleMouseDown,
    handleMouseEnter,
    handleMouseLeave,
  };
}
