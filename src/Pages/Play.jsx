import React, { useEffect, useState, useContext, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import ReactStars from 'react-rating-stars-component';
import axios from "../axios";
import { API_KEY, imageUrl, imageUrl2, DJANGO_API_URL } from "../Constants/Constance";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../Firebase/FirebaseConfig";
import { AuthContext } from "../Context/UserContext";
import Hls from "hls.js";

import Navbar from "../componets/Header/Navbar";
import Footer from "../componets/Footer/Footer";
import useUpdateMylist from "../CustomHooks/useUpdateMylist";
import useUpdateLikedMovies from "../CustomHooks/useUpdateLikedMovies";
import useNetworkStatus from "../CustomHooks/useNetworkStatus";
import DownloadProgress from "../componets/Download/DownloadProgress";
import { checkIfDownloaded } from "../Services/downloadService";
import { schedulePeriodicCleanup } from "../Services/storageCleanup";

import "swiper/css";
import usePlayMovie from "../CustomHooks/usePlayMovie";
import useUpdateWatchedMovies from "../CustomHooks/useUpdateWatchedMovies";

function Play() {
  const [isPlaying, setIsPlayingLocal] = useState(true);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState(false);
  const [movieDetails, setMovieDetails] = useState({});
  const [isFromMyList, setIsFromMyList] = useState(false);
  const [isFromLikedMovies, setIsFromLikedMovies] = useState(false);
  const [isFromWatchedMovies, setIsFromWatchedMovies] = useState(false);
  const [similarMovies, setSimilarMovies] = useState([]);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [savedProgress, setSavedProgress] = useState(0);
  const [qualityLevels, setQualityLevels] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentBitrate, setCurrentBitrate] = useState(0);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [showDownloadProgress, setShowDownloadProgress] = useState(false);
  const [downloadData, setDownloadData] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  const { addToMyList, removeFromMyList, PopupMessage } = useUpdateMylist();
  const { addToLikedMovies, removeFromLikedMovies } = useUpdateLikedMovies();
  const { addToWatchedMovies, updateWatchProgress, removeFromWatchedMovies } = useUpdateWatchedMovies();
  const { playMovie } = usePlayMovie();
  const { isOnline, networkSpeed } = useNetworkStatus();

  // Auto quality selection based on network speed
  const getOptimalQualityIndex = (levels, speed) => {
    if (!levels || levels.length === 0) return -1;
    
    // Sort levels by height (resolution) in ascending order
    const sortedLevels = [...levels].sort((a, b) => a.height - b.height);
    
    switch (speed) {
      case '4g':
        // For 4G, select the highest quality available
        return sortedLevels.length - 1;
      case '3g':
        // For 3G, select medium quality (around 720p if available)
        const mediumIndex = sortedLevels.findIndex(level => level.height >= 720);
        return mediumIndex >= 0 ? mediumIndex : Math.max(0, sortedLevels.length - 2);
      case '2g':
        // For 2G, select lowest quality (480p or lower)
        const lowIndex = sortedLevels.findIndex(level => level.height <= 480);
        return lowIndex >= 0 ? lowIndex : 0;
      case 'slow-2g':
        // For very slow connections, select the lowest quality
        return 0;
      default:
        // Default to highest quality if speed is unknown
        return sortedLevels.length - 1;
    }
  };

  const autoSelectQuality = () => {
    if (qualityLevels.length > 0 && hlsRef.current) {
      const optimalIndex = getOptimalQualityIndex(qualityLevels, networkSpeed);
      if (optimalIndex >= 0 && optimalIndex < qualityLevels.length) {
        hlsRef.current.currentLevel = optimalIndex;
        setCurrentQuality(optimalIndex);
        console.log(`Auto-selected quality: ${qualityLevels[optimalIndex].label} for network speed: ${networkSpeed}`);
      }
    }
  };

  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { User, setIsPlaying } = useContext(AuthContext);

  useEffect(() => {
    setIsPlaying(true);
    return () => setIsPlaying(false);
  }, [setIsPlaying]);

  useEffect(() => {
    window.scrollTo(0, 0);
    schedulePeriodicCleanup();
    checkIfDownloaded(id).then(setIsDownloaded);
    
    // Fetch video and handle CloudFront Signed Cookies
    console.log("Attempting to fetch video for movie ID:", id);
    axios.get(`${DJANGO_API_URL}/movies/${id}/video/`, { withCredentials: true })
      .then((response) => {
        console.log("Video API response:", response);
        const { video_url } = response.data || {};
        console.log("Fetched video URL:", video_url);
        
        if (!video_url) {
          console.error("No video URL received from API");
          setVideoError(true); 
          return; 
        }

        // Backend should set CloudFront-Policy, CloudFront-Signature, CloudFront-Key-Pair-Id as cookies
        // Use clean URL without query parameters
        setVideoUrl(video_url);
        setVideoError(false);
        console.log("Successfully set video URL, initializing player...");

        if (videoRef.current) {
          if (Hls.isSupported()) {
            console.log("HLS is supported, initializing Hls.js");
            const hls = new Hls({
              xhrSetup: function(xhr, url) {
                // Enable credentials to send CloudFront signed cookies
                xhr.withCredentials = true;
                console.log("XHR setup with credentials for URL:", url);
              }
            });

            hlsRef.current = hls;
            hls.loadSource(video_url);
            hls.attachMedia(videoRef.current);
            
            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
              const levels = data.levels.map((l, i) => ({ index: i, height: l.height, label: `${l.height}p`, bitrate: l.bitrate }));
              setQualityLevels(levels);
              console.log("HLS Manifest Parsed - Available qualities:", levels);
              // Auto-select quality based on network speed
              autoSelectQuality();
            });

            // Add more detailed logging for video events
            hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
              console.log("Fragment loaded:", {
                level: data.frag.level,
                duration: data.frag.duration,
                bitrate: data.frag.bitrate,
                networkSpeed: networkSpeed
              });
            });

            hls.on(Hls.Events.FRAG_CHANGED, (event, data) => {
              console.log("Fragment changed:", {
                level: data.frag.level,
                duration: data.frag.duration,
                currentTime: videoRef.current?.currentTime
              });
            });
            //

            hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
              setCurrentQuality(data.level);
              setCurrentBitrate(hls.levels[data.level]?.bitrate || 0);
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) hls.startLoad(); // Retry on error
            });
          } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            videoRef.current.src = video_url;
          }
        }
      })
      .catch(() => setVideoError(true));

    // Fetch Metadata
    axios.get(`/movie/${id}?api_key=${API_KEY}&language=en-US`)
      .then((res) => {
        setMovieDetails(res.data);
        axios.get(`movie/${id}/recommendations?api_key=${API_KEY}&language=en-US&page=1`)
          .then((s) => setSimilarMovies(s.data.results.slice(0, 8)));
      });

    // Check for saved progress and auto-resume
    checkSavedProgress();

    return () => { 
      if (hlsRef.current) hlsRef.current.destroy(); 
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [id]);

  // Auto-resume functionality
  const checkSavedProgress = async () => {
    if (!User) {
      console.log("No user logged in, skipping resume check");
      return;
    }
    
    try {
      console.log("Checking saved progress for user:", User.uid, "movie:", id);
      const watchedDoc = await getDoc(doc(db, "WatchedMovies", User.uid));
      console.log("Watched doc exists:", watchedDoc.exists());
      
      if (watchedDoc.exists()) {
        const watchedData = watchedDoc.data();
        console.log("Watched data:", watchedData);
        const movieProgress = watchedData.movies?.find(m => m.id === id);
        console.log("Movie progress found:", movieProgress);
        
        if (movieProgress && movieProgress.progress > 30 && !movieProgress.completed) {
          console.log("Setting saved progress to:", movieProgress.progress);
          setSavedProgress(movieProgress.progress);
          setShowContinuePrompt(true);
        } else {
          console.log("No valid progress to resume from");
        }
      } else {
        console.log("No watched movies document found for user");
      }
    } catch (error) {
      console.error("Error checking saved progress:", error);
    }
  };

  const resumeFromSavedProgress = () => {
    if (videoRef.current && savedProgress > 0) {
      console.log("Resuming video from saved progress:", savedProgress);
      videoRef.current.currentTime = savedProgress;
      setShowContinuePrompt(false);
      
      // Ensure video starts playing from the correct position
      videoRef.current.play().catch(error => {
        console.error("Error resuming video playback:", error);
      });
    }
  };

  const startFromBeginning = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setShowContinuePrompt(false);
    }
  };

  // Video Controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
    setIsPlayingLocal(!videoRef.current.paused);
  };

  const handleSeek = (e) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * videoRef.current.duration;
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  // Apply volume to video ref when volume state changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const selectQuality = (levelIndex) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentQuality(levelIndex);
      setShowQualityMenu(false);
    }
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const minutes = Math.floor(s / 60);
    const seconds = Math.floor(s % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (!videoRef.current || videoRef.current.paused) return;
      setShowControls(false);
    }, 3000);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!videoRef.current) return;
      
      switch(e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          videoRef.current.currentTime += 10;
          break;
        case 'ArrowLeft':
          videoRef.current.currentTime -= 10;
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.1));
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
        case 'KeyM':
          setVolume(volume === 0 ? 1 : 0);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, volume]);

  const handleVideoEnded = () => {
    setIsPlayingLocal(false);
    console.log("Video playback ended. Duration:", duration, "Current time:", currentTime);
    // Mark as completed in watched movies
    if (User && movieDetails) {
      addToWatchedMovies(movieDetails, duration, duration);
    }
  };

  // Add comprehensive video metrics logging
  useEffect(() => {
    const logVideoMetrics = () => {
      if (videoRef.current && duration > 0) {
        const metrics = {
          currentTime: currentTime,
          duration: duration,
          progress: duration > 0 ? (currentTime / duration) * 100 : 0,
          isPlaying: !videoRef.current.paused,
          volume: videoRef.current.volume,
          networkSpeed: networkSpeed,
          currentQuality: currentQuality >= 0 ? qualityLevels[currentQuality]?.label : 'Unknown',
          currentBitrate: currentBitrate,
          buffered: videoRef.current.buffered.length > 0 ? videoRef.current.buffered.end(0) : 0
        };
        
        console.log("Video Metrics:", metrics);
      }
    };

    // Log metrics every 10 seconds
    const metricsInterval = setInterval(logVideoMetrics, 10000);
    
    // Log initial metrics when video loads
    const handleLoadedMetadata = () => {
      console.log("Video metadata loaded:", {
        duration: duration,
        networkSpeed: networkSpeed,
        isOnline: isOnline
      });
    };

    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
    }

    return () => {
      clearInterval(metricsInterval);
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
    };
  }, [currentTime, duration, networkSpeed, isOnline, currentQuality, currentBitrate, qualityLevels]);

  // Save progress periodically while watching
  useEffect(() => {
    if (!User || !movieDetails || duration === 0) return;

    const saveProgressInterval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        updateWatchProgress(movieDetails.id, videoRef.current.currentTime, duration);
      }
    }, 5000); // Save every 5 seconds

    return () => clearInterval(saveProgressInterval);
  }, [User, movieDetails, duration, updateWatchProgress]);

  // Save progress when component unmounts or video ends
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (User && movieDetails && videoRef.current) {
        updateWatchProgress(movieDetails.id, videoRef.current.currentTime, duration);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [User, movieDetails, duration, updateWatchProgress]);

  // Auto-adjust quality when network speed changes
  useEffect(() => {
    if (networkSpeed && qualityLevels.length > 0) {
      autoSelectQuality();
    }
  }, [networkSpeed, qualityLevels]);

  return (
    <div className="min-h-screen bg-black text-white">
      {PopupMessage}
      
      <div className="pt-20 flex flex-col items-center">
        {videoError ? (
          <div className="h-[60vh] flex flex-col items-center justify-center">
             <h2 className="text-2xl font-bold text-red-600">Access Denied / Video Unavailable</h2>
             <p className="text-gray-400">CloudFront signature missing or expired.</p>
             <button onClick={() => navigate(-1)} className="mt-4 bg-white text-black px-4 py-2 rounded">Go Back</button>
          </div>
        ) : (
          <div 
            ref={containerRef} 
            className="relative w-full max-w-7xl aspect-video bg-black group cursor-pointer overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => !videoRef.current?.paused && setShowControls(false)}
          >
            <video 
              ref={videoRef} 
              autoPlay 
              className="w-full h-full object-contain"
              onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.target.duration)}
              onEnded={handleVideoEnded}
              onClick={togglePlay}
            />
            
            {/* Center Play/Pause Icon */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center z-30">
                <button 
                  onClick={togglePlay}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm p-6 rounded-full transition-all duration-200 transform hover:scale-110"
                >
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                </button>
              </div>
            )}
            
            {/* Continue Watching Prompt - Enhanced */}
            {showContinuePrompt && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 flex-col gap-6">
                <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-700 p-8 rounded-2xl text-center max-w-sm mx-4 shadow-2xl">
                  <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-white">Continue Watching?</h3>
                  <p className="text-gray-300 mb-1">
                    You left off at <span className="text-[#5b7ea4] font-bold">{formatTime(savedProgress)}</span>
                  </p>
                  <p className="text-gray-400 text-sm mb-6">
                    {movieDetails.title || 'This video'}
                  </p>
                  <div className="w-full bg-gray-700 h-1 rounded-full mb-6 overflow-hidden">
                    <div 
                      className="h-full bg-[#5b7ea4] transition-all"
                      style={{ width: `${(savedProgress / duration) * 100}%` }}
                    />
                  </div>
                  <div className="flex gap-3 flex-col sm:flex-row justify-center">
                    <button 
                      onClick={resumeFromSavedProgress}
                      className="bg-[#5b7ea4] hover:bg-[#4a6a8f] text-white px-8 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2 order-2 sm:order-1"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="5,3 19,12 5,21"/>
                      </svg>
                      Resume
                    </button>
                    <button 
                      onClick={startFromBeginning}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 order-1 sm:order-2"
                    >
                      Start Over
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Top Controls - Header Bar */}
            <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 sm:p-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex justify-between items-start max-w-7xl mx-auto">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      if (hlsRef.current) hlsRef.current.destroy();
                      navigate('/');
                    }}
                    className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10 transform hover:scale-110 duration-200"
                    title="Back (ESC)"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <h2 className="text-base sm:text-lg font-bold text-white hidden sm:block line-clamp-1">
                    {movieDetails.title || 'Now Playing'}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-white/70 bg-black/40 px-2 py-1 rounded">
                    {isOnline ? '🟢 Online' : '🔴 Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Controls - Enhanced */}
            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 sm:p-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              <div className="max-w-7xl mx-auto">
                {/* Progress Bar - Enhanced with buffering */}
                <div 
                  className="w-full h-2 sm:h-1 bg-gray-600/50 cursor-pointer mb-4 rounded relative group touch-manipulation hover:h-1.5 transition-all"
                  onClick={handleSeek}
                  onMouseMove={handleMouseMove}
                >
                  {/* Buffering indicator */}
                  <div className="h-full bg-gray-500/70 rounded" style={{ width: '100%', opacity: 0.3 }} />
                  
                  {/* Current progress */}
                  <div 
                    className="h-full bg-[#5b7ea4] rounded transition-all"
                    style={{ width: `${duration > 0 ? (currentTime/duration)*100 : 0}%` }} 
                  />
                  
                  {/* Hover scrubber dot */}
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#5b7ea4] rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2"
                    style={{ left: `${duration > 0 ? (currentTime/duration)*100 : 0}%` }}
                  />
                  
                  {/* Time tooltip on hover */}
                  <div className="absolute -top-10 left-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap border border-gray-600">
                      {formatTime(currentTime === 0 ? 0 : currentTime)}
                    </div>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex justify-between items-center gap-2 sm:gap-4">
                  {/* Left Controls */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Play/Pause */}
                    <button 
                      onClick={togglePlay}
                      className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2.5 sm:p-3 rounded-full transform hover:scale-110 duration-200"
                      title="Play/Pause (Space)"
                    >
                      {isPlaying ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                          <rect x="6" y="4" width="4" height="16" rx="1"/>
                          <rect x="14" y="4" width="4" height="16" rx="1"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                          <polygon points="5,3 19,12 5,21"/>
                        </svg>
                      )}
                    </button>
                    
                    {/* Skip Backwards */}
                    <button 
                      onClick={() => videoRef.current && (videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10))}
                      className="text-white/70 hover:text-white transition-colors hover:bg-white/10 p-2 sm:p-2.5 rounded-full transform hover:scale-110 duration-200"
                      title="Rewind 10s (←)"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9.28 6.52A9 9 0 112.12 15M9.28 6.52l3 3M9.28 6.52l-3 3M9 12l3-3-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {/* Skip Forward */}
                    <button 
                      onClick={() => videoRef.current && (videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10))}
                      className="text-white/70 hover:text-white transition-colors hover:bg-white/10 p-2 sm:p-2.5 rounded-full transform hover:scale-110 duration-200"
                      title="Forward 10s (→)"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14.72 6.52A9 9 0 1121.88 15M14.72 6.52l-3 3m3-3l3 3m-3 6l-3-3 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    
                    {/* Time Display */}
                    <div className="text-xs sm:text-sm text-white/90 font-mono bg-black/40 px-2.5 sm:px-3 py-1.5 rounded whitespace-nowrap ml-1 sm:ml-2">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                  </div>

                  {/* Right Controls */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Volume Control */}
                    <div className="flex items-center gap-1 sm:gap-2 bg-black/30 px-2 sm:px-3 py-1.5 rounded-full group">
                      <button 
                        onClick={() => setVolume(volume === 0 ? 1 : 0)}
                        className="text-white/80 hover:text-white transition-colors p-1 transform hover:scale-110 duration-200"
                        title="Mute (M)"
                      >
                        {volume === 0 ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M23 9L17 15M17 9L23 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M15.54 8.46C16.4774 9.39764 17.004 10.6692 17.004 11.995C17.004 13.3208 16.4774 14.5924 15.54 15.53" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-12 sm:w-20 accent-[#5b7ea4] touch-manipulation opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>

                    {/* Quality Selector */}
                    <div className="relative group">
                      <button 
                        onClick={() => setShowQualityMenu(!showQualityMenu)}
                        className="text-xs sm:text-sm text-white/80 hover:text-white transition-colors bg-black/40 hover:bg-black/60 px-2.5 sm:px-3 py-1.5 rounded font-medium flex items-center gap-1 transform hover:scale-105 duration-200"
                        title="Change quality"
                      >
                        <span>{currentQuality >= 0 ? qualityLevels[currentQuality]?.label : 'Auto'}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      {showQualityMenu && qualityLevels.length > 0 && (
                        <div className="absolute bottom-full right-0 bg-gray-900 border border-gray-700 rounded-lg mt-2 mb-2 z-50 min-w-[140px] shadow-xl">
                          {qualityLevels.map((level, index) => (
                            <button
                              key={index}
                              onClick={() => selectQuality(index)}
                              className={`block w-full text-left px-4 py-2.5 hover:bg-[#5b7ea4] hover:bg-opacity-30 text-white text-sm font-medium transition-all first:rounded-t-lg last:rounded-b-lg ${
                                currentQuality === index ? 'bg-[#5b7ea4] text-white' : ''
                              }`}
                            >
                              {level.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Fullscreen */}
                    <button 
                      onClick={toggleFullscreen}
                      className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2.5 sm:p-3 rounded-full transform hover:scale-110 duration-200"
                      title="Fullscreen (F)"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 3v5M16 3v5M3 8h5M21 8h-5M8 21v-5M16 21v-5M3 16h5M21 16h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Keyboard Hints - Mobile hidden */}
                <div className="hidden sm:flex text-xs text-gray-400 mt-3 gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>
                    <kbd className="bg-gray-800 px-2 py-1 rounded">Space</kbd> Play/Pause
                  </span>
                  <span>
                    <kbd className="bg-gray-800 px-2 py-1 rounded">←/→</kbd> ±10s
                  </span>
                  <span>
                    <kbd className="bg-gray-800 px-2 py-1 rounded">F</kbd> Fullscreen
                  </span>
                  <span>
                    <kbd className="bg-gray-800 px-2 py-1 rounded">M</kbd> Mute
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {movieDetails.title && (
          <div className="w-full max-w-7xl mx-auto p-4 sm:p-8 text-white">
            <div className="mb-8">
              <h1 className="text-3xl sm:text-5xl font-bold mb-3 line-clamp-2">{movieDetails.title}</h1>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4">
                {movieDetails.release_date && (
                  <span className="text-sm sm:text-base text-gray-400">{movieDetails.release_date.split('-')[0]}</span>
                )}
                {movieDetails.vote_average && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#5b7ea4] font-bold">{movieDetails.vote_average.toFixed(1)}</span>
                    <ReactStars
                      count={5}
                      value={movieDetails.vote_average / 2}
                      size={18}
                      activeColor="#5b7ea4"
                      color="#374151"
                      edit={false}
                    />
                  </div>
                )}
                <span className="text-xs sm:text-sm bg-gray-700 px-2 py-1 rounded">HD</span>
              </div>
              <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-3xl">
                {movieDetails.overview}
              </p>
            </div>

            {/* Similar Content */}
            {similarMovies.length > 0 && (
              <div className="mt-12">
                <h3 className="text-xl sm:text-2xl font-bold border-l-4 border-[#5b7ea4] pl-4 mb-6">Similar Content</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                    {similarMovies.map(m => (
                        <div 
                          key={m.id} 
                          onClick={() => navigate(`/play/${m.id}`)}
                          className="group cursor-pointer relative overflow-hidden rounded-lg transition-all duration-300 hover:scale-110 hover:shadow-2xl"
                        >
                            <img 
                              src={imageUrl2 + m.backdrop_path} 
                              className="w-full h-28 sm:h-32 object-cover rounded-lg transition-all" 
                              alt={m.title || m.name}
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all rounded-lg flex items-end p-2 sm:p-3">
                              <p className="text-xs sm:text-sm font-semibold text-white opacity-0 group-hover:opacity-100 line-clamp-2">
                                {m.title || m.name}
                              </p>
                            </div>
                            {/* Play icon overlay */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="bg-[#5b7ea4] p-3 rounded-full shadow-lg">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                  <polygon points="5,3 19,12 5,21"/>
                                </svg>
                              </div>
                            </div>
                        </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default Play;