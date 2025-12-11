import { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, 
  Repeat, Repeat1, Music, Timer, Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSettings } from '@/hooks/use-settings';
import { isYouTubeUrl, getYouTubeId } from '@/lib/youtube-audio';

// YouTube IFrame API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface EnhancedAudioPlayerProps {
  src: string;
  title?: string;
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
}

export function EnhancedAudioPlayer({ 
  src, 
  title, 
  onTimeUpdate,
  onEnded 
}: EnhancedAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const { settings, updateSetting } = useSettings();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isLoading, setIsLoading] = useState(true);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const sleepTimerRef = useRef<NodeJS.Timeout>();
  const isYouTube = isYouTubeUrl(src);
  const youtubeId = isYouTube ? getYouTubeId(src) : null;

  // Load YouTube IFrame API for YouTube URLs
  useEffect(() => {
    if (!isYouTube || !youtubeId) return;

    const playerId = `youtube-player-${youtubeId}`;
    let interval: NodeJS.Timeout;

    const initPlayer = () => {
      if (youtubePlayerRef.current) return; // Already initialized

      const container = document.getElementById(playerId);
      if (!container) return;

      youtubePlayerRef.current = new window.YT.Player(playerId, {
        videoId: youtubeId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          showinfo: 0,
        },
        events: {
          onReady: (event: any) => {
            const player = event.target;
            setDuration(player.getDuration());
            setIsLoading(false);
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              if (settings.repeatMode === 'one') {
                event.target.seekTo(0);
                event.target.playVideo();
              } else {
                onEnded?.();
              }
            }
          },
        },
      });

      // Update time for YouTube player
      interval = setInterval(() => {
        if (youtubePlayerRef.current && isPlaying) {
          try {
            const time = youtubePlayerRef.current.getCurrentTime();
            setCurrentTime(time);
            onTimeUpdate?.(time);
          } catch (e) {
            // Player might not be ready
          }
        }
      }, 100);
    };

    // Load YouTube IFrame API script if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      const originalCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (originalCallback) originalCallback();
        initPlayer();
      };
    } else {
      // API already loaded, create player immediately
      setTimeout(initPlayer, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.destroy();
        } catch (e) {
          // Ignore destroy errors
        }
        youtubePlayerRef.current = null;
      }
    };
  }, [isYouTube, youtubeId, isPlaying, settings.repeatMode, onTimeUpdate, onEnded]);

  useEffect(() => {
    if (isYouTube) return; // Skip audio setup for YouTube URLs

    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = settings.playbackSpeed;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };
    const updateDuration = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      if (settings.repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
        setIsPlaying(true);
      } else {
        onEnded?.();
      }
    };
    const handleCanPlay = () => setIsLoading(false);
    const handleWaiting = () => setIsLoading(true);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
    };
  }, [settings.repeatMode, settings.playbackSpeed, onTimeUpdate, onEnded, isYouTube]);

  useEffect(() => {
    if (isYouTube && youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.setPlaybackRate(settings.playbackSpeed);
      } catch (e) {
        // Player might not be ready
      }
    } else if (audioRef.current) {
      audioRef.current.playbackRate = settings.playbackSpeed;
    }
  }, [settings.playbackSpeed, isYouTube]);

  useEffect(() => {
    if (sleepTimer && isPlaying) {
      sleepTimerRef.current = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
          setSleepTimer(null);
        }
      }, sleepTimer * 60 * 1000);
    }

    return () => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
      }
    };
  }, [sleepTimer, isPlaying]);

  const togglePlay = () => {
    if (isYouTube && youtubePlayerRef.current) {
      if (isPlaying) {
        youtubePlayerRef.current.pauseVideo();
      } else {
        youtubePlayerRef.current.playVideo();
      }
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (isYouTube && youtubePlayerRef.current) {
      if (isMuted) {
        youtubePlayerRef.current.unMute();
      } else {
        youtubePlayerRef.current.mute();
      }
      setIsMuted(!isMuted);
    } else if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSeek = (value: number[]) => {
    if (isYouTube && youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(value[0], true);
      setCurrentTime(value[0]);
    } else if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (isYouTube && youtubePlayerRef.current) {
      youtubePlayerRef.current.setVolume(value[0] * 100);
      setVolume(value[0]);
      if (value[0] > 0 && isMuted) {
        setIsMuted(false);
        youtubePlayerRef.current.unMute();
      }
    } else if (audioRef.current) {
      audioRef.current.volume = value[0];
      setVolume(value[0]);
      if (value[0] > 0 && isMuted) {
        setIsMuted(false);
        audioRef.current.muted = false;
      }
    }
  };

  const skip = (seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    if (isYouTube && youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(newTime, true);
      setCurrentTime(newTime);
    } else if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const toggleRepeat = () => {
    const modes: Array<'none' | 'one' | 'all'> = ['none', 'one', 'all'];
    const currentIndex = modes.indexOf(settings.repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    updateSetting('repeatMode', nextMode);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-gradient-to-br from-primary/5 via-card to-accent/5 rounded-2xl p-5 shadow-card border border-border/50">
      {!isYouTube && <audio ref={audioRef} src={src} preload="metadata" />}
      {isYouTube && youtubeId && (
        <div className="hidden">
          <div id={`youtube-player-${youtubeId}`} />
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Music className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">{title || 'Audio'}</p>
            <p className="text-xs text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </div>
        </div>

        {/* Speed & Timer Controls */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                {settings.playbackSpeed}x
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
              <div className="space-y-2">
                <p className="text-sm font-medium">Playback Speed</p>
                <div className="grid grid-cols-4 gap-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                    <Button
                      key={speed}
                      variant={settings.playbackSpeed === speed ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => updateSetting('playbackSpeed', speed)}
                    >
                      {speed}x
                    </Button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={`h-8 w-8 ${sleepTimer ? 'text-primary' : ''}`}
              >
                <Timer className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
              <div className="space-y-2">
                <p className="text-sm font-medium">Sleep Timer</p>
                <div className="grid grid-cols-3 gap-1">
                  {[5, 10, 15, 30, 45, 60].map((mins) => (
                    <Button
                      key={mins}
                      variant={sleepTimer === mins ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setSleepTimer(sleepTimer === mins ? null : mins)}
                    >
                      {mins}m
                    </Button>
                  ))}
                </div>
                {sleepTimer && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-xs"
                    onClick={() => setSleepTimer(null)}
                  >
                    Cancel Timer
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="absolute inset-0 cursor-pointer [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:opacity-0 hover:[&_[role=slider]]:opacity-100"
          />
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleRepeat}
            className={`h-9 w-9 ${settings.repeatMode !== 'none' ? 'text-primary' : 'text-muted-foreground'}`}
          >
            {settings.repeatMode === 'one' ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => skip(-10)}
            className="h-10 w-10"
          >
            <SkipBack className="w-5 h-5" />
          </Button>
          
          <Button
            onClick={togglePlay}
            size="icon"
            disabled={isLoading}
            className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-6 h-6 text-primary-foreground" />
            ) : (
              <Play className="w-6 h-6 text-primary-foreground ml-1" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => skip(10)}
            className="h-10 w-10"
          >
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Volume */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="h-9 w-9"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.05}
            onValueChange={handleVolumeChange}
            className="w-20 hidden sm:flex"
          />
        </div>
      </div>
    </div>
  );
}
