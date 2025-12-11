import { Link } from 'react-router-dom';
import { Play, Eye, Volume2, Video, ArrowUpRight } from 'lucide-react';
import type { Piece } from '@/lib/supabase-types';

interface PieceCardProps {
  piece: Piece;
  index?: number;
  compact?: boolean;
}

export function PieceCard({ piece, index = 0, compact = false }: PieceCardProps) {
  const hasAudio = !!piece.audio_url;
  const hasVideo = !!piece.video_url;
  const hasImage = !!piece.image_url;
  
  if (compact) {
    return (
      <Link
        to={`/piece/${piece.id}`}
        className="group flex items-center gap-4 p-4 rounded-xl bg-card hover:bg-secondary/50 transition-all duration-300 animate-slide-up opacity-0"
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        {hasImage ? (
          <img 
            src={piece.image_url!} 
            alt={piece.title}
            className="w-11 h-11 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:scale-105 transition-all duration-300">
            <Play className="w-4 h-4 text-primary group-hover:text-primary-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-arabic text-base font-semibold text-foreground truncate text-right" dir="rtl">
            {piece.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {piece.reciter || piece.language}
          </p>
        </div>
        <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
      </Link>
    );
  }
  
  return (
    <Link
      to={`/piece/${piece.id}`}
      className="group relative overflow-hidden bg-card rounded-2xl shadow-soft transition-all duration-500 hover:shadow-card hover:-translate-y-1 animate-slide-up opacity-0"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      {/* Cover Image */}
      {hasImage && (
        <div className="relative h-40 overflow-hidden">
          <img 
            src={piece.image_url!} 
            alt={piece.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
        </div>
      )}
      
      <div className={`relative z-10 p-6 ${hasImage ? 'pt-4' : ''}`}>
        {/* Background gradient on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="relative z-10">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-arabic text-xl font-bold text-foreground mb-2.5 group-hover:text-primary transition-colors duration-300 text-right leading-relaxed" dir="rtl">
                {piece.title}
              </h3>
              
              {/* Meta badges */}
              <div className="flex flex-wrap items-center gap-2">
                {piece.reciter && (
                  <span className="badge-gold">
                    {piece.reciter}
                  </span>
                )}
                <span className="badge-primary">
                  {piece.language}
                </span>
              </div>
            </div>
            
            {/* Media indicators */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              {hasAudio && (
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors duration-300">
                  <Volume2 className="w-4 h-4 text-primary group-hover:text-primary-foreground" />
                </div>
              )}
              {hasVideo && (
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent transition-colors duration-300">
                  <Video className="w-4 h-4 text-accent group-hover:text-accent-foreground" />
                </div>
              )}
              {!hasAudio && !hasVideo && !hasImage && (
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary transition-colors duration-300">
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary-foreground" />
                </div>
              )}
            </div>
          </div>
          
          {/* Preview text */}
          {!hasImage && (
            <p className="text-sm text-muted-foreground font-arabic text-right line-clamp-2 leading-relaxed mb-4" dir="rtl">
              {piece.text_content.slice(0, 150)}...
            </p>
          )}
          
          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {piece.view_count > 0 && (
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  {piece.view_count.toLocaleString()} views
                </span>
              )}
            </div>
            
            <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1">
              Read now
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
