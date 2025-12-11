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
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const touchStartDistance = useRef<number>(0);
  const touchStartZoom = useRef<number>(1);
  
  // Use refs for smooth updates without re-renders
  const currentZoom = useRef(1);
  const currentPosition = useRef({ x: 0, y: 0 });
  const currentRotation = useRef(0);
  const dragStart = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

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
      if (imageRef.current) {
        updateImageTransform();
      }
    }
  }, [isOpen, updateImageTransform]);

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
          constrainPosition();
          updateImageTransform();
          break;
        case '-':
          e.preventDefault();
          const newZoomOut = Math.max(0.5, currentZoom.current - 0.25);
          currentZoom.current = newZoomOut;
          setZoom(newZoomOut);
          constrainPosition();
          updateImageTransform();
          break;
        case '0':
          e.preventDefault();
          currentZoom.current = 1;
          currentPosition.current = { x: 0, y: 0 };
          currentRotation.current = 0;
          setZoom(1);
          setPosition({ x: 0, y: 0 });
          setRotation(0);
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
  }, [isOpen, isFullscreen, onClose, toggleFullscreen, constrainPosition, updateImageTransform]);

  // Update image transform directly (no React re-render)
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

  // Constrain position
  const constrainPosition = useCallback(() => {
    if (!imageRef.current || !containerRef.current || currentZoom.current <= 1) {
      currentPosition.current = { x: 0, y: 0 };
      return;
    }

    const img = imageRef.current;
    const container = containerRef.current;
    const zoom = currentZoom.current;
    
    const imgWidth = img.naturalWidth || img.offsetWidth;
    const imgHeight = img.naturalHeight || img.offsetHeight;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    const scaledWidth = imgWidth * zoom;
    const scaledHeight = imgHeight * zoom;
    
    const maxX = Math.max(0, (scaledWidth - containerWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - containerHeight) / 2);
    
    currentPosition.current = {
      x: Math.max(-maxX, Math.min(maxX, currentPosition.current.x)),
      y: Math.max(-maxY, Math.min(maxY, currentPosition.current.y)),
    };
  }, []);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (currentZoom.current <= 1) return;
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - currentPosition.current.x,
      y: e.clientY - currentPosition.current.y,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || currentZoom.current <= 1) return;
    e.preventDefault();
    
    currentPosition.current = {
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    };
    
    constrainPosition();
    
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        updateImageTransform();
        rafId.current = null;
      });
    }
  }, [constrainPosition, updateImageTransform]);

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

  // Touch gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      touchStartDistance.current = distance;
      touchStartZoom.current = currentZoom.current;
    } else if (e.touches.length === 1 && currentZoom.current > 1) {
      isDraggingRef.current = true;
      setIsDragging(true);
      dragStart.current = {
        x: e.touches[0].clientX - currentPosition.current.x,
        y: e.touches[0].clientY - currentPosition.current.y,
      };
    }
  }, []);

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
      const newZoom = Math.max(0.5, Math.min(5, touchStartZoom.current * scale));
      currentZoom.current = newZoom;
      setZoom(newZoom);
      
      constrainPosition();
      
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          updateImageTransform();
          rafId.current = null;
        });
      }
    } else if (e.touches.length === 1 && isDraggingRef.current && currentZoom.current > 1) {
      // Pan
      currentPosition.current = {
        x: e.touches[0].clientX - dragStart.current.x,
        y: e.touches[0].clientY - dragStart.current.y,
      };
      
      constrainPosition();
      
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          updateImageTransform();
          rafId.current = null;
        });
      }
    }
  }, [constrainPosition, updateImageTransform]);

  const handleTouchEnd = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      if (imageRef.current) {
        imageRef.current.style.willChange = 'auto';
      }
      // Sync state for UI display
      setPosition(currentPosition.current);
      setZoom(currentZoom.current);
    }
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.5, Math.min(5, currentZoom.current + delta));
      currentZoom.current = newZoom;
      setZoom(newZoom);
      
      if (newZoom <= 1) {
        currentPosition.current = { x: 0, y: 0 };
        setPosition({ x: 0, y: 0 });
      } else {
        constrainPosition();
      }
      
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          updateImageTransform();
          rafId.current = null;
        });
      }
    }
  }, [constrainPosition, updateImageTransform]);

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
    if (zoom <= 1) {
      currentPosition.current = { x: 0, y: 0 };
      setPosition({ x: 0, y: 0 });
    } else {
      constrainPosition();
    }
    updateImageTransform();
  }, [zoom, constrainPosition, updateImageTransform]);

  // Sync rotation changes
  useEffect(() => {
    currentRotation.current = rotation;
    updateImageTransform();
  }, [rotation, updateImageTransform]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
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
      style={{ cursor: currentZoom.current > 1 && isDragging ? 'grabbing' : currentZoom.current > 1 ? 'grab' : 'default' }}
    >
      {/* Image Container */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
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
          className={`max-w-full max-h-full object-contain ${
            isLoading ? 'opacity-0' : 'opacity-100'
          } ${!isDragging ? 'transition-transform duration-200' : ''}`}
          style={{
            transformOrigin: 'center center',
            willChange: isDragging ? 'transform' : 'auto',
          }}
          onLoad={() => {
            setIsLoading(false);
            updateImageTransform();
          }}
          onError={() => {
            setIsLoading(false);
            setError(true);
          }}
          draggable={false}
        />
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/70 backdrop-blur-md rounded-lg p-2 border border-white/10">
        {/* Zoom Controls */}
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 h-9 w-9"
          onClick={() => {
            const newZoom = Math.max(0.5, currentZoom.current - 0.25);
            currentZoom.current = newZoom;
            setZoom(newZoom);
          }}
          disabled={zoom <= 0.5}
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-white text-sm min-w-[60px] text-center font-medium">
          {Math.round(currentZoom.current * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 h-9 w-9"
          onClick={() => {
            const newZoom = Math.min(5, currentZoom.current + 0.25);
            currentZoom.current = newZoom;
            setZoom(newZoom);
          }}
          disabled={zoom >= 5}
          title="Zoom In (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-white/30 mx-1" />

        {/* Reset */}
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 h-9 w-9"
          onClick={() => {
            currentZoom.current = 1;
            currentPosition.current = { x: 0, y: 0 };
            currentRotation.current = 0;
            setZoom(1);
            setPosition({ x: 0, y: 0 });
            setRotation(0);
            updateImageTransform();
          }}
          title="Reset (0)"
        >
          <RotateCw className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-white/30 mx-1" />

        {/* Rotate */}
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 h-9 w-9"
          onClick={() => {
            const newRotation = (currentRotation.current + 90) % 360;
            currentRotation.current = newRotation;
            setRotation(newRotation);
          }}
          title="Rotate (R)"
        >
          <RotateCw className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-white/30 mx-1" />

        {/* Fullscreen */}
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 h-9 w-9"
          onClick={toggleFullscreen}
          title="Toggle Fullscreen (F)"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </Button>

        <div className="w-px h-6 bg-white/30 mx-1" />

        {/* Download */}
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 h-9 w-9"
          onClick={handleDownload}
          title="Download"
        >
          <Download className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-white/30 mx-1" />

        {/* Close */}
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 h-9 w-9"
          onClick={onClose}
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Mobile Instructions */}
      <div className="absolute bottom-4 left-4 right-4 md:hidden">
        <div className="bg-black/70 backdrop-blur-md rounded-lg p-3 border border-white/10 text-white text-xs">
          <p className="font-medium mb-1">Touch Gestures:</p>
          <p>• Pinch to zoom • Drag to pan • Tap controls for more options</p>
        </div>
      </div>

      {/* Desktop Instructions */}
      <div className="absolute bottom-4 left-4 hidden md:block">
        <div className="bg-black/70 backdrop-blur-md rounded-lg p-3 border border-white/10 text-white text-xs">
          <p className="font-medium mb-1">Keyboard Shortcuts:</p>
          <p>+/- Zoom | 0 Reset | R Rotate | F Fullscreen | Esc Close</p>
        </div>
      </div>
    </div>
  );
}

