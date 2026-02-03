import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import StarRatings from "react-star-ratings";
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
import DownloadButton from "../componets/Download/DownloadButton";
import DownloadProgress from "../componets/Download/DownloadProgress";
import { checkIfDownloaded, getDownloadedMovie } from "../Services/downloadService";
import { schedulePeriodicCleanup } from "../Services/storageCleanup";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import usePlayMovie from "../CustomHooks/usePlayMovie";
import useUpdateWatchedMovies from "../CustomHooks/useUpdateWatchedMovies";


function Play() {
  const [isPlaying, setIsPlayingLocal] = useState(true);
  const [urlId, setUrlId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState(false);
  const [movieDetails, setMovieDetails] = useState({});
  const [isFromMyList, setIsFromMyList] = useState(false);
  const [isFromLikedMovies, setIsFromLikedMovies] = useState(false);
  const [isFromWatchedMovies, setIsFromWatchedMovies] = useState(false);
  const [moreTrailerVideos, setMoreTrailerVideos] = useState([]);
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
  const [downloadStatus, setDownloadStatus] = useState('idle');
  const [downloadData, setDownloadData] = useState(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const videoRef = React.useRef(null);
  const hlsRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const controlsTimeoutRef = React.useRef(null);
  

  const { addToMyList, removeFromMyList, PopupMessage } = useUpdateMylist();
  const { addToLikedMovies, removeFromLikedMovies, LikedMoviePopupMessage } =
    useUpdateLikedMovies();
  const { removeFromWatchedMovies, updateWatchProgress, removePopupMessage } =
    useUpdateWatchedMovies();
  const { playMovie } = usePlayMovie();
  const { isOnline } = useNetworkStatus();

  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { User, setIsPlaying } = useContext(AuthContext);

  useEffect(() => {
    // Set navbar hidden when entering play page
    setIsPlaying(true);
    
    return () => {
      // Show navbar when leaving play page
      setIsPlaying(false);
    };
  }, [setIsPlaying]);

  useEffect(() => {
    // Scroll to top when page loads
    window.scrollTo(0, 0);
    
    // Initialize storage cleanup
    schedulePeriodicCleanup();

    // Check if video is downloaded
    checkIfDownloaded(id).then(setIsDownloaded);
    
    if (location.state?.From === "MyList") {
      setIsFromMyList(true);
    }
    if (location.state?.From === "LikedMovies") {
      setIsFromLikedMovies(true);
    }
    if (location.state?.From === "WatchedMovies") {
      setIsFromWatchedMovies(true);
    }

    // Check for saved progress from Firestore
const checkProgress = async () => {
  // 1. Guard against null user
  if (!User?.uid) return; 

  try {
    console.log("Checking progress for user:", User.uid);
    const docRef = doc(db, "WatchedMovies", User.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const movies = docSnap.data().movies || [];
      // 2. Use String comparison to avoid type errors
      const movie = movies.find(m => String(m.id) === String(id));
      
      console.log("Found movie in history:", movie);

      // 3. Ensure the progress is actually a number and significant
      if (movie && movie.progress > 10 && !movie.completed) {
        setSavedProgress(movie.progress);
        setShowContinuePrompt(true);
      }
    }
  } catch (error) {
    console.error("Error fetching progress:", error);
  }
};
    
    checkProgress();

    // Fetch video URL from Django backend
    axios
      .get(`${DJANGO_API_URL}/movies/${id}/video/`)
      .then((response) => {
        const { video_url, cookies } = response.data;
        
        // Set CloudFront cookies
        if (cookies) {
          Object.keys(cookies).forEach(key => {
            document.cookie = `${key}=${cookies[key]}; path=/; domain=.cloudfront.net`;
          });
        }
        
        setVideoUrl(video_url);
        setVideoError(false);
        
        // Try native video element first for HLS
        if (videoRef.current) {
          if (Hls.isSupported()) {
            // HLS.js for browsers
            const hls = new Hls({
              xhrSetup: function(xhr, url) {
                xhr.withCredentials = false;
              }
            });
            hlsRef.current = hls;
            
            hls.loadSource(video_url);
            hls.attachMedia(videoRef.current);
            
            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
              console.log('HLS Manifest Parsed:', data.levels);
              const levels = data.levels.map((level, index) => ({
                index,
                height: level.height,
                label: `${level.height}p`
              }));
              console.log('Quality Levels:', levels);
              setQualityLevels(levels);
              setCurrentQuality(-1);
            });
            
            hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
              console.log('Quality switched to:', data.level, hls.levels[data.level]);
              setCurrentBitrate(Math.round(hls.levels[data.level].bitrate / 1000));
            });
            
            hls.on(Hls.Events.ERROR, (event, data) => {
              console.error('HLS Error:', data);
              if (data.fatal) {
                setVideoError(true);
              }
            });
          } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari native HLS
            videoRef.current.src = video_url;
            setQualityLevels([
              { index: 0, height: 1080, label: '1080p' },
              { index: 1, height: 720, label: '720p' },
              { index: 2, height: 480, label: '480p' }
            ]);
          } else {
            setVideoError(true);
          }
        }
      })
      .catch((error) => {
        console.error("Error fetching video:", error);
        setVideoError(true);
      });
    axios
      .get(`/movie/${id}?api_key=${API_KEY}&language=en-US`)
      .then((responce) => {
        console.log(responce.data, "Movie deatils");
        setMovieDetails(responce.data);
        console.log(responce.data.genres[0]);

        axios
          .get(
            `movie/${id}/recommendations?api_key=${API_KEY}&language=en-US&page=1`
          )
          .then((res) => {
            console.log(
              res.data.results.slice(0, 8),
              "ksdjfk ahdsfjksadhfjsdahf"
            );
            setSimilarMovies(res.data.results.slice(0, 8));
          });
      });
    
    return () => {
      setIsPlaying(false);
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [User, id]);

  const handleQualityChange = (levelIndex) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentQuality(levelIndex);
      setShowQualityMenu(false);
    }
  };

  const handleDownload = async (quality) => {
    try {
      setIsDownloading(true);
      const { initializeDownload, downloadSegments } = await import('../Services/downloadService');
      
      const downloadData = await initializeDownload(parseInt(id), movieDetails, quality);
      
      setDownloadData(downloadData);
      setDownloadStatus('downloading');
      setShowDownloadMenu(false);
      setShowDownloadProgress(true);

      // Start segment download in background
      setTimeout(() => {
        downloadSegments(
          parseInt(id),
          downloadData.s3Url,
          downloadData.selectedLevel
        ).catch(console.error);
      }, 100);
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Download failed: ${error.message}`);
      setIsDownloading(false);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (videoRef.current) {
      videoRef.current.currentTime = pos * duration;
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  return (
    <div>
      {PopupMessage}

      {/* Network Status Indicator */}
      {!isOnline && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-40 bg-yellow-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            className="w-4 h-4"
          >
            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
          </svg>
          You're offline. Offline downloads are available to watch.
        </div>
      )}

      {/* Download Progress Modal */}
      {showDownloadProgress && downloadData && (
        <DownloadProgress
          movieId={parseInt(id)}
          movieTitle={movieDetails.original_title || movieDetails.title}
          onComplete={() => {
            setShowDownloadProgress(false);
            setIsDownloaded(true);
          }}
          onCancel={() => {
            setShowDownloadProgress(false);
            setIsDownloading(false);
          }}
        />
      )}

      {/* Continue Watching Prompt */}
      {showContinuePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-neutral-800 rounded-lg p-8 max-w-md">
            <h2 className="text-white text-2xl font-bold mb-4">Continue Watching?</h2>
            <p className="text-gray-400 mb-6">
              Resume from {Math.floor(savedProgress / 60)}:{String(Math.floor(savedProgress % 60)).padStart(2, '0')}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime = savedProgress;
                  setShowContinuePrompt(false);
                }}
                className="flex-1 bg-[#5b7ea4] text-white py-3 rounded-lg hover:bg-[#4a6a8f] font-bold"
              >
                Continue
              </button>
              <button
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime = 0;
                  setShowContinuePrompt(false);
                }}
                className="flex-1 bg-neutral-600 text-white py-3 rounded-lg hover:bg-neutral-700 font-bold"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-20 h-[40vh] sm:h-[50vh] md:h-[55vh] lg:h-[65vh] lg:mt-20 xl:h-[98vh] relative bg-black flex items-center justify-center sm:block">
        {videoError ? (
          <div className="flex flex-col items-center justify-center h-full bg-black">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-16 h-16 text-red-600 mb-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <h2 className="text-white text-2xl font-bold mb-2">Video Not Available</h2>
            <p className="text-gray-400 mb-4">This movie is not available at the moment.</p>
            <button
              onClick={() => navigate("/series")}
              className="bg-[#5b7ea4] text-white px-6 py-2 rounded hover:bg-[#4a6a8f]"
            >
              Back to Series
            </button>
          </div>
        ) : videoUrl ? (
          <>
            {/* Top gradient overlay */}
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none"></div>
            
            {/* Close button */}


            {/* Video player */}
{/* Updated Video Player Section */}
<div className="mt-16 sm:mt-20 w-full bg-black relative">
  <div 
    ref={containerRef}
    className="relative w-full max-w-6xl mx-auto aspect-video bg-black group overflow-hidden shadow-2xl"
    onMouseMove={handleMouseMove}
  >
    {/* Close Button - Sleeker, top-right */}
    <button
      onClick={() => navigate("/series")}
      className={`absolute top-4 right-4 z-50 p-2 rounded-full bg-black/40 text-white transition-opacity duration-300 hover:bg-black/70 ${showControls ? 'opacity-100' : 'opacity-0'}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <video
      ref={videoRef}
      className="w-full h-full object-contain cursor-pointer"
      autoPlay
      onClick={togglePlay}
      onPlay={() => setIsPlayingLocal(true)}
      onPause={() => setIsPlayingLocal(false)}
      onTimeUpdate={(e) => {
        setCurrentTime(e.target.currentTime);
        setDuration(e.target.duration);
      }}
    >
      Your browser does not support the video tag.
    </video>

    {/* Controls Overlay */}
    <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      
      {/* Center Play/Pause Button (Facebook Style) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <button onClick={togglePlay} className="p-4 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-transform transform hover:scale-110">
          {isPlaying ? (
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
          ) : (
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>
      </div>

      {/* Bottom Controls Area */}
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-6">
        
        {/* Progress Bar - Full Width at bottom */}
        <div className="relative w-full h-1.5 bg-gray-600 rounded-full mb-4 cursor-pointer group/progress" onClick={handleSeek}>
          <div 
            className="absolute top-0 left-0 h-full bg-[#5b7ea4] rounded-full flex items-center justify-end"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          >
            <div className="w-3 h-3 bg-white rounded-full scale-0 group-hover/progress:scale-100 transition-transform shadow-lg" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-5">
            {/* Minimal Time Display */}
            <div className="text-white text-[10px] sm:text-xs font-medium bg-black/20 px-2 py-1 rounded">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            {/* Volume Icon only on Mobile, Slider on Desktop */}
            <div className="flex items-center gap-2 group/vol">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
              <input 
                type="range" min="0" max="1" step="0.1" value={volume} 
                onChange={handleVolumeChange}
                className="hidden sm:block w-0 group-hover/vol:w-20 transition-all accent-[#5b7ea4]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Bitrate badge */}
            {currentBitrate > 0 && (
              <span className="hidden sm:block text-[10px] text-gray-300 border border-gray-500 px-1.5 py-0.5 rounded">
                {currentBitrate} kbps
              </span>
            )}

            {/* Quality Menu Button */}
            <div className="relative">
              <button onClick={() => setShowQualityMenu(!showQualityMenu)} className="text-white hover:text-[#5b7ea4] transition flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                {currentQuality === -1 ? 'Auto' : `${qualityLevels[currentQuality]?.height}p`}
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-neutral-900 border border-white/10 rounded shadow-xl overflow-hidden z-[60]">
                  {qualityLevels.map((l) => (
                    <button key={l.index} onClick={() => handleQualityChange(l.index)} className="block w-full text-left px-4 py-2 text-xs text-white hover:bg-[#5b7ea4] transition">
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Download Icon */}
            <button onClick={() => setShowDownloadMenu(!showDownloadMenu)} className="text-white hover:text-[#5b7ea4] p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>

            {/* Fullscreen Icon */}
            <button onClick={toggleFullscreen} className="text-white hover:text-[#5b7ea4] p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5-5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#5b7ea4]"></div>
          </div>
        )}
      </div>

      {movieDetails.id ? (
        <>
          {/* Movie details Section  */}
          <section
            style={{
              backgroundImage: `linear-gradient(90deg, #000000f0 0%, #000000e6 35%, #000000c3 100%), url(${
                imageUrl + movieDetails.backdrop_path
              })`,
            }}
            className="bg-cover bg-center object-contain flex flex-col p-5 sm:p-14 lg:flex-row lg:items-center lg:justify-center lg:gap-8 2xl:py-24"
          >
            <div className="lg:w-[45%]">
              <h1 className="text-white font-bold text-3xl mb-2">
                {movieDetails.original_title || movieDetails.title}
              </h1>
              <StarRatings
                rating={movieDetails.vote_average / 2}
                starRatedColor="#5b7ea4"
                numberOfStars={5}
                name="rating"
                starDimension="1rem"
                starSpacing="0.2rem"
              />
              <p className="text-neutral-400 mt-3">{movieDetails.overview}</p>
              <div className="bg-neutral-600 w-full h-[0.1rem] my-5"></div>

              <div className="hidden lg:grid">
                <h1 className=" text-red-700 ">
                  Released on :{" "}
                  <a className="text-white ml-1">
                    {movieDetails.release_date || movieDetails.air_date}
                  </a>
                </h1>
                <h1 className="text-red-700">
                  Language :{" "}
                  <a className="text-white ml-1">
                    {movieDetails.original_language}
                  </a>
                </h1>
                <h1 className="text-red-700">
                  Geners :{" "}
                  {movieDetails.genres &&
                    movieDetails.genres.map((gener) => {
                      return (
                        <>
                          <span className="text-white ml-2">{gener.name}</span>
                        </>
                      );
                    })}
                </h1>
                <div className="hidden lg:flex lg:mt-3 lg:gap-3">
                  {isFromMyList ? (
                    <button
                      onClick={() => removeFromMyList(movieDetails)}
                      className="group flex items-center border-[0.7px] border-white text-white font-medium sm:font-bold text-xs sm:text-lg sd:text-xl py-3 lg:px-10 rounded shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-[#5b7ea4] outline-none focus:outline-none mt-4 mb-3 ease-linear transition-all duration-150"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="h-6 w-6 mr-1  ml-2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Remove Movie
                    </button>
                  ) : isFromWatchedMovies ? (
                    <button
                      onClick={() => removeFromWatchedMovies(movieDetails)}
                      className="group flex items-center border-[0.7px] border-white text-white font-medium sm:font-semibold text-xs sm:text-lg lg:px-10 xl:font-bold py-3 rounded shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-[#5b7ea4] outline-none focus:outline-none mt-4 mb-3 ease-linear transition-all duration-150"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="h-6 w-6 mr-1  ml-2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Remove Movie
                    </button>
                  ) : (
                    <button
                      onClick={() => addToMyList(movieDetails)}
                      className="group flex items-center border-[0.7px] border-white text-white font-medium sm:font-semibold text-xs sm:text-lg lg:px-10 xl:font-bold py-3 rounded shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-[#5b7ea4] outline-none focus:outline-none mt-4 mb-3 ease-linear transition-all duration-150"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 mr-1  ml-2 text-white hover:text-[#5b7ea4] group-hover:text-[#5b7ea4] ease-linear transition-all duration-150"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Add To My List
                    </button>
                  )}

                  {isFromLikedMovies ? (
                    <button
                      onClick={() => removeFromLikedMovies(movieDetails)}
                      className="border-white text-white p-4 rounded-full border-2 sm:ml-4 text-xs sm:mt-4 sm:text-lg md:text-xl shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-[#5b7ea4] outline-none focus:outline-none mb-3 ease-linear transition-all duration-150"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-6 h-6"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 01-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398C20.613 14.547 19.833 15 19 15h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 00.303-.54m.023-8.25H16.48a4.5 4.5 0 01-1.423-.23l-3.114-1.04a4.5 4.5 0 00-1.423-.23H6.504c-.618 0-1.217.247-1.605.729A11.95 11.95 0 002.25 12c0 .434.023.863.068 1.285C2.427 14.306 3.346 15 4.372 15h3.126c.618 0 .991.724.725 1.282A7.471 7.471 0 007.5 19.5a2.25 2.25 0 002.25 2.25.75.75 0 00.75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 002.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384"
                        />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={() => addToLikedMovies(movieDetails)}
                      className="border-white text-white p-4 rounded-full border-2 sm:ml-4 text-xs sm:mt-4 sm:text-lg md:text-xl shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-[#5b7ea4] outline-none focus:outline-none mb-3 ease-linear transition-all duration-150"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-6 h-6"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z"
                        />
                      </svg>
                    </button>
                  )}

                  {/* Download Button */}
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <div className="lg:hidden">
                <div>
                  <h1 className=" text-red-700 text-sm leading-7 sm:text-lg sm:leading-9 lg:text-2xl lg:leading-10">
                    Released on :{" "}
                    <a className="text-white ml-2">
                      {movieDetails.release_date || movieDetails.air_date}
                    </a>
                  </h1>
                  <h1 className=" text-red-700 text-sm leading-7 sm:text-lg sm:leading-9 lg:text-2xl lg:leading-10">
                    Language :{" "}
                    <a className="text-white ml-2">
                      {movieDetails.original_language}
                    </a>
                  </h1>
                  <h1 className="text-red-700 text-sm leading-7 sm:text-lg sm:leading-9 lg:text-2xl lg:leading-10">
                    Geners :{" "}
                    {movieDetails.genres &&
                      movieDetails.genres.slice(0, 2).map((gener) => {
                        return (
                          <>
                            <span className="text-white ml-2">
                              {gener.name}
                            </span>
                          </>
                        );
                      })}
                  </h1>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => addToMyList(movieDetails)}
                    className="group flex items-center justify-center w-full border-[0.7px] border-white text-white font-medium sm:font-bold text-xs sm:px-12 sm:text-lg md:px-16 sd:text-xl  py-3 rounded shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-[#5b7ea4] outline-none focus:outline-none mt-4 mb-3 ease-linear transition-all duration-150"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 mr-1  ml-2 text-white hover:text-[#5b7ea4] group-hover:text-[#5b7ea4] ease-linear transition-all duration-150"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Add To My List
                  </button>
                  <button
                    onClick={() => navigate("/")}
                    className="group flex items-center justify-center w-full bg-[#5b7ea4] border-white text-white font-medium sm:font-bold text-xs sm:mt-4 sm:px-12 sm:text-lg md:px-16 md:text-xl py-3 rounded shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-[#5b7ea4] outline-none focus:outline-none mb-3 ease-linear transition-all duration-150"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6 mr-2 ml-2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                      />
                    </svg>
                    Back to Home
                  </button>
                </div>
              </div>
              <img
                src={
                  movieDetails.poster_path &&
                  `${
                    imageUrl +
                    (window.innerWidth > 1024
                      ? movieDetails.backdrop_path
                        ? movieDetails.backdrop_path
                        : "https://i.ytimg.com/vi/Mwf--eGs05U/maxresdefault.jpg"
                      : movieDetails.poster_path)
                  }`
                }
                className="w-40 rounded-sm lg:w-[45rem] ml-4 lg:ml-0"
                alt='<img src="https://i.ytimg.com/vi/Mwf--eGs05U/maxresdefault.jpg" />'
              />
            </div>
          </section>

          {/* Similar movies section */}
          {similarMovies.length !== 0 && (
            <section>
              <div className="flex flex-wrap justify-center bg-[#000000ac]">
                <div className="p-4 sm:p-14">
                  <h1 className="text-white text-4xl font-semibold my-10 border-l-4 border-red-800 pl-3">
                    Similar Movies
                  </h1>
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                    {similarMovies &&
                      similarMovies.map((similarMovie) => {
                        return (
                          <div class="max-w-sm shadow mb-4">
                            <img
                              src={
                                similarMovie.backdrop_path
                                  ? imageUrl2 + similarMovie.backdrop_path
                                  : "https://i.ytimg.com/vi/Mwf--eGs05U/maxresdefault.jpg"
                              }
                              alt=""
                              className="cursor-pointer"
                              onClick={() => {
                                playMovie(similarMovie);
                                window.location.reload(true);
                              }}
                            />
                            <div class="p-1">
                              <h5 class="mt-1 mb-2 text-xl sm:text-2xl font-bold tracking-tight text-white dark:text-white">
                                {similarMovie.original_title ||
                                  similarMovie.title}
                              </h5>
                              <div className="flex justify-between items-center text-white mb-1">
                                <div className="flex items-center">
                                  <div className="flex sm:flex-col">
                                    <h1 className="text-green-500 text-xs lg:text-base">
                                      {Math.floor(
                                        Math.random() * (100 - 60 + 1) + 60
                                      )}
                                      % match
                                    </h1>
                                    <h1 className="text-xs lg:text-base ml-2 sm:ml-0">
                                      {similarMovie.release_date ||
                                        (similarMovie.first_air_date &&
                                          similarMovie.release_date) ||
                                        similarMovie.first_air_date}
                                    </h1>
                                  </div>
                                  <h1 className="hidden sm:grid py-1 px-2 border-2 border-gray-800 rounded-md ml-2">
                                    HD
                                  </h1>
                                </div>
                                <div>
                                  <svg
                                    onClick={() => addToMyList(similarMovie)}
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-9 h-9 cursor-pointer hidden sm:grid"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                </div>
                              </div>
                              <p class="mb-3 font-normal text-stone-400 line-clamp-3 text-xs sm:text-base">
                                {similarMovie.overview}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <div className="px-4 lg:px-10 xl:px-12 animate-pulse">
            <div className="w-72 mt-4 sm:ml-0 sm:w-96 py-5 mb-7 xl:py-7 xl:w-45rem bg-neutral-900 rounded-md"></div>
            <div className="w-full py-1 mb-3 xl:py-2 bg-neutral-900 rounded-md"></div>
            <div className="w-full py-1 mb-3 xl:py-2 bg-neutral-900 rounded-md"></div>
            <div className="w-full py-1 mb-3 xl:py-2 bg-neutral-900 rounded-md"></div>
            <div className="w-full py-1 mb-8 xl:py-2 bg-neutral-900 rounded-md"></div>
          </div>
        </>
      )}
      <Footer></Footer>
    </div>
  );
}

export default Play;
