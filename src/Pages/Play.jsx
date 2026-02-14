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
  const { removeFromWatchedMovies } = useUpdateWatchedMovies();
  const { playMovie } = usePlayMovie();
  const { isOnline } = useNetworkStatus();

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
    axios.get(`${DJANGO_API_URL}/movies/${id}/video/`, { withCredentials: true })
      .then((response) => {
        const { video_url } = response.data || {};
        console.log("Fetched video URL:", video_url);
        if (!video_url) { setVideoError(true); return; }

        // Backend should set CloudFront-Policy, CloudFront-Signature, CloudFront-Key-Pair-Id as cookies
        // Use clean URL without query parameters
        setVideoUrl(video_url);
        setVideoError(false);

        if (videoRef.current) {
          if (Hls.isSupported()) {
            const hls = new Hls({
              xhrSetup: function(xhr, url) {
                // Enable credentials to send CloudFront signed cookies
                xhr.withCredentials = true;
              }
            });

            hlsRef.current = hls;
            hls.loadSource(video_url);
            hls.attachMedia(videoRef.current);
            
            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
              const levels = data.levels.map((l, i) => ({ index: i, height: l.height, label: `${l.height}p`, bitrate: l.bitrate }));
              setQualityLevels(levels);
              // Set default quality to highest available
              setCurrentQuality(levels.length - 1);
              hls.currentLevel = levels.length - 1;
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
    if (!User) return;
    
    try {
      const watchedDoc = await getDoc(doc(db, "WatchedMovies", User.uid));
      if (watchedDoc.exists()) {
        const watchedData = watchedDoc.data();
        const movieProgress = watchedData.movies?.find(m => m.id === id);
        
        if (movieProgress && movieProgress.progress > 30 && !movieProgress.completed) {
          setSavedProgress(movieProgress.progress);
          setShowContinuePrompt(true);
        }
      }
    } catch (error) {
      console.error("Error checking saved progress:", error);
    }
  };

  const resumeFromSavedProgress = () => {
    if (videoRef.current && savedProgress > 0) {
      videoRef.current.currentTime = savedProgress;
      setShowContinuePrompt(false);
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

  const handleVideoEnded = () => {
    setIsPlayingLocal(false);
    // Mark as completed in watched movies
    if (User) {
      // This would trigger the useUpdateWatchedMovies hook
    }
  };

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
            className="relative w-full max-w-5xl aspect-video bg-black group cursor-pointer"
            onMouseMove={handleMouseMove}
          >
            <video 
              ref={videoRef} 
              autoPlay 
              className="w-full h-full"
              onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.target.duration)}
              onEnded={handleVideoEnded}
              onClick={togglePlay}
            />
            
            {/* Continue Watching Prompt */}
            {showContinuePrompt && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white text-black p-6 rounded-lg text-center">
                  <h3 className="text-xl font-bold mb-2">Continue Watching?</h3>
                  <p className="text-gray-600 mb-4">
                    Resume from {formatTime(savedProgress)}
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button 
                      onClick={resumeFromSavedProgress}
                      className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
                    >
                      Resume
                    </button>
                    <button 
                      onClick={startFromBeginning}
                      className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
                    >
                      Start Over
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile-friendly Top Controls */}
            <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-3 sm:p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 sm:gap-4 flex-1">
                  {/* Close/Back Button - Larger for mobile */}
                  <button 
                    onClick={() => {
                      navigate('/');
                      window.location.reload();
                    }}
                    className="text-white hover:text-gray-300 transition-colors p-2 sm:p-3 rounded-full hover:bg-black/50 touch-manipulation"
                    title="Go Home"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 9.5L12 3L21 9.5V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H14C13.4696 22 12.9609 21.7893 12.5858 21.4142C12.2107 21.0391 12 20.5304 12 20V15H8C7.46957 15 6.96086 15.2107 6.58579 15.5858C6.21071 15.9609 6 16.4696 6 17V20C6 20.5304 5.78929 21.0391 5.41421 21.4142C5.03914 21.7893 4.53043 22 4 22H3C2.73478 22 2.48043 21.8946 2.29289 21.7071C2.10536 21.5196 2 21.2652 2 21V10C2 9.73478 2.10536 9.48043 2.29289 9.29289C2.48043 9.10536 2.73478 9 3 9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  
                  {/* Movie Title - Responsive font size */}
                  <h3 className="text-white text-base sm:text-lg font-semibold truncate max-w-[60vw] sm:max-w-md">
                    {movieDetails.title || 'Loading...'}
                  </h3>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* YouTube-style Info - Mobile optimized */}
                  <span className="text-xs sm:text-sm text-gray-300 bg-black/30 px-2 py-1 rounded">
                    {currentQuality >= 0 ? qualityLevels[currentQuality]?.label : 'HD'} • {formatTime(duration)}
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile-friendly Bottom Controls */}
            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 sm:p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              {/* Progress Bar - Mobile optimized */}
              <div className="w-full h-1 sm:h-1.5 bg-gray-600 cursor-pointer mb-3 sm:mb-4 relative group touch-manipulation" onClick={handleSeek}>
                <div className="h-full bg-[#5b7ea4]" style={{ width: `${duration > 0 ? (currentTime/duration)*100 : 0}%` }} />
                {/* Touch-friendly hover tooltip */}
                <div className="absolute -top-8 left-0 w-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-black text-white text-xs px-2 py-1 rounded absolute" style={{ left: `${duration > 0 ? (currentTime/duration)*100 : 0}%`, transform: 'translateX(-50%)' }}>
                    {formatTime(currentTime)}
                  </div>
                </div>
              </div>
              
              {/* Control Buttons - Mobile optimized */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 sm:gap-4">
                  {/* Play/Pause - Larger touch targets */}
                  <button onClick={togglePlay} className="text-3xl sm:text-2xl hover:text-[#5b7ea4] transition-colors bg-white/10 hover:bg-white/20 p-2 sm:p-3 rounded-full touch-manipulation">
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
                  
                  {/* Time Display - Mobile responsive */}
                  <div className="text-xs sm:text-sm text-white font-medium">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                  {/* Volume Control - Mobile optimized */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    <button 
                      onClick={() => setVolume(volume === 0 ? 1 : 0)}
                      className="text-white hover:text-gray-300 transition-colors p-1 sm:p-2 touch-manipulation"
                    >
                      {volume === 0 ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M23 9L17 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M17 9L23 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-16 sm:w-24 accent-[#5b7ea4] touch-manipulation"
                    />
                  </div>

                  {/* Quality Selector - Mobile optimized */}
                  <div className="relative">
                    <button 
                      onClick={() => setShowQualityMenu(!showQualityMenu)}
                      className="text-xs sm:text-sm text-white hover:text-gray-300 transition-colors bg-white/10 hover:bg-white/20 px-2 sm:px-3 py-1 rounded touch-manipulation"
                    >
                      {currentQuality >= 0 ? qualityLevels[currentQuality]?.label : 'HD'} ▼
                    </button>
                    {showQualityMenu && (
                      <div className="absolute top-full right-0 bg-black border border-gray-600 rounded mt-1 z-50 min-w-[120px]">
                        {qualityLevels.map((level, index) => (
                          <button
                            key={index}
                            onClick={() => selectQuality(index)}
                            className={`block w-full text-left px-3 py-2 hover:bg-gray-700 text-white text-sm ${
                              currentQuality === index ? 'bg-gray-800 text-[#5b7ea4]' : ''
                            }`}
                          >
                            {level.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Fullscreen - Mobile optimized */}
                  <button onClick={toggleFullscreen} className="text-white hover:text-gray-300 transition-colors p-1 sm:p-2 touch-manipulation">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 3V5M16 3V5M3 8H5M3 16H5M21 8H19M21 16H19M8 19V21M16 19V21M5 12H3M21 12H19M12 5V3M12 21V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {movieDetails.title && (
          <div className="w-full max-w-5xl p-6">
            <h1 className="text-4xl font-bold">{movieDetails.title}</h1>
            <p className="text-gray-400 mt-4 max-w-2xl">{movieDetails.overview}</p>
            
            <div className="mt-8">
                <h3 className="text-xl font-bold border-l-4 border-blue-500 pl-2 mb-4">Similar Content</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {similarMovies.map(m => (
                        <div key={m.id} className="cursor-pointer hover:scale-105 transition" onClick={() => navigate(`/play/${m.id}`)}>
                            <img src={imageUrl2 + m.backdrop_path} className="rounded" alt={m.title} />
                            <p className="text-sm mt-2">{m.title}</p>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default Play;