import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FullscreenImageViewerProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FullscreenImageViewer({ src, alt, isOpen, onClose }: FullscreenImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const touchStartDistance = useRef<number>(0);
  const touchStartZoom = useRef<number>(1);
  
  // Use refs for smooth updates without re-renders
  const currentZoom = useRef(1);
  const currentPosition = useRef({ x: 0, y: 0 });
  const currentRotation = useRef(0);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragStartPosition = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // Update image transform directly (no React re-render) - MUST be defined first
  const updateImageTransform = useCallback(() => {
    if (!imageRef.current) return;
    
    const img = imageRef.current;
    const x = currentPosition.current.x;
    const y = currentPosition.current.y;
    const scale = currentZoom.current;
    const rot = currentRotation.current;
    
    img.style.transform = `translate(${x}px, ${y}px) scale(${scale}) rotate(${rot}deg)`;
    img.style.willChange = 'transform';
  }, []);

  // Helper to rotate a point around origin
  const rotatePoint = useCallback((x: number, y: number, angleDeg: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return {
      x: x * cos - y * sin,
      y: x * sin + y * cos,
    };
  }, []);

  // Helper to get effective dimensions after rotation
  const getEffectiveDimensions = useCallback((width: number, height: number, rotation: number) => {
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    if (normalizedRotation === 90 || normalizedRotation === 270) {
      // Width and height are swapped
      return { width: height, height: width };
    }
    return { width, height };
  }, []);

  // Check if panning is allowed (image must be larger than container after zoom)
  const isPanningAllowed = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return false;
    
    const img = imageRef.current;
    const container = containerRef.current;
    const zoom = currentZoom.current;
    const rotation = currentRotation.current;
    
    const imgWidth = img.naturalWidth || img.offsetWidth;
    const imgHeight = img.naturalHeight || img.offsetHeight;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    if (!imgWidth || !imgHeight || !containerWidth || !containerHeight) return false;
    
    const effectiveDims = getEffectiveDimensions(imgWidth, imgHeight, rotation);
    const scaledWidth = effectiveDims.width * zoom;
    const scaledHeight = effectiveDims.height * zoom;
    
    // Panning is only allowed if scaled image is larger than container
    return scaledWidth > containerWidth || scaledHeight > containerHeight;
  }, [getEffectiveDimensions]);

  // Calculate auto-zoom to fit image width to container width
  const calculateAutoZoom = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return 1;

    const img = imageRef.current;
    const container = containerRef.current;
    
    const imgWidth = img.naturalWidth || img.offsetWidth;
    const imgHeight = img.naturalHeight || img.offsetHeight;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    if (!imgWidth || !imgHeight || !containerWidth || !containerHeight) return 1;
    
    // Determine if image is portrait or landscape
    const isPortrait = imgHeight > imgWidth;
    
    // Calculate zoom to fit width (left and right edges meet container edges)
    const zoomToFitWidth = containerWidth / imgWidth;
    
    // For portrait images, ALWAYS zoom to exactly fit width (no Math.max, always fill width)
    // For landscape images, fit width but also consider height to avoid overflow
    if (isPortrait) {
      // Portrait: always fit width exactly (zoom in or out as needed to fill width)
      return zoomToFitWidth;
    } else {
      // Landscape: fit width, but ensure it doesn't exceed height
      const zoomToFitHeight = containerHeight / imgHeight;
      return Math.min(zoomToFitWidth, zoomToFitHeight);
    }
  }, []);

  // Calculate initial position to align image at top-left, then center horizontally
  const calculateInitialPosition = useCallback(() => {
    if (!imageRef.current || !containerRef.current) {
      return { x: 0, y: 0 };
    }

    const img = imageRef.current;
    const container = containerRef.current;
    const zoom = currentZoom.current;
    const rotation = currentRotation.current;
    
    const imgWidth = img.naturalWidth || img.offsetWidth;
    const imgHeight = img.naturalHeight || img.offsetHeight;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    if (!imgWidth || !imgHeight || !containerWidth || !containerHeight) {
      return { x: 0, y: 0 };
    }
    
    // Get effective dimensions after rotation
    const effectiveDims = getEffectiveDimensions(imgWidth, imgHeight, rotation);
    const scaledWidth = effectiveDims.width * zoom;
    const scaledHeight = effectiveDims.height * zoom;
    
    // Horizontal: center the scaled image in the container
    // With transform-origin 'left top', x=0 means left edge at container left
    // To center: move right by (containerWidth - scaledWidth) / 2
    // But since scaledWidth should equal containerWidth (we zoom to fit width), x should be 0
    // However, if there's any difference, center it
    const x = (containerWidth - scaledWidth) / 2;
    
    // Vertical: with transform-origin 'left top', y=0 means top edge at container top
    // Start at top: y = 0
    const y = 0;
    
    return { x, y };
  }, [getEffectiveDimensions]);

  // Constrain position - MUST be defined before useEffects
  // Prevents panning beyond image edges (top, bottom, left, right)
  // Strictly stops at the edges - no unnecessary panning
  const constrainPosition = useCallback(() => {
    if (!imageRef.current || !containerRef.current) {
      currentPosition.current = { x: 0, y: 0 };
      return;
    }

    const img = imageRef.current;
    const container = containerRef.current;
    const zoom = currentZoom.current;
    const rotation = currentRotation.current;
    
    const imgWidth = img.naturalWidth || img.offsetWidth;
    const imgHeight = img.naturalHeight || img.offsetHeight;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    if (!imgWidth || !imgHeight || !containerWidth || !containerHeight) {
      currentPosition.current = { x: 0, y: 0 };
      return;
    }
    
    // Get effective dimensions after rotation
    const effectiveDims = getEffectiveDimensions(imgWidth, imgHeight, rotation);
    const scaledWidth = effectiveDims.width * zoom;
    const scaledHeight = effectiveDims.height * zoom;
    
    // STRICT CONSTRAINT: Only allow panning if the scaled image is LARGER than the container
    // If image fits in container, force position to 0 (centered, no panning)
    
    // Horizontal constraints (left/right edges)
    // With transform-origin 'left top', x=0 is left edge at container left
    // Since we zoom to fit width exactly, scaledWidth should equal containerWidth
    // So x should be 0, but allow small adjustments for centering
    let constrainedX = currentPosition.current.x;
    if (scaledWidth > containerWidth) {
      // Image is wider (shouldn't happen if zoom is correct, but handle it)
      const maxX = (scaledWidth - containerWidth) / 2;
      constrainedX = Math.max(-maxX, Math.min(maxX, currentPosition.current.x));
    } else {
      // Center if image is narrower (shouldn't happen, but handle it)
      constrainedX = (containerWidth - scaledWidth) / 2;
    }
    
    // Vertical constraints (top/bottom edges)
    // With transform-origin 'left top', y=0 is top
    // Positive y moves image down (shows lower portion)
    // Negative y moves image up (but we don't want to go above top)
    let constrainedY = 0;
    if (scaledHeight > containerHeight) {
      // Image is taller than container - allow vertical panning down
      const maxY = scaledHeight - containerHeight;
      // Top position: y = 0, Bottom position: y = maxY
      constrainedY = Math.max(0, Math.min(maxY, currentPosition.current.y));
    } else {
      // Image fits in container height - keep at top (y = 0)
      constrainedY = 0;
    }
    
    // Apply strict constraints - stops at edges, no unnecessary movement
    currentPosition.current = {
      x: constrainedX,
      y: constrainedY,
    };
  }, [getEffectiveDimensions]);

  // Handle fullscreen API
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Disable body scrolling and hide scrollbar when image viewer is open
  useEffect(() => {
    if (isOpen) {
      // Store original overflow values
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      
      // Disable scrolling on body and html
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      // Compensate for scrollbar width to prevent layout shift
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      
      // Prevent scroll events on body (but allow image viewer to handle its own events)
      const preventBodyScroll = (e: Event) => {
        // Only prevent if the event target is not within the image viewer container
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      
      // Prevent scrolling on body
      const preventBodyTouchScroll = (e: TouchEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      
      // Prevent body scroll events
      document.body.addEventListener('scroll', preventBodyScroll, true);
      document.body.addEventListener('touchmove', preventBodyTouchScroll, { passive: false });
      
      return () => {
        // Restore original overflow values
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.paddingRight = '';
        
        // Remove scroll prevention listeners
        document.body.removeEventListener('scroll', preventBodyScroll, true);
        document.body.removeEventListener('touchmove', preventBodyTouchScroll);
      };
    }
  }, [isOpen]);

  // Prevent browser zoom when image viewer is open
  useEffect(() => {
    if (isOpen) {
      // Prevent wheel zoom on document
      const preventZoom = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      
      // Prevent pinch zoom
      const preventPinchZoom = (e: TouchEvent) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('wheel', preventZoom, { passive: false });
      document.addEventListener('touchmove', preventPinchZoom, { passive: false });
      
      return () => {
        document.removeEventListener('wheel', preventZoom);
        document.removeEventListener('touchmove', preventPinchZoom);
      };
    }
  }, [isOpen]);

  // Auto-hide controls after inactivity
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setControlsVisible(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3000); // Hide after 3 seconds of inactivity
  }, []);

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      currentZoom.current = 1;
      currentRotation.current = 0;
      currentPosition.current = { x: 0, y: 0 };
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setIsLoading(true);
      setError(false);
      setControlsVisible(true);
      hasUserZoomed.current = false; // Reset user zoom flag
      resetControlsTimeout();
      
      // If image is already loaded (cached), apply auto-zoom immediately
      if (imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
        requestAnimationFrame(() => {
          const autoZoom = calculateAutoZoom();
          currentZoom.current = autoZoom;
          setZoom(autoZoom);
          const initialPos = calculateInitialPosition();
          currentPosition.current = initialPos;
          setPosition(initialPos);
          hasUserZoomed.current = false;
          constrainPosition();
          setIsLoading(false);
          updateImageTransform();
        });
      } else if (imageRef.current) {
        updateImageTransform();
      }
    } else {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isOpen, updateImageTransform, resetControlsTimeout, calculateAutoZoom, calculateInitialPosition]);

  // Track if user has manually zoomed (so we don't override on resize)
  const hasUserZoomed = useRef(false);
  
  // Recalculate zoom on window resize (only if user hasn't manually zoomed)
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
        if (!hasUserZoomed.current) {
          // Recalculate auto-zoom if user hasn't manually zoomed
          const autoZoom = calculateAutoZoom();
          currentZoom.current = autoZoom;
          setZoom(autoZoom);
        }
        // Always constrain position after resize to ensure edges are locked
        constrainPosition();
        updateImageTransform();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, calculateAutoZoom, calculateInitialPosition, constrainPosition, updateImageTransform]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          if (isFullscreen) {
            document.exitFullscreen();
          } else {
            onClose();
          }
          break;
        case '+':
        case '=':
          e.preventDefault();
          const newZoomIn = Math.min(5, currentZoom.current + 0.25);
          currentZoom.current = newZoomIn;
          setZoom(newZoomIn);
          hasUserZoomed.current = true;
          constrainPosition();
          updateImageTransform();
          break;
        case '-':
          e.preventDefault();
          const newZoomOut = Math.max(1.0, currentZoom.current - 0.25); // Min zoom is 1.0 (100%)
          currentZoom.current = newZoomOut;
          setZoom(newZoomOut);
          hasUserZoomed.current = true;
          constrainPosition();
          updateImageTransform();
          break;
        case '0':
          e.preventDefault();
          // Reset to auto-zoom on reset
          const resetAutoZoom = calculateAutoZoom();
          currentZoom.current = resetAutoZoom;
          const resetPos = calculateInitialPosition();
          currentPosition.current = resetPos;
          currentRotation.current = 0;
          setZoom(resetAutoZoom);
          setPosition(resetPos);
          setRotation(0);
          hasUserZoomed.current = false;
          updateImageTransform();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          const newRot = (currentRotation.current + 90) % 360;
          currentRotation.current = newRot;
          setRotation(newRot);
          updateImageTransform();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, onClose, toggleFullscreen, constrainPosition, updateImageTransform, calculateAutoZoom, calculateInitialPosition]);

  // Handle tap/click to toggle controls (but not when dragging)
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Only toggle if clicking on the container itself, not on controls or image
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.image-container')) {
      setControlsVisible(prev => !prev);
      resetControlsTimeout();
    }
  }, [resetControlsTimeout]);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking on controls
    if ((e.target as HTMLElement).closest('.controls-panel')) {
      resetControlsTimeout();
      return;
    }
    // Only allow dragging if panning is actually needed (image larger than container)
    if (!isPanningAllowed()) return;
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    
    // Store the initial mouse position and current image position
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
    };
    dragStartPosition.current = {
      x: currentPosition.current.x,
      y: currentPosition.current.y,
    };
    resetControlsTimeout();
  }, [resetControlsTimeout, isPanningAllowed]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !isPanningAllowed()) return;
    e.preventDefault();
    
    // Calculate total screen-space drag delta from start
    const screenDeltaX = e.clientX - dragStart.current.x;
    const screenDeltaY = e.clientY - dragStart.current.y;
    
    // Rotate the screen-space delta by the negative rotation to convert to image-space
    // This ensures dragging matches the visual orientation
    const imageDelta = rotatePoint(screenDeltaX, screenDeltaY, -currentRotation.current);
    
    // Calculate new position from initial position + rotated delta
    currentPosition.current = {
      x: dragStartPosition.current.x + imageDelta.x,
      y: dragStartPosition.current.y + imageDelta.y,
    };
    
    constrainPosition();
    resetControlsTimeout();
    
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        updateImageTransform();
        rafId.current = null;
      });
    }
  }, [constrainPosition, updateImageTransform, resetControlsTimeout, rotatePoint, isPanningAllowed]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      if (imageRef.current) {
        imageRef.current.style.willChange = 'auto';
      }
      // Sync state for UI display
      setPosition(currentPosition.current);
    }
  }, []);

  // Track touch start for tap detection
  const touchStartTime = useRef<number>(0);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't prevent default if clicking on controls
    if ((e.target as HTMLElement).closest('.controls-panel')) {
      resetControlsTimeout();
      return;
    }
    
    e.preventDefault();
    touchStartTime.current = Date.now();
    if (e.touches.length === 1) {
      touchStartPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
    
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      touchStartDistance.current = distance;
      touchStartZoom.current = currentZoom.current;
      resetControlsTimeout();
    } else if (e.touches.length === 1 && isPanningAllowed()) {
      // Only allow touch panning if image is larger than container
      isDraggingRef.current = true;
      setIsDragging(true);
      dragStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      dragStartPosition.current = {
        x: currentPosition.current.x,
        y: currentPosition.current.y,
      };
      resetControlsTimeout();
    }
  }, [resetControlsTimeout, isPanningAllowed]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      // Pinch to zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const scale = distance / touchStartDistance.current;
      const newZoom = Math.max(1.0, Math.min(5, touchStartZoom.current * scale)); // Min zoom is 1.0 (100%)
      currentZoom.current = newZoom;
      setZoom(newZoom);
      hasUserZoomed.current = true;
      
      constrainPosition();
      resetControlsTimeout();
      
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          updateImageTransform();
          rafId.current = null;
        });
      }
    } else if (e.touches.length === 1 && isDraggingRef.current && isPanningAllowed()) {
      // Pan - calculate screen-space delta
      const screenDeltaX = e.touches[0].clientX - dragStart.current.x;
      const screenDeltaY = e.touches[0].clientY - dragStart.current.y;
      
      // Rotate the screen-space delta by the negative rotation to convert to image-space
      const imageDelta = rotatePoint(screenDeltaX, screenDeltaY, -currentRotation.current);
      
      // Calculate new position from initial position + rotated delta
      currentPosition.current = {
        x: dragStartPosition.current.x + imageDelta.x,
        y: dragStartPosition.current.y + imageDelta.y,
      };
      
      constrainPosition();
      resetControlsTimeout();
      
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          updateImageTransform();
          rafId.current = null;
        });
      }
    }
  }, [constrainPosition, updateImageTransform, resetControlsTimeout, rotatePoint, isPanningAllowed]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      if (imageRef.current) {
        imageRef.current.style.willChange = 'auto';
      }
      // Sync state for UI display
      setPosition(currentPosition.current);
      setZoom(currentZoom.current);
      resetControlsTimeout();
    } else {
      // Check if this was a tap (not a drag or pinch)
      const touchDuration = Date.now() - touchStartTime.current;
      if (touchDuration < 300 && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const moveDistance = Math.hypot(
          touch.clientX - touchStartPos.current.x,
          touch.clientY - touchStartPos.current.y
        );
        // If moved less than 10px, consider it a tap
        if (moveDistance < 10 && currentZoom.current <= 1) {
          // Only toggle on tap if not zoomed (to avoid accidental toggles while panning)
          setControlsVisible(prev => !prev);
          resetControlsTimeout();
        }
      }
    }
  }, [resetControlsTimeout]);

  // Wheel zoom - prevent browser zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Always prevent browser zoom when in image viewer
    e.preventDefault();
    e.stopPropagation();
    
    if (e.ctrlKey || e.metaKey) {
      // Zoom with Ctrl/Cmd + scroll
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(1.0, Math.min(5, currentZoom.current + delta)); // Min zoom is 1.0 (100%)
      currentZoom.current = newZoom;
      setZoom(newZoom);
      hasUserZoomed.current = true;
      
      if (newZoom <= 1) {
        currentPosition.current = { x: 0, y: 0 };
        setPosition({ x: 0, y: 0 });
      } else {
        constrainPosition();
      }
      
      resetControlsTimeout();
      
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          updateImageTransform();
          rafId.current = null;
        });
      }
    }
  }, [constrainPosition, updateImageTransform, resetControlsTimeout]);

  // Download image
  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = alt || 'image';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  }, [src, alt]);

  // Sync zoom changes to refs and update transform
  useEffect(() => {
    currentZoom.current = zoom;
    // Always constrain position after zoom change to ensure edges are locked
    constrainPosition();
    updateImageTransform();
  }, [zoom, constrainPosition, updateImageTransform]);

  // Sync rotation changes
  useEffect(() => {
    currentRotation.current = rotation;
    // Constrain position after rotation since effective dimensions change
    constrainPosition();
    updateImageTransform();
  }, [rotation, constrainPosition, updateImageTransform]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onClick={handleContainerClick}
      style={{ 
        cursor: currentZoom.current > 1 && isDragging ? 'grabbing' : currentZoom.current > 1 ? 'grab' : 'default',
        touchAction: 'none' // Prevent browser zoom gestures
      }}
    >
      {/* Image Container */}
      <div className="image-container absolute inset-0 flex items-start justify-start overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-center">
              <p className="text-lg mb-2">Failed to load image</p>
              <Button variant="outline" onClick={onClose} className="text-white border-white/50">
                Close
              </Button>
            </div>
          </div>
        )}
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className={`${
            isLoading ? 'opacity-0' : 'opacity-100'
          } ${!isDragging ? 'transition-transform duration-200' : ''}`}
          style={{
            width: 'auto',
            height: 'auto',
            maxWidth: 'none',
            maxHeight: 'none',
            transformOrigin: 'left top',
            willChange: isDragging ? 'transform' : 'auto',
          }}
          onLoad={() => {
            setIsLoading(false);
            // Use requestAnimationFrame to ensure container and image dimensions are ready
            requestAnimationFrame(() => {
              // Calculate and apply auto-zoom to fit width (especially for portrait images)
              const autoZoom = calculateAutoZoom();
              currentZoom.current = autoZoom;
              setZoom(autoZoom);
              
              // Recalculate position after zoom is set
              const initialPos = calculateInitialPosition();
              currentPosition.current = initialPos;
              setPosition(initialPos);
              hasUserZoomed.current = false; // Reset on new image load
              
              // Constrain position to ensure edges are locked
              constrainPosition();
              updateImageTransform();
            });
          }}
          onError={() => {
            setIsLoading(false);
            setError(true);
          }}
          draggable={false}
        />
      </div>

      {/* Controls - Auto-hide with smooth transition */}
      <div 
        className={`controls-panel absolute top-4 right-4 md:top-4 md:right-4 md:bottom-auto bottom-4 left-4 md:left-auto flex items-center gap-1.5 md:gap-2 bg-black/80 backdrop-blur-md rounded-lg p-1.5 md:p-2 border border-white/10 transition-all duration-300 ${
          controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
        onMouseEnter={resetControlsTimeout}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile: Compact layout, Desktop: Full layout */}
        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap justify-center">
          {/* Zoom Controls */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8 md:h-9 md:w-9 touch-manipulation"
            onClick={() => {
              const newZoom = Math.max(1.0, currentZoom.current - 0.25);
              currentZoom.current = newZoom;
              setZoom(newZoom);
              hasUserZoomed.current = true;
              resetControlsTimeout();
            }}
            disabled={zoom <= 1.0}
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-white text-xs md:text-sm min-w-[50px] md:min-w-[60px] text-center font-medium hidden sm:inline">
            {Math.round(currentZoom.current * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8 md:h-9 md:w-9 touch-manipulation"
            onClick={() => {
              const newZoom = Math.min(5, currentZoom.current + 0.25);
              currentZoom.current = newZoom;
              setZoom(newZoom);
              hasUserZoomed.current = true;
              resetControlsTimeout();
            }}
            disabled={zoom >= 5}
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          <div className="w-px h-5 md:h-6 bg-white/30 mx-0.5 md:mx-1" />

          {/* Reset */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8 md:h-9 md:w-9 touch-manipulation"
            onClick={() => {
              const resetAutoZoom = calculateAutoZoom();
              currentZoom.current = resetAutoZoom;
              const resetPos = calculateInitialPosition();
              currentPosition.current = resetPos;
              currentRotation.current = 0;
              setZoom(resetAutoZoom);
              setPosition(resetPos);
              setRotation(0);
              hasUserZoomed.current = false;
              updateImageTransform();
              resetControlsTimeout();
            }}
            title="Reset (0)"
          >
            <RotateCw className="w-4 h-4" />
          </Button>

          <div className="w-px h-5 md:h-6 bg-white/30 mx-0.5 md:mx-1" />

          {/* Rotate */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8 md:h-9 md:w-9 touch-manipulation"
            onClick={() => {
              const newRotation = (currentRotation.current + 90) % 360;
              currentRotation.current = newRotation;
              setRotation(newRotation);
              resetControlsTimeout();
            }}
            title="Rotate (R)"
          >
            <RotateCw className="w-4 h-4" />
          </Button>

          {/* Desktop-only: Fullscreen and Download */}
          <div className="hidden md:contents">
            <div className="w-px h-6 bg-white/30 mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-9 w-9"
              onClick={() => {
                toggleFullscreen();
                resetControlsTimeout();
              }}
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
            <div className="w-px h-6 bg-white/30 mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-9 w-9"
              onClick={() => {
                handleDownload();
                resetControlsTimeout();
              }}
              title="Download"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-px h-5 md:h-6 bg-white/30 mx-0.5 md:mx-1" />

          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8 md:h-9 md:w-9 touch-manipulation"
            onClick={() => {
              onClose();
              resetControlsTimeout();
            }}
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Mobile Instructions - Auto-hide with controls */}
      <div className={`absolute bottom-16 left-4 right-4 md:hidden transition-all duration-300 ${
        controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}>
        <div className="bg-black/70 backdrop-blur-md rounded-lg p-2.5 border border-white/10 text-white text-xs">
          <p className="font-medium mb-1">Touch Gestures:</p>
          <p>• Pinch to zoom • Drag to pan • Tap image to show/hide controls</p>
        </div>
      </div>

      {/* Desktop Instructions - Auto-hide with controls */}
      <div className={`absolute bottom-4 left-4 hidden md:block transition-all duration-300 ${
        controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}>
        <div className="bg-black/70 backdrop-blur-md rounded-lg p-3 border border-white/10 text-white text-xs">
          <p className="font-medium mb-1">Keyboard Shortcuts:</p>
          <p>+/- Zoom | 0 Reset | R Rotate | F Fullscreen | Esc Close</p>
          <p className="mt-1 text-white/70">Click image to toggle controls</p>
        </div>
      </div>
    </div>
  );
}

