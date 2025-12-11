import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ChevronLeft, Filter, Grid3X3, List, SortAsc, 
  ArrowUpDown, Music, Video, Eye, Calendar
} from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PieceCard } from '@/components/PieceCard';
import { SearchBar } from '@/components/SearchBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { safeQuery } from '@/lib/db-utils';
import { logger } from '@/lib/logger';
import type { Category, Piece } from '@/lib/supabase-types';

type SortOption = 'title' | 'recent' | 'popular' | 'reciter';
type ViewMode = 'grid' | 'list';

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [filteredPieces, setFilteredPieces] = useState<Piece[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [reciters, setReciters] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedReciter, setSelectedReciter] = useState<string>('all');
  const [hasAudio, setHasAudio] = useState<boolean | null>(null);
  const [hasVideo, setHasVideo] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('title');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      fetchCategory();
    }
  }, [slug]);

  useEffect(() => {
    filterAndSortPieces();
  }, [pieces, selectedLanguage, selectedReciter, hasAudio, hasVideo, searchQuery, sortBy]);

  const fetchCategory = async () => {
    try {
      const { data: catData, error: catError } = await safeQuery(async () =>
        await supabase
          .from('categories')
          .select('*')
          .eq('slug', slug)
          .maybeSingle()
      );

      if (catError) {
        logger.error('Error fetching category:', catError);
        setLoading(false);
        return;
      }

      if (!catData) {
        setLoading(false);
        return;
      }

      setCategory(catData as Category);

      const { data: piecesData, error: piecesError } = await safeQuery(async () =>
        await supabase
          .from('pieces')
          .select('*')
          .eq('category_id', catData.id)
      );

      if (piecesError) {
        logger.error('Error fetching pieces:', piecesError);
      } else if (piecesData) {
        const typedPieces = piecesData as Piece[];
        setPieces(typedPieces);
        
        const uniqueLanguages = [...new Set(typedPieces.map(p => p.language))];
        setLanguages(uniqueLanguages);
        
        const uniqueReciters = [...new Set(typedPieces.map(p => p.reciter).filter(Boolean))] as string[];
        setReciters(uniqueReciters);
      }
    } catch (error) {
      logger.error('Unexpected error in fetchCategory:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortPieces = () => {
    let filtered = [...pieces];

    // Language filter
    if (selectedLanguage !== 'all') {
      filtered = filtered.filter(p => p.language === selectedLanguage);
    }

    // Reciter filter
    if (selectedReciter !== 'all') {
      filtered = filtered.filter(p => p.reciter === selectedReciter);
    }

    // Audio filter
    if (hasAudio === true) {
      filtered = filtered.filter(p => p.audio_url);
    } else if (hasAudio === false) {
      filtered = filtered.filter(p => !p.audio_url);
    }

    // Video filter
    if (hasVideo === true) {
      filtered = filtered.filter(p => p.video_url);
    } else if (hasVideo === false) {
      filtered = filtered.filter(p => !p.video_url);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.reciter?.toLowerCase().includes(query) ||
        p.text_content.toLowerCase().includes(query)
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'popular':
          return b.view_count - a.view_count;
        case 'reciter':
          return (a.reciter || '').localeCompare(b.reciter || '');
        case 'title':
        default:
          return a.title.localeCompare(b.title);
      }
    });

    setFilteredPieces(filtered);
  };

  const clearFilters = () => {
    setSelectedLanguage('all');
    setSelectedReciter('all');
    setHasAudio(null);
    setHasVideo(null);
    setSearchQuery('');
    setSortBy('title');
  };

  const hasActiveFilters = selectedLanguage !== 'all' || 
    selectedReciter !== 'all' || 
    hasAudio !== null || 
    hasVideo !== null ||
    searchQuery.trim() !== '';

  const stats = {
    total: filteredPieces.length,
    withAudio: filteredPieces.filter(p => p.audio_url).length,
    withVideo: filteredPieces.filter(p => p.video_url).length,
    totalViews: filteredPieces.reduce((sum, p) => sum + p.view_count, 0),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="container py-8 flex-1">
          <Skeleton className="h-6 w-32 mb-6" />
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96 mb-8" />
          <div className="flex gap-4 mb-8">
            <Skeleton className="h-12 flex-1" />
            <Skeleton className="h-12 w-32" />
          </div>
          <div className="grid gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="container py-16 text-center flex-1">
          <h1 className="font-display text-2xl font-semibold mb-4">Category Not Found</h1>
          <Button asChild>
            <Link to="/">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="container py-8 flex-1">
        {/* Breadcrumb */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-muted-foreground text-lg mb-4">{category.description}</p>
          )}
          
          {/* Stats */}
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary" className="gap-1.5">
              <SortAsc className="w-3 h-3" />
              {stats.total} pieces
            </Badge>
            {stats.withAudio > 0 && (
              <Badge variant="outline" className="gap-1.5">
                <Music className="w-3 h-3" />
                {stats.withAudio} with audio
              </Badge>
            )}
            {stats.withVideo > 0 && (
              <Badge variant="outline" className="gap-1.5">
                <Video className="w-3 h-3" />
                {stats.withVideo} with video
              </Badge>
            )}
            <Badge variant="outline" className="gap-1.5">
              <Eye className="w-3 h-3" />
              {stats.totalViews.toLocaleString()} views
            </Badge>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-8">
          {/* Search Row */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchBar 
                onSearch={setSearchQuery}
                placeholder={`Search in ${category.name}...`}
                initialValue={searchQuery}
              />
            </div>
            
            <div className="flex gap-2">
              {/* View Mode Toggle */}
              <div className="flex bg-card rounded-lg p-1 border border-border">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 px-3"
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-8 px-3"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Sort Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 gap-2">
                    <ArrowUpDown className="w-4 h-4" />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy('title')}>
                    Title (A-Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('recent')}>
                    Recently Added
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('popular')}>
                    Most Popular
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('reciter')}>
                    By Reciter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap gap-3">
            {languages.length > 1 && (
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  {languages.map(lang => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {reciters.length > 0 && (
              <Select value={selectedReciter} onValueChange={setSelectedReciter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Reciter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reciters</SelectItem>
                  {reciters.map(reciter => (
                    <SelectItem key={reciter} value={reciter}>{reciter}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              variant={hasAudio === true ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHasAudio(hasAudio === true ? null : true)}
              className="h-9 gap-1.5"
            >
              <Music className="w-3.5 h-3.5" />
              With Audio
            </Button>

            <Button
              variant={hasVideo === true ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHasVideo(hasVideo === true ? null : true)}
              className="h-9 gap-1.5"
            >
              <Video className="w-3.5 h-3.5" />
              With Video
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 text-muted-foreground"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Pieces */}
        {filteredPieces.length > 0 ? (
          <div className={
            viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
              : 'grid gap-4'
          }>
            {filteredPieces.map((piece, i) => (
              <PieceCard 
                key={piece.id} 
                piece={piece} 
                index={i} 
                compact={viewMode === 'grid'}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border">
            <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              {hasActiveFilters 
                ? 'No pieces match your filters'
                : 'No pieces in this category yet'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
