import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Sparkles, ArrowRight, TrendingUp, Clock, Star, History, Heart, Users, Mic } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CategoryCard } from '@/components/CategoryCard';
import { PieceCard } from '@/components/PieceCard';
import { SearchBar } from '@/components/SearchBar';
import { UpcomingEvents } from '@/components/UpcomingEvents';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useFavorites } from '@/hooks/use-favorites';
import { useReadingProgress } from '@/hooks/use-reading-progress';
import { useUserRole } from '@/hooks/use-user-role';
import { safeQuery } from '@/lib/db-utils';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { toast } from '@/hooks/use-toast';
import type { Category, Piece, Imam, AhlulBaitEvent } from '@/lib/supabase-types';
import { Cake, Heart, Flame, Info, Calendar } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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
  const [artists, setArtists] = useState<Array<{ name: string; count: number }>>([]);
  const { favorites } = useFavorites();
  const { getRecentlyRead } = useReadingProgress();

  useEffect(() => {
    // Wait for role loading to complete before fetching data
    // This prevents race conditions after page refresh
    if (!roleLoading) {
      fetchData();
      showUpcomingEventToast();
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
      const [catRes, recentRes, popularRes, imamRes, artistsRes] = await Promise.all([
        safeQuery(async () => await supabase.from('categories').select('*').order('name')),
        safeQuery(async () => await supabase.from('pieces').select('*').order('created_at', { ascending: false }).limit(6)),
        safeQuery(async () => await supabase.from('pieces').select('*').order('view_count', { ascending: false }).limit(4)),
        safeQuery(async () => await supabase.from('imams').select('*').order('order_index, name')),
        safeQuery(async () => await supabase.from('pieces').select('reciter').not('reciter', 'is', null)),
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

      // Process artists/reciters
      if (artistsRes.error) {
        logger.error('Error fetching artists:', artistsRes.error);
      } else if (artistsRes.data) {
        // Count pieces per reciter
        const reciterCounts = new Map<string, number>();
        artistsRes.data.forEach((piece: any) => {
          if (piece.reciter) {
            reciterCounts.set(piece.reciter, (reciterCounts.get(piece.reciter) || 0) + 1);
          }
        });
        
        // Convert to array and sort by count (descending)
        const artistsArray = Array.from(reciterCounts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12); // Show top 12 artists
        
        setArtists(artistsArray);
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

    // Check rate limit
    if (!checkRateLimit(RATE_LIMITS.search, (remaining, resetTime) => {
      toast({
        title: 'Too many searches',
        description: `Please wait ${Math.ceil(resetTime / 1000)} seconds before searching again.`,
        variant: 'destructive',
      });
    })) {
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
                <p className="text-sm text-muted-foreground">Recitations</p>
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
        {/* Upcoming Events Section */}
        <UpcomingEvents />

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

            {/* Browse by Ahlulbayt */}
            {imams.length > 0 && (
              <section className="py-12">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Browse by Ahlulbayt (AS)</h2>
                      <p className="text-sm text-muted-foreground">Recitations in honor of the Holy Personalities</p>
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

            {/* Browse by Artists */}
            {artists.length > 0 && (
              <section className="py-12">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <Mic className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Browse by Artists</h2>
                      <p className="text-sm text-muted-foreground">Discover recitations by your favorite artists</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {artists.map((artist, i) => {
                    // Generate initials from name
                    const getInitials = (name: string) => {
                      const words = name.trim().split(/\s+/);
                      if (words.length >= 2) {
                        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
                      }
                      return name.substring(0, 2).toUpperCase();
                    };

                    // Generate gradient color based on name
                    const colors = [
                      'from-primary to-accent',
                      'from-purple-500 to-pink-500',
                      'from-blue-500 to-cyan-500',
                      'from-emerald-500 to-teal-500',
                      'from-amber-500 to-orange-500',
                      'from-rose-500 to-pink-500',
                    ];
                    const colorIndex = artist.name.charCodeAt(0) % colors.length;
                    const gradient = colors[colorIndex];

                    return (
                      <Link
                        key={artist.name}
                        to={`/artist/${encodeURIComponent(artist.name)}`}
                        className="group flex flex-col items-center p-4 rounded-xl bg-card hover:bg-secondary/50 transition-all duration-300 animate-slide-up opacity-0"
                        style={{ animationDelay: `${i * 0.05}s` }}
                      >
                        <Avatar className="w-16 h-16 mb-3 group-hover:scale-110 transition-transform duration-300">
                          <AvatarFallback className={`bg-gradient-to-br ${gradient} text-white font-bold text-lg shadow-elevated`}>
                            {getInitials(artist.name)}
                          </AvatarFallback>
                        </Avatar>
                        <h3 className="font-semibold text-foreground text-sm text-center group-hover:text-primary transition-colors line-clamp-2">
                          {artist.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {artist.count} {artist.count === 1 ? 'recitation' : 'recitations'}
                        </p>
                      </Link>
                    );
                  })}
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
                      <p className="text-sm text-muted-foreground">Recitations you've saved</p>
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
                      <p className="text-sm text-muted-foreground">Top viewed recitations</p>
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
                    Help preserve and share islamic poetry. Add your favorite recitations to our growing library.
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
