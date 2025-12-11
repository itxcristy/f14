import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, User, Globe, Bookmark, Eye, Calendar,
  Clock, Hash, Tag, Users, Maximize2, X as XIcon, ZoomIn, ZoomOut
} from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ReaderToolbar } from '@/components/ReaderToolbar';
import { SettingsPanel } from '@/components/SettingsPanel';
import { EnhancedAudioPlayer } from '@/components/EnhancedAudioPlayer';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { useSettings } from '@/hooks/use-settings';
import { useFavorites } from '@/hooks/use-favorites';
import { useReadingProgress } from '@/hooks/use-reading-progress';
import { supabase } from '@/integrations/supabase/client';
import { safeQuery } from '@/lib/db-utils';
import { logger } from '@/lib/logger';
import type { Piece, Category, Imam } from '@/lib/supabase-types';

export default function PiecePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { addToRecentlyViewed } = useFavorites();
  const { saveProgress, getProgress } = useReadingProgress();
  
  const [piece, setPiece] = useState<Piece | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [imam, setImam] = useState<Imam | null>(null);
  const [siblingPieces, setSiblingPieces] = useState<{ prev?: Piece; next?: Piece }>({});
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentVerse, setCurrentVerse] = useState(0);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  
  const contentRef = useRef<HTMLDivElement>(null);
  const verseRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (id) {
      fetchPiece();
      incrementViewCount();
      addToRecentlyViewed(id);
    }
  }, [id]);

  // Restore reading progress
  useEffect(() => {
    if (piece && id) {
      const progress = getProgress(id);
      if (progress && progress.scrollPosition > 0) {
        setTimeout(() => {
          window.scrollTo({ top: progress.scrollPosition, behavior: 'smooth' });
        }, 500);
      }
    }
  }, [piece, id]);

  // Save reading progress on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (id) {
        saveProgress(id, { 
          scrollPosition: window.scrollY,
          currentVerse
        });
      }
    };

    const throttledScroll = throttle(handleScroll, 1000);
    window.addEventListener('scroll', throttledScroll);
    return () => window.removeEventListener('scroll', throttledScroll);
  }, [id, currentVerse]);

  const fetchPiece = async () => {
    try {
      const { data, error } = await safeQuery(async () =>
        await supabase
          .from('pieces')
          .select('*')
          .eq('id', id)
          .maybeSingle()
      );

      if (error) {
        logger.error('Error fetching piece:', error);
        setLoading(false);
        return;
      }

      if (!data) {
        setLoading(false);
        return;
      }

      const typedPiece = data as Piece;
      setPiece(typedPiece);

      // Fetch category
      const { data: catData, error: catError } = await safeQuery(async () =>
        await supabase
          .from('categories')
          .select('*')
          .eq('id', typedPiece.category_id)
          .maybeSingle()
      );

      if (catError) {
        logger.error('Error fetching category:', catError);
      } else if (catData) {
        setCategory(catData as Category);
        
        // Fetch sibling pieces for navigation
        const { data: siblings, error: siblingsError } = await safeQuery(async () =>
          await supabase
            .from('pieces')
            .select('*')
            .eq('category_id', typedPiece.category_id)
            .order('title')
        );
        
        if (siblingsError) {
          logger.error('Error fetching siblings:', siblingsError);
        } else if (siblings) {
          const currentIndex = siblings.findIndex(s => s.id === id);
          setSiblingPieces({
            prev: currentIndex > 0 ? siblings[currentIndex - 1] as Piece : undefined,
            next: currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] as Piece : undefined,
          });
        }
      }

      // Fetch imam if exists
      if (typedPiece.imam_id) {
        const { data: imamData, error: imamError } = await safeQuery(async () =>
          await supabase
            .from('imams')
            .select('*')
            .eq('id', typedPiece.imam_id)
            .maybeSingle()
        );
        
        if (imamError) {
          logger.error('Error fetching imam:', imamError);
        } else if (imamData) {
          setImam(imamData as Imam);
        }
      }
    } catch (error) {
      logger.error('Unexpected error in fetchPiece:', error);
    } finally {
      setLoading(false);
    }
  };

  const incrementViewCount = async () => {
    if (id) {
      try {
        const { error } = await safeQuery(async () =>
          await supabase.rpc('increment_view_count', { piece_id: id })
        );
        if (error) {
          logger.error('Error incrementing view count:', error);
        }
      } catch (error) {
        logger.error('Unexpected error incrementing view count:', error);
      }
    }
  };

  const handlePrevious = () => {
    if (siblingPieces.prev) {
      navigate(`/piece/${siblingPieces.prev.id}`);
    }
  };

  const handleNext = () => {
    if (siblingPieces.next) {
      navigate(`/piece/${siblingPieces.next.id}`);
    }
  };

  const getFontFamily = () => {
    switch (settings.fontFamily) {
      case 'noto-nastaliq': return "'Noto Nastaliq Urdu', serif";
      case 'scheherazade': return "'Scheherazade New', serif";
      default: return "'Amiri', serif";
    }
  };

  const getReaderBgClass = () => {
    switch (settings.readerBackground) {
      case 'sepia': return 'bg-amber-50 dark:bg-amber-950/30';
      case 'dark': return 'bg-zinc-900 text-zinc-100';
      case 'paper': return 'bg-stone-100 dark:bg-stone-900';
      default: return 'bg-card';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="container py-8 max-w-4xl flex-1">
          <Skeleton className="h-6 w-32 mb-6" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <div className="flex gap-2 mb-8">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-32 w-full mb-8 rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </main>
      </div>
    );
  }

  if (!piece) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="container py-16 text-center flex-1">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <Bookmark className="w-10 h-10 text-muted-foreground" />
            </div>
            <h1 className="font-display text-2xl font-semibold mb-2">Content Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The piece you're looking for doesn't exist or has been removed.
            </p>
            <Button asChild>
              <Link to="/">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Process text content: handle break points and split into verses
  const processedText = piece.text_content
    .replace(/\|\|BREAK\|\|/g, '\n\n') // Convert break markers to double newlines
    .replace(/\n{3,}/g, '\n\n'); // Normalize multiple newlines to double newlines
  
  const verses = processedText.split('\n\n').filter(v => v.trim().length > 0);
  const wordCount = piece.text_content.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 150); // ~150 words per minute for poetry

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <ReaderToolbar
        pieceId={piece.id}
        pieceTitle={piece.title}
        textContent={piece.text_content}
        onSettingsOpen={() => setSettingsOpen(true)}
        onPrevious={handlePrevious}
        onNext={handleNext}
        hasPrevious={!!siblingPieces.prev}
        hasNext={!!siblingPieces.next}
      />
      
      <main className="container py-8 max-w-4xl flex-1">
        {/* Breadcrumb */}
        <Link 
          to={category ? `/category/${category.slug}` : '/'}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          {category ? category.name : 'Home'}
        </Link>

        {/* Header */}
        <header className="mb-8 text-center">
          {/* Cover Image - Enhanced */}
          {piece.image_url && (
            <div 
              className="relative w-full rounded-2xl overflow-hidden mb-6 cursor-pointer group"
              onClick={() => {
                setImageViewerOpen(true);
                setImageZoom(1);
              }}
            >
              <img 
                src={piece.image_url} 
                alt={piece.title}
                className="w-full h-auto max-h-[400px] md:max-h-[500px] object-contain bg-muted/30 transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 text-white text-xs flex items-center gap-2">
                  <Maximize2 className="w-4 h-4" />
                  Click to view full size
                </div>
              </div>
            </div>
          )}
          
          <h1 
            className="font-arabic text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-relaxed"
            dir="rtl"
            style={{ fontFamily: getFontFamily() }}
          >
            {piece.title}
          </h1>
          
          {/* Meta Info */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            {category && (
              <Badge variant="secondary" className="gap-1.5">
                <Bookmark className="w-3 h-3" />
                {category.name}
              </Badge>
            )}
            {imam && (
              <Link to={`/figure/${imam.slug}`}>
                <Badge variant="secondary" className="gap-1.5 hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                  <Users className="w-3 h-3" />
                  {imam.name}
                </Badge>
              </Link>
            )}
            {piece.reciter && (
              <Badge variant="outline" className="gap-1.5">
                <User className="w-3 h-3" />
                {piece.reciter}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1.5">
              <Globe className="w-3 h-3" />
              {piece.language}
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Clock className="w-3 h-3" />
              {readingTime} min read
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Eye className="w-3 h-3" />
              {piece.view_count} views
            </Badge>
          </div>

          {/* Tags */}
          {piece.tags && piece.tags.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              {piece.tags.map((tag, i) => (
                <span key={i} className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Audio Player */}
        {piece.audio_url && (
          <div className="mb-8">
            {isOffline ? (
              <div className="bg-card rounded-2xl p-6 text-center text-muted-foreground border border-dashed border-border">
                <p>Audio unavailable offline</p>
              </div>
            ) : (
              <EnhancedAudioPlayer 
                src={piece.audio_url} 
                title="Audio Recitation"
                onTimeUpdate={(time) => {
                  // Could sync with verse highlighting here
                }}
                onEnded={() => {
                  // Handle auto-play next
                  if (settings.autoPlayNext && siblingPieces.next) {
                    navigate(`/piece/${siblingPieces.next.id}`);
                  }
                }}
              />
            )}
          </div>
        )}

        {/* Video Player */}
        {piece.video_url && (
          <div className="mb-8">
            {isOffline ? (
              <div className="bg-card rounded-2xl p-6 text-center text-muted-foreground aspect-video flex items-center justify-center border border-dashed border-border">
                <p>Video unavailable offline</p>
              </div>
            ) : (
              <VideoPlayer src={piece.video_url} title="Video" />
            )}
          </div>
        )}

        {/* Image-Only Recitation Display */}
        {piece.image_url && (!piece.text_content || piece.text_content.trim().length < 10) ? (
          <article 
            className={`rounded-2xl p-6 md:p-10 lg:p-12 shadow-card border border-border/50 ${getReaderBgClass()} ${
              !settings.animationsEnabled ? '' : 'transition-all duration-300'
            }`}
          >
            <div className="flex flex-col items-center justify-center min-h-[400px]">
              <img 
                src={piece.image_url} 
                alt={piece.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => {
                  setImageViewerOpen(true);
                  setImageZoom(1);
                }}
              />
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Click image to view in full size
              </p>
            </div>
          </article>
        ) : (
          /* Text Content - Reader View */
          <article 
            ref={contentRef}
            className={`rounded-2xl p-6 md:p-10 lg:p-12 shadow-card border border-border/50 ${getReaderBgClass()} ${
              !settings.animationsEnabled ? '' : 'transition-all duration-300'
            }`}
          >
            <div 
              className={settings.compactMode ? 'space-y-2' : 'space-y-6'}
              style={{ 
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
                fontFamily: getFontFamily(),
                textAlign: settings.textAlign,
              }}
              dir="rtl"
            >
              {verses.map((verse, index) => (
                <div 
                  key={index}
                  ref={(el) => { verseRefs.current[index] = el; }}
                  className={`py-4 px-4 rounded-xl transition-all duration-300 ${
                    settings.highlightCurrentVerse && currentVerse === index 
                      ? 'bg-primary/10 border-l-4 border-primary' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  {settings.showVerseNumbers && (
                    <span className="inline-block text-xs text-muted-foreground bg-muted rounded-full w-6 h-6 leading-6 text-center ml-3 float-left">
                      {index + 1}
                    </span>
                  )}
                  {verse.split('\n').map((line, lineIndex) => (
                    <p key={lineIndex} className={lineIndex > 0 ? 'mt-2' : ''}>
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </article>
        )}

        {/* Decorative Element */}
        <div className="flex justify-center my-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-px bg-gradient-to-r from-transparent to-border" />
            <div className="w-3 h-3 rounded-full bg-accent" />
            <div className="w-16 h-px bg-gradient-to-l from-transparent to-border" />
          </div>
        </div>

        {/* Navigation to siblings */}
        {(siblingPieces.prev || siblingPieces.next) && (
          <div className="flex items-center justify-between gap-4 mt-8">
            {siblingPieces.prev ? (
              <Link
                to={`/piece/${siblingPieces.prev.id}`}
                className="flex-1 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors group"
              >
                <span className="text-xs text-muted-foreground">Previous</span>
                <p className="font-arabic text-lg font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1" dir="rtl">
                  {siblingPieces.prev.title}
                </p>
              </Link>
            ) : <div className="flex-1" />}
            
            {siblingPieces.next ? (
              <Link
                to={`/piece/${siblingPieces.next.id}`}
                className="flex-1 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors text-right group"
              >
                <span className="text-xs text-muted-foreground">Next</span>
                <p className="font-arabic text-lg font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1" dir="rtl">
                  {siblingPieces.next.title}
                </p>
              </Link>
            ) : <div className="flex-1" />}
          </div>
        )}
      </main>

      <Footer />
      
      <SettingsPanel 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
      />

      {/* Image Viewer Dialog */}
      {piece.image_url && (
        <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
          <DialogContent className="max-w-7xl w-full h-[90vh] p-0 bg-black/95">
            <div className="relative w-full h-full flex items-center justify-center">
              <img 
                src={piece.image_url} 
                alt={piece.title}
                className="max-w-full max-h-full object-contain transition-transform duration-300"
                style={{ transform: `scale(${imageZoom})` }}
              />
              
              {/* Controls */}
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-lg p-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setImageZoom(Math.max(0.5, imageZoom - 0.25))}
                  disabled={imageZoom <= 0.5}
                >
                  <ZoomOut className="w-5 h-5" />
                </Button>
                <span className="text-white text-sm min-w-[60px] text-center">
                  {Math.round(imageZoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setImageZoom(Math.min(3, imageZoom + 0.25))}
                  disabled={imageZoom >= 3}
                >
                  <ZoomIn className="w-5 h-5" />
                </Button>
                <div className="w-px h-6 bg-white/30 mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setImageZoom(1)}
                >
                  Reset
                </Button>
                <div className="w-px h-6 bg-white/30 mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setImageViewerOpen(false)}
                >
                  <XIcon className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Utility function
function throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
  let inThrottle = false;
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
}
