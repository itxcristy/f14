import { sanitizeYouTubeUrl, sanitizeUrl } from '@/lib/sanitize';

interface VideoPlayerProps {
  src: string;
  title?: string;
}

export function VideoPlayer({ src, title }: VideoPlayerProps) {
  // Sanitize and validate URL
  const sanitizedUrl = sanitizeYouTubeUrl(src) || sanitizeUrl(src);
  if (!sanitizedUrl) {
    return (
      <div className="bg-card rounded-xl p-8 text-center text-muted-foreground">
        Invalid video URL
      </div>
    );
  }

  // Check if it's a YouTube URL
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&\n?#]+)/);
    return match ? match[1] : null;
  };

  const youtubeId = getYouTubeId(sanitizedUrl);

  if (youtubeId) {
    return (
      <div className="bg-card rounded-xl overflow-hidden shadow-soft">
        {title && (
          <p className="text-sm text-muted-foreground p-4 pb-0 font-medium">{title}</p>
        )}
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={title || 'Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </div>
    );
  }

  // Direct video URL
  return (
    <div className="bg-card rounded-xl overflow-hidden shadow-soft">
      {title && (
        <p className="text-sm text-muted-foreground p-4 pb-0 font-medium">{title}</p>
      )}
      <video
        src={sanitizedUrl}
        controls
        className="w-full aspect-video"
        preload="metadata"
        onError={(e) => {
          const target = e.target as HTMLVideoElement;
          target.style.display = 'none';
          const errorDiv = document.createElement('div');
          errorDiv.className = 'bg-card rounded-xl p-8 text-center text-muted-foreground';
          errorDiv.textContent = 'Failed to load video. The URL may be invalid or the video may not be accessible.';
          target.parentElement?.appendChild(errorDiv);
        }}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
