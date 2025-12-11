import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Sparkles, ArrowRight, TrendingUp, Clock, Star, History, Heart, Users } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CategoryCard } from '@/components/CategoryCard';
import { PieceCard } from '@/components/PieceCard';
import { SearchBar } from '@/components/SearchBar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useFavorites } from '@/hooks/use-favorites';
import { useReadingProgress } from '@/hooks/use-reading-progress';
import { useUserRole } from '@/hooks/use-user-role';
import { safeQuery } from '@/lib/db-utils';
import { logger } from '@/lib/logger';
import type { Category, Piece, Imam } from '@/lib/supabase-types';

export default function Index() {
  const { role, loading: roleLoading } = useUserRole();
  const [categories, setCategories] = useState<Category[]>([]);
  const [imams, setImams] = useState<Imam[]>([]);
  const [searchResults, setSearchResults] = useState<Piece[]>([]);
  const [recentPieces, setRecentPieces] = useState<Piece[]>([]);
  const [popularPieces, setPopularPieces] = useState<Piece[]>([]);
  const [continueReadingPieces, setContinueReadingPieces] = useState<Piece[]>([]);
  const [favoritePieces, setFavoritePieces] = useState<Piece[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ categories: 0, pieces: 0 });
  const { favorites } = useFavorites();
  const { getRecentlyRead } = useReadingProgress();

  useEffect(() => {
    // Wait for role loading to complete before fetching data
    // This prevents race conditions after page refresh
    if (!roleLoading) {
      fetchData();
    }
  }, [roleLoading]);

  // Fetch continue reading and favorite pieces when data is available
  useEffect(() => {
    const fetchContinueReading = async () => {
      const recentlyRead = getRecentlyRead(4);
      if (recentlyRead.length > 0) {
        const pieceIds = recentlyRead.map(r => r.pieceId);
        const { data, error } = await safeQuery(async () =>
          await supabase
            .from('pieces')
            .select('*')
            .in('id', pieceIds)
        );
        if (error) {
          logger.error('Error fetching continue reading:', error);
        } else if (data) {
          setContinueReadingPieces(data as Piece[]);
        }
      }
    };

    const fetchFavorites = async () => {
      if (favorites.length > 0) {
        const { data, error } = await safeQuery(async () =>
          await supabase
            .from('pieces')
            .select('*')
            .in('id', favorites.slice(0, 4))
        );
        if (error) {
          logger.error('Error fetching favorites:', error);
        } else if (data) {
          setFavoritePieces(data as Piece[]);
        }
      }
    };

    fetchContinueReading();
    fetchFavorites();
  }, [favorites, getRecentlyRead]);

  const fetchData = async () => {
    logger.debug('Index: Starting fetchData');
    try {
      logger.debug('Index: Executing queries');
      const [catRes, recentRes, popularRes, imamRes] = await Promise.all([
        safeQuery(async () => await supabase.from('categories').select('*').order('name')),
        safeQuery(async () => await supabase.from('pieces').select('*').order('created_at', { ascending: false }).limit(6)),
        safeQuery(async () => await supabase.from('pieces').select('*').order('view_count', { ascending: false }).limit(4)),
        safeQuery(async () => await supabase.from('imams').select('*').order('order_index, name')),
      ]);
      
      logger.debug('Index: Queries completed', {
        categories: { hasData: !!catRes.data, hasError: !!catRes.error, count: catRes.data?.length },
        recent: { hasData: !!recentRes.data, hasError: !!recentRes.error, count: recentRes.data?.length },
        popular: { hasData: !!popularRes.data, hasError: !!popularRes.error, count: popularRes.data?.length },
        imams: { hasData: !!imamRes.data, hasError: !!imamRes.error, count: imamRes.data?.length },
      });

      if (catRes.error) {
        logger.error('Error fetching categories:', catRes.error);
      } else if (catRes.data) {
        setCategories(catRes.data as Category[]);
        setStats(prev => ({ ...prev, categories: catRes.data!.length }));
      }

      if (recentRes.error) {
        logger.error('Error fetching recent pieces:', recentRes.error);
      } else if (recentRes.data) {
        setRecentPieces(recentRes.data as Piece[]);
        setStats(prev => ({ ...prev, pieces: recentRes.data!.length }));
      }

      if (popularRes.error) {
        logger.error('Error fetching popular pieces:', popularRes.error);
      } else if (popularRes.data) {
        setPopularPieces(popularRes.data as Piece[]);
      }

      if (imamRes.error) {
        logger.error('Error fetching imams:', imamRes.error);
      } else if (imamRes.data) {
        setImams(imamRes.data as Imam[]);
      }
    } catch (error) {
      logger.error('Unexpected error in fetchData:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    const { data, error } = await safeQuery(async () =>
      await supabase
        .from('pieces')
        .select('*')
        .or(`title.ilike.%${query}%,text_content.ilike.%${query}%,reciter.ilike.%${query}%`)
        .limit(20)
    );

    if (error) {
      logger.error('Error searching:', error);
      setSearchResults([]);
    } else if (data) {
      setSearchResults(data as Piece[]);
    }
    setIsSearching(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden hero-pattern">
        <div className="container py-16 md:py-24">
          <div className="text-center max-w-4xl mx-auto animate-fade-in">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 shadow-soft text-sm mb-8">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-muted-foreground">Your Spiritual Companion</span>
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            
            {/* Heading */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
              Discover the Beauty of
              <span className="block text-gradient mt-2">islamic poetry</span>
            </h1>
            
            {/* Description */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Explore Naat, Manqabat, Noha, Dua, Marsiya, and more. 
              Read, listen, and connect with your spiritual heritage.
            </p>

            {/* Search */}
            <div className="mb-12">
              <SearchBar 
                onSearch={handleSearch}
                placeholder="Search for Naat, Noha, Dua, reciter..."
              />
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center gap-8 md:gap-12">
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-gradient">{stats.categories}</p>
                <p className="text-sm text-muted-foreground">Categories</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-gradient-gold">{recentPieces.length}+</p>
                <p className="text-sm text-muted-foreground">Pieces</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-gradient">∞</p>
                <p className="text-sm text-muted-foreground">Blessings</p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary/5 blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-accent/5 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </section>

      <main className="container pb-20">
        {/* Search Results */}
        {isSearching ? (
          <section className="animate-fade-in py-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-1">
                  Search Results
                </h2>
                <p className="text-muted-foreground">
                  {searchResults.length} results for "{searchQuery}"
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setIsSearching(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="rounded-xl"
              >
                Clear search
              </Button>
            </div>
            
            {searchResults.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-5">
                {searchResults.map((piece, i) => (
                  <PieceCard key={piece.id} piece={piece} index={i} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-card rounded-3xl">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No results found</h3>
                <p className="text-muted-foreground">Try searching with different keywords</p>
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Categories Section */}
            <section className="py-12">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                    Browse Categories
                  </h2>
                  <p className="text-muted-foreground">Explore our collection of Islamic content</p>
                </div>
              </div>
              
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-48 bg-card rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {categories.map((category, i) => (
                    <CategoryCard key={category.id} category={category} index={i} />
                  ))}
                </div>
              )}
            </section>

            {/* Browse by Figure */}
            {imams.length > 0 && (
              <section className="py-12">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Browse by Figure</h2>
                      <p className="text-sm text-muted-foreground">Recitations dedicated to Ahlulbayt</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {imams.slice(0, 8).map((imam, i) => (
                    <Link
                      key={imam.id}
                      to={`/figure/${imam.slug}`}
                      className="group p-4 rounded-xl bg-card hover:bg-secondary/50 transition-all duration-300 animate-slide-up opacity-0 text-center"
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary group-hover:scale-105 transition-all duration-300">
                        <Users className="w-6 h-6 text-primary group-hover:text-primary-foreground" />
                      </div>
                      <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                        {imam.name}
                      </h3>
                      {(imam.description || imam.title) && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{imam.description || imam.title}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Continue Reading */}
            {continueReadingPieces.length > 0 && (
              <section className="py-12">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <History className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Continue Reading</h2>
                      <p className="text-sm text-muted-foreground">Pick up where you left off</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-5">
                  {continueReadingPieces.map((piece, i) => (
                    <PieceCard key={piece.id} piece={piece} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Your Favorites */}
            {favoritePieces.length > 0 && (
              <section className="py-12">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                      <Heart className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Your Favorites</h2>
                      <p className="text-sm text-muted-foreground">Pieces you've saved</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link to="/favorites">
                      View All
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
                
                <div className="grid md:grid-cols-2 gap-5">
                  {favoritePieces.map((piece, i) => (
                    <PieceCard key={piece.id} piece={piece} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Popular Pieces */}
            {popularPieces.length > 0 && (
              <section className="py-12">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Most Popular</h2>
                      <p className="text-sm text-muted-foreground">Top viewed pieces</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-5">
                  {popularPieces.map((piece, i) => (
                    <PieceCard key={piece.id} piece={piece} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Recent Pieces */}
            {recentPieces.length > 0 && (
              <section className="py-12">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Recently Added</h2>
                      <p className="text-sm text-muted-foreground">Latest additions to our collection</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {recentPieces.map((piece, i) => (
                    <PieceCard key={piece.id} piece={piece} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* CTA Section */}
            <section className="py-12">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-emerald-light p-8 md:p-12">
                <div className="relative z-10 text-center">
                  <Star className="w-12 h-12 text-primary-foreground/80 mx-auto mb-4" />
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-3">
                    Contribute to Our Collection
                  </h2>
                  <p className="text-primary-foreground/80 max-w-xl mx-auto mb-6">
                    Help preserve and share islamic poetry. Add your favorite pieces to our growing library.
                  </p>
                  <Button asChild size="lg" className="rounded-xl bg-card text-foreground hover:bg-card/90 shadow-elevated">
                    <Link to="/auth">
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
                
                {/* Decorative */}
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 blur-2xl" />
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
