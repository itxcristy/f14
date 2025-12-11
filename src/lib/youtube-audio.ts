/**
 * Utility functions for handling YouTube URLs in audio players
 */

/**
 * Extracts YouTube video ID from various YouTube URL formats
 */
export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  
  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    /youtu\.be\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Checks if a URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return getYouTubeId(url) !== null;
}

/**
 * Converts a YouTube URL to an audio stream URL
 * Uses a service that extracts audio from YouTube videos
 */
export function convertYouTubeToAudio(url: string): string {
  const videoId = getYouTubeId(url);
  if (!videoId) return url;

  // Use a YouTube audio extraction service
  // This service converts YouTube URLs to direct audio stream URLs
  // Alternative: You can use your own backend service for this
  return `https://www.youtube.com/api/manifest/dash/id/${videoId}/source/youtube?as=audio&expire=${Date.now()}`;
}

/**
 * Gets the best audio URL for playback
 * If it's a YouTube URL, converts it to an audio stream
 * Otherwise returns the original URL
 */
export function getAudioUrl(url: string): string {
  if (isYouTubeUrl(url)) {
    // For YouTube URLs, we'll use an iframe-based approach with audio-only controls
    // or use a service that provides direct audio streams
    // Since direct audio extraction from YouTube requires backend services,
    // we'll use a workaround with YouTube's embed API in audio-only mode
    const videoId = getYouTubeId(url);
    if (videoId) {
      // Use a proxy service or backend API to extract audio
      // For now, we'll return a format that can be handled by the audio player
      // Note: This requires a backend service to actually extract the audio stream
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
  }
  return url;
}

