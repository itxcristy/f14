import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Cake, Heart, Flame, Info, ChevronRight, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { safeQuery } from '@/lib/db-utils';
import { logger } from '@/lib/logger';
import type { AhlulBaitEvent, EventType } from '@/lib/supabase-types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function UpcomingEvents() {
  const [upcomingEvents, setUpcomingEvents] = useState<AhlulBaitEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<(AhlulBaitEvent & { nextOccurrence: Date; daysUntil: number }) | null>(null);

  useEffect(() => {
    fetchUpcomingEvents();
  }, []);

  const fetchUpcomingEvents = async () => {
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Fetch all annual events
      const { data, error } = await safeQuery(async () =>
        await supabase
          .from('ahlul_bait_events')
          .select(`
            *,
            imam:imams(*)
          `)
          .eq('is_annual', true)
      );

      if (error) {
        logger.error('Error fetching upcoming events:', error);
      } else if (data) {
        // For annual events, calculate the next occurrence based on month/day
        const eventsWithNextOccurrence = data
          .map((event: any) => {
            const eventDate = new Date(event.event_date);
            const currentYear = today.getFullYear();
            
            // Create date for this year using the month and day from the stored date
            let eventThisYear = new Date(currentYear, eventDate.getMonth(), eventDate.getDate());
            
            // If the date has passed this year, use next year
            if (eventThisYear < today) {
              eventThisYear = new Date(currentYear + 1, eventDate.getMonth(), eventDate.getDate());
            }
            
            const daysUntil = Math.ceil((eventThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            return {
              ...event,
              nextOccurrence: eventThisYear,
              daysUntil
            };
          })
          .filter((event: any) => event.daysUntil >= 0 && event.daysUntil <= 90) // Show events within next 90 days
          .sort((a: any, b: any) => a.daysUntil - b.daysUntil); // Show all upcoming events
        
        setUpcomingEvents(eventsWithNextOccurrence as AhlulBaitEvent[]);
      }
    } catch (error) {
      logger.error('Unexpected error fetching upcoming events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (eventType: EventType, size: 'sm' | 'md' = 'md') => {
    const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    switch (eventType) {
      case 'birthday':
        return <Cake className={iconSize} />;
      case 'death':
        return <Heart className={iconSize} />;
      case 'martyrdom':
        return <Flame className={iconSize} />;
      default:
        return <Info className={iconSize} />;
    }
  };

  const getEventColor = (eventType: EventType) => {
    switch (eventType) {
      case 'birthday':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'death':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'martyrdom':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default:
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysUntilText = (days: number) => {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  };

  if (loading) {
    return (
      <section className="py-8">
        <div className="container">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Upcoming Events</h2>
              <p className="text-sm text-muted-foreground">Important dates of Ahlul Bait (AS)</p>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 w-64 flex-shrink-0 bg-card rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (upcomingEvents.length === 0) {
    return null;
  }

  return (
    <section className="py-8">
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Upcoming Events</h2>
              <p className="text-sm text-muted-foreground">Important dates of Ahlul Bait (AS)</p>
            </div>
          </div>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/calendar">
              View Full Calendar
              <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>

        <div 
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 cursor-grab active:cursor-grabbing select-none"
          style={{ 
            WebkitUserSelect: 'none',
            userSelect: 'none',
            touchAction: 'pan-x',
            WebkitOverflowScrolling: 'touch'
          }}
          onMouseDown={(e) => {
            // Don't start drag if clicking on a button
            if ((e.target as HTMLElement).closest('button')) {
              return;
            }

            const element = e.currentTarget;
            const startX = e.pageX - element.offsetLeft;
            const scrollLeft = element.scrollLeft;
            let isDown = true;
            let hasMoved = false;

            const handleMouseMove = (e: MouseEvent) => {
              if (!isDown) return;
              const x = e.pageX - element.offsetLeft;
              const walk = (x - startX) * 2;
              
              // Only prevent default if we've actually moved
              if (Math.abs(walk) > 5) {
                hasMoved = true;
                e.preventDefault();
                element.scrollLeft = scrollLeft - walk;
              }
            };

            const handleMouseUp = (e: MouseEvent) => {
              isDown = false;
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
              
              // If we didn't move much, it was a click, not a drag
              // Allow default click behavior for buttons
              if (!hasMoved && (e.target as HTMLElement).closest('button')) {
                const button = (e.target as HTMLElement).closest('button');
                if (button) {
                  button.click();
                }
              }
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        >
          {upcomingEvents.map((event, index) => {
            const eventDate = new Date(event.event_date);
            const currentYear = new Date().getFullYear();
            let eventThisYear = new Date(currentYear, eventDate.getMonth(), eventDate.getDate());
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (eventThisYear < today) {
              eventThisYear = new Date(currentYear + 1, eventDate.getMonth(), eventDate.getDate());
            }
            
            const daysUntil = Math.ceil((eventThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const eventWithDetails = { ...event, nextOccurrence: eventThisYear, daysUntil };

            return (
              <Card 
                key={event.id} 
                className={`flex-shrink-0 w-64 overflow-hidden border-2 transition-all duration-300 hover:shadow-elevated select-none ${getEventColor(event.event_type)}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg ${getEventColor(event.event_type)}`}>
                      {getEventIcon(event.event_type, 'sm')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-background/50">
                        {getDaysUntilText(daysUntil)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(eventWithDetails);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <h3 className="text-sm font-bold text-foreground mb-1 line-clamp-1">
                    {event.event_name}
                  </h3>
                  
                  {event.imam && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                      {event.imam.name}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span className="line-clamp-1">{formatDate(eventThisYear)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Preview Dialog */}
        <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-3 rounded-xl ${selectedEvent ? getEventColor(selectedEvent.event_type) : ''}`}>
                  {selectedEvent && getEventIcon(selectedEvent.event_type)}
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-left">
                    {selectedEvent?.event_name}
                  </DialogTitle>
                  {selectedEvent?.imam && (
                    <DialogDescription className="text-left mt-1">
                      {selectedEvent.imam.name}
                      {selectedEvent.imam.title && ` - ${selectedEvent.imam.title}`}
                    </DialogDescription>
                  )}
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {selectedEvent && formatDate(selectedEvent.nextOccurrence)}
                </span>
                <span className="ml-auto text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {selectedEvent && getDaysUntilText(selectedEvent.daysUntil)}
                </span>
              </div>
              
              {selectedEvent?.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedEvent.description}
                </p>
              )}
              
              {selectedEvent?.imam && (
                <Button 
                  asChild 
                  variant="outline" 
                  size="sm" 
                  className="w-full rounded-xl"
                >
                  <Link to={`/figure/${selectedEvent.imam.slug}`} onClick={() => setSelectedEvent(null)}>
                    View Recitations
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}