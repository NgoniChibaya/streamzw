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
    
    // Fetch video and handle CloudFront Signatures
    axios.get(`${DJANGO_API_URL}/movies/${id}/video/`)
      .then((response) => {
        const { video_url, cookies } = response.data || {};
        if (!video_url) { setVideoError(true); return; }

        // Construct the signature string to append to all HLS segments
        let signatureParams = "";
        if (cookies) {
          const params = new URLSearchParams();
          Object.keys(cookies).forEach(key => params.append(key, cookies[key]));
          signatureParams = params.toString();
        }

        const finalVideoUrl = `${video_url}${video_url.includes('?') ? '&' : '?'}${signatureParams}`;
        setVideoUrl(finalVideoUrl);
        setVideoError(false);

        if (videoRef.current) {
          if (Hls.isSupported()) {
            const hls = new Hls({
              // THIS IS THE CRITICAL FIX
              xhrSetup: function(xhr, url) {
                xhr.withCredentials = true; // Attempt to send cookies
                
                // If the sub-request (segment) doesn't have the signature, append it manually
                if (signatureParams && !url.includes("CloudFront-Signature")) {
                    const separator = url.includes("?") ? "&" : "?";
                    const newUrl = url + separator + signatureParams;
                    xhr.open('GET', newUrl, true);
                }
              }
            });

            hlsRef.current = hls;
            hls.loadSource(finalVideoUrl);
            hls.attachMedia(videoRef.current);
            
            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
              setQualityLevels(data.levels.map((l, i) => ({ index: i, height: l.height, label: `${l.height}p` })));
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) hls.startLoad(); // Retry on error
            });
          } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            videoRef.current.src = finalVideoUrl;
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

    return () => { if (hlsRef.current) hlsRef.current.destroy(); };
  }, [id]);

  // Video Controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
    setIsPlayingLocal(!videoRef.current.paused);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * videoRef.current.duration;
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

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
          <div ref={containerRef} className="relative w-full max-w-5xl aspect-video bg-black group">
            <video 
              ref={videoRef} 
              autoPlay 
              className="w-full h-full"
              onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.target.duration)}
            />
            
            {/* Minimal Controls Overlay */}
            <div className="absolute inset-0 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/80 to-transparent">
              <div className="w-full h-1 bg-gray-600 cursor-pointer mb-4" onClick={handleSeek}>
                <div className="h-full bg-blue-500" style={{ width: `${(currentTime/duration)*100}%` }} />
              </div>
              <div className="flex justify-between items-center">
                <button onClick={togglePlay} className="text-2xl">{isPlaying ? "⏸" : "▶"}</button>
                <span className="text-sm">{formatTime(currentTime)} / {formatTime(duration)}</span>
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