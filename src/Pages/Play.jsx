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

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import usePlayMovie from "../CustomHooks/usePlayMovie";
import useUpdateWatchedMovies from "../CustomHooks/useUpdateWatchedMovies";

function Play() {
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentBitrate, setCurrentBitrate] = useState(0);
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

  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { User } = useContext(AuthContext);

  useEffect(() => {
    // Scroll to top when page loads
    window.scrollTo(0, 0);
    
    if (location.state.From === "MyList") {
      setIsFromMyList(true);
    }
    if (location.state.From === "LikedMovies") {
      setIsFromLikedMovies(true);
    }
    if (location.state.From === "WatchedMovies") {
      setIsFromWatchedMovies(true);
    }

    // Check for saved progress from Firestore
    const checkProgress = async () => {
      try {
        const docSnap = await getDoc(doc(db, "WatchedMovies", User.uid));
        if (docSnap.exists()) {
          const movies = docSnap.data().movies;
          const movie = movies.find(m => m.id === parseInt(id));
          
          if (movie && movie.progress > 30 && !movie.completed) {
            setSavedProgress(movie.progress);
            setShowContinuePrompt(true);
          }
        }
      } catch (error) {
        console.log("No saved progress", error);
      }
    };
    
    checkProgress();

    // Fetch video URL from Django backend
    axios
      .get(`${DJANGO_API_URL}/movies/${id}/video/`)
      .then((response) => {
        const s3Url = `https://streamzw-content.s3.us-east-1.amazonaws.com/processed/${response.data.video_url}`;
        setVideoUrl(s3Url);
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
            
            hls.loadSource(s3Url);
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
            videoRef.current.src = s3Url;
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
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  const handleQualityChange = (levelIndex) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentQuality(levelIndex);
      setShowQualityMenu(false);
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
      <Navbar playPage></Navbar>

      {PopupMessage}

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

      <div className="mt-12 h-[31vh] sm:h-[42vh] md:h-[45vh] lg:h-[55vh] lg:mt-0 xl:h-[98vh] relative bg-black">
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
            <button
              onClick={() => navigate("/series")}
              className="absolute top-6 left-6 z-50 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-80 transition-all duration-200 backdrop-blur-sm"
              title="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Video player */}
            <div 
              ref={containerRef}
              className="relative bg-black group h-full"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => isPlaying && setShowControls(false)}
            >
              <video
                ref={videoRef}
                width="100%"
                height="100%"
                style={{ height: "100%", objectFit: "contain" }}
                autoPlay
                className="bg-black"
                onClick={togglePlay}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(e) => {
                  setCurrentTime(e.target.currentTime);
                  setDuration(e.target.duration);
                  if (Math.floor(e.target.currentTime) % 10 === 0) {
                    updateWatchProgress(parseInt(id), e.target.currentTime, e.target.duration);
                  }
                }}
                onLoadedMetadata={(e) => setDuration(e.target.duration)}
                onEnded={() => {
                  if (videoRef.current) {
                    updateWatchProgress(parseInt(id), videoRef.current.currentTime, videoRef.current.duration);
                  }
                }}
              >
                Your browser does not support the video tag.
              </video>
              
              {/* Custom Controls */}
              <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                {/* Progress Bar */}
                <div className="px-4 pt-2">
                  <div 
                    className="h-1 bg-gray-600 rounded cursor-pointer group/progress hover:h-2 transition-all"
                    onClick={handleSeek}
                  >
                    <div 
                      className="h-full bg-[#5b7ea4] rounded relative"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100"></div>
                    </div>
                  </div>
                </div>
                
                {/* Controls Bar */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-4">
                    {/* Play/Pause */}
                    <button onClick={togglePlay} className="text-white hover:text-[#5b7ea4] transition">
                      {isPlaying ? (
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                        </svg>
                      ) : (
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>
                    
                    {/* Volume */}
                    <div className="flex items-center gap-2 group/volume">
                      <button className="text-white hover:text-[#5b7ea4] transition">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                        </svg>
                      </button>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.1" 
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-0 group-hover/volume:w-20 transition-all opacity-0 group-hover/volume:opacity-100"
                      />
                    </div>
                    
                    {/* Time */}
                    <span className="text-white text-sm">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                    
                    {/* Current Quality Indicator */}
                    {currentBitrate > 0 && (
                      <span className="text-[#5b7ea4] text-xs font-medium">
                        {currentBitrate} kbps
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Quality Selector */}
                    <div className="relative">
                      <button
                        onClick={() => setShowQualityMenu(!showQualityMenu)}
                        className="text-white hover:text-[#5b7ea4] transition flex items-center gap-1 bg-white/10 px-3 py-1 rounded"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                        </svg>
                        <span className="text-sm font-medium">
                          {qualityLevels.length > 0 
                            ? (currentQuality === -1 ? 'Auto' : qualityLevels.find(l => l.index === currentQuality)?.label)
                            : 'Quality'
                          }
                        </span>
                      </button>
                      
                      {showQualityMenu && (
                        <div className="absolute bottom-full mb-2 right-0 bg-black/95 rounded overflow-hidden min-w-[120px] border border-white/20">
                          <button
                            onClick={() => handleQualityChange(-1)}
                            className={`block w-full text-left px-4 py-2 text-white text-sm hover:bg-[#5b7ea4] transition ${currentQuality === -1 ? 'bg-[#5b7ea4]' : ''}`}
                          >
                            Auto
                          </button>
                          {qualityLevels.length > 0 && qualityLevels.map((level) => (
                            <button
                              key={level.index}
                              onClick={() => handleQualityChange(level.index)}
                              className={`block w-full text-left px-4 py-2 text-white text-sm hover:bg-[#5b7ea4] transition ${currentQuality === level.index ? 'bg-[#5b7ea4]' : ''}`}
                            >
                              {level.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Fullscreen */}
                    <button onClick={toggleFullscreen} className="text-white hover:text-[#5b7ea4] transition">
                      {isFullscreen ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                        </svg>
                      )}
                    </button>
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
                <div className="hidden lg:flex lg:mt-3">
                  {isFromMyList ? (
                    <button
                      onClick={() => removeFromMyList(movieDetails)}
                      className="group flex items-center border-[0.7px] border-white text-white font-medium sm:font-bold text-xs sm:text-lg sd:text-xl py-3 lg:px-10 rounded shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-red-700 outline-none focus:outline-none mt-4 mb-3 ease-linear transition-all duration-150"
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
                      className="group flex items-center border-[0.7px] border-white text-white font-medium sm:font-semibold text-xs sm:text-lg lg:px-10 xl:font-bold py-3 rounded shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-red-700 outline-none focus:outline-none mt-4 mb-3 ease-linear transition-all duration-150"
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
                      className="group flex items-center border-[0.7px] border-white text-white font-medium sm:font-semibold text-xs sm:text-lg lg:px-10 xl:font-bold py-3 rounded shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-red-700 outline-none focus:outline-none mt-4 mb-3 ease-linear transition-all duration-150"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 mr-1  ml-2 text-white hover:text-red-700 group-hover:text-red-700 ease-linear transition-all duration-150"
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
                      className="border-white text-white p-4 rounded-full border-2 sm:ml-4 text-xs sm:mt-4 sm:text-lg md:text-xl shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-red-700 outline-none focus:outline-none mb-3 ease-linear transition-all duration-150"
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
                      className="border-white text-white p-4 rounded-full border-2 sm:ml-4 text-xs sm:mt-4 sm:text-lg md:text-xl shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-red-700 outline-none focus:outline-none mb-3 ease-linear transition-all duration-150"
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
                <div>
                  <button
                    onClick={() => addToMyList(movieDetails)}
                    className="group flex items-center justify-center w-full border-[0.7px] border-white text-white font-medium sm:font-bold text-xs sm:px-12 sm:text-lg md:px-16 sd:text-xl  py-3 rounded shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-red-700 outline-none focus:outline-none mt-4 mb-3 ease-linear transition-all duration-150"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 mr-1  ml-2 text-white hover:text-red-700 group-hover:text-red-700 ease-linear transition-all duration-150"
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
                    className="group flex items-center justify-center w-full bg-red-600 border-white text-white font-medium sm:font-bold text-xs sm:mt-4 sm:px-12 sm:text-lg md:px-16 md:text-xl py-3 rounded shadow hover:shadow-lg hover:bg-white hover:border-white hover:text-red-700 outline-none focus:outline-none mb-3 ease-linear transition-all duration-150"
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
