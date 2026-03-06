import axios from '../axios';
import { DJANGO_API_URL } from '../Constants/Constance';
import {
  saveMovie,
  getMovie,
  saveSegment,
  getSegment,
  saveManifest,
  getManifest,
} from './indexedDbService';
import Hls from 'hls.js';

const SEGMENT_CHUNK_SIZE = 512000; // 512KB chunks for streaming
const MAX_STORAGE_MB = 5000; // 5GB max storage

// Download queue management
const downloadQueue = new Map();

export const initializeDownload = async (movieId, movieDetails, quality = 'auto') => {
  try {
    const existingMovie = await getMovie(movieId);
    if (existingMovie) {
      throw new Error('Video already downloaded');
    }

    // Fetch the video URL and get manifest
    const response = await axios.get(`${DJANGO_API_URL}/movies/${movieId}/video/`);
    // Check if video_url is already a complete URL (from media server) or needs S3 prepending
    const s3Url = response.data.video_url.startsWith('http') 
      ? response.data.video_url 
      : `${response.data.video_url}`;

    // Create a temporary HLS instance to get manifest
    const tempHls = new Hls({
      xhrSetup: function (xhr) {
        xhr.withCredentials = true;
      }
    });

    return new Promise((resolve, reject) => {
      tempHls.on(Hls.Events.MANIFEST_PARSED, async (event, data) => {
        try {
          const levels = data.levels;
          
          // Select 480p quality for downloads
          let selectedLevel = levels.findIndex(l => l.height === 480);
          if (selectedLevel === -1) {
            selectedLevel = 0; // Fallback to lowest quality
          }

          const level = levels[selectedLevel];
          const movieRecord = {
            id: movieId.toString(),
            title: movieDetails.original_title || movieDetails.title,
            overview: movieDetails.overview,
            poster_path: movieDetails.poster_path,
            backdrop_path: movieDetails.backdrop_path,
            quality: `${level.height}p`,
            bitrate: level.bitrate,
            totalSize: 0, // Will be calculated
            downloadedSize: 0,
            status: 'downloading',
            selectedLevel,
            timestamp: Date.now(),
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
            manifestUrl: s3Url,
            playlistUrl: level.url,
            levelPlaylists: levels.map((l, idx) => ({
              index: idx,
              height: l.height,
              url: l.url
            }))
          };

          await saveMovie(movieRecord);

          downloadQueue.set(movieId.toString(), {
            movieId: movieId.toString(),
            status: 'downloading',
            progress: 0,
            totalSegments: 0,
            downloadedSegments: 0
          });

          tempHls.destroy();
          resolve({
            movieId: movieId.toString(),
            movieRecord,
            s3Url,
            selectedLevel,
            levelPlaylists: levels
          });
        } catch (error) {
          tempHls.destroy();
          reject(error);
        }
      });

      tempHls.on(Hls.Events.ERROR, (event, data) => {
        tempHls.destroy();
        reject(new Error(`HLS Error: ${data.details}`));
      });

      tempHls.loadSource(s3Url);
    });
  } catch (error) {
    console.error('Download initialization failed:', error);
    throw error;
  }
};

export const downloadSegments = async (movieId, manifestUrl, selectedLevel, levelPlaylists = []) => {
  try {
    const movieId_str = movieId.toString ? movieId.toString() : movieId;

    // Get the actual URL string from the level object
    let playlistUrl = manifestUrl;
    if (Array.isArray(levelPlaylists) && levelPlaylists.length > 0 && levelPlaylists[selectedLevel]) {
      const level = levelPlaylists[selectedLevel];
      playlistUrl = level.url ? level.url[0] : manifestUrl;
    }

    console.log('Downloading from playlist URL:', playlistUrl);

    const playlistResponse = await axios.get(playlistUrl, {
      withCredentials: true
    });
    const manifestContent = playlistResponse.data;

    console.log('Manifest content length:', manifestContent.length);

    await saveManifest(movieId_str, manifestContent);

    const segmentUrls = parseM3U8Manifest(manifestContent, playlistUrl);
    console.log('Total segments to download:', segmentUrls.length);

    if (segmentUrls.length === 0) {
      throw new Error('No segments found in manifest');
    }

    const totalSegments = segmentUrls.length;
    let downloadedSegments = 0;
    let totalDownloadedBytes = 0;

    for (let i = 0; i < segmentUrls.length; i++) {
      const segmentUrl = segmentUrls[i];
      
      const existingSegment = await getSegment(movieId_str, i);
      if (existingSegment) {
        downloadedSegments++;
        totalDownloadedBytes += existingSegment.byteLength;
        updateDownloadProgress(movieId_str, downloadedSegments, totalSegments);
        continue;
      }

      try {
        const segmentResponse = await axios.get(segmentUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          withCredentials: true
        });

        await saveSegment(movieId_str, i, segmentResponse.data);
        downloadedSegments++;
        totalDownloadedBytes += segmentResponse.data.byteLength;
        updateDownloadProgress(movieId_str, downloadedSegments, totalSegments);
        console.log(`Downloaded segment ${i + 1}/${totalSegments}`);
      } catch (error) {
        console.error(`Failed to download segment ${i}:`, error);
      }
    }

    console.log('Download complete. Total bytes:', totalDownloadedBytes);

    const movie = await getMovie(movieId_str);
    movie.status = 'completed';
    movie.downloadedSize = totalDownloadedBytes;
    await saveMovie(movie);

    downloadQueue.delete(movieId_str);
    return { success: true, downloadedSegments, totalSegments };
  } catch (error) {
    console.error('Segment download failed:', error);
    throw error;
  }
};

const parseM3U8Manifest = (manifestContent, baseUrl) => {
  const lines = manifestContent.split('\n');
  const segmentUrls = [];
  const baseUrlParts = baseUrl.split('/');
  baseUrlParts.pop(); // Remove filename
  const basePath = baseUrlParts.join('/');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.endsWith('.ts')) {
      const segmentUrl = trimmed.startsWith('http')
        ? trimmed
        : `${basePath}/${trimmed}`;
      segmentUrls.push(segmentUrl);
    }
  }

  return segmentUrls;
};

const updateDownloadProgress = (movieId, downloadedSegments, totalSegments) => {
  const progress = Math.round((downloadedSegments / totalSegments) * 100);
  if (downloadQueue.has(movieId)) {
    const download = downloadQueue.get(movieId);
    download.progress = progress;
    download.downloadedSegments = downloadedSegments;
    download.totalSegments = totalSegments;
  }
};

export const getDownloadProgress = (movieId) => {
  const movieId_str = movieId.toString ? movieId.toString() : movieId;
  return downloadQueue.get(movieId_str) || { progress: 0 };
};

export const pauseDownload = (movieId) => {
  const movieId_str = movieId.toString ? movieId.toString() : movieId;
  if (downloadQueue.has(movieId_str)) {
    const download = downloadQueue.get(movieId_str);
    download.status = 'paused';
  }
};

export const resumeDownload = async (movieId) => {
  const movieId_str = movieId.toString ? movieId.toString() : movieId;
  const movie = await getMovie(movieId_str);
  
  if (!movie) {
    throw new Error('Movie not found');
  }

  if (downloadQueue.has(movieId_str)) {
    const download = downloadQueue.get(movieId_str);
    download.status = 'downloading';
  } else {
    downloadQueue.set(movieId_str, {
      movieId: movieId_str,
      status: 'downloading',
      progress: 0,
      totalSegments: 0,
      downloadedSegments: 0
    });
  }
};

export const cancelDownload = async (movieId) => {
  const movieId_str = movieId.toString ? movieId.toString() : movieId;
  if (downloadQueue.has(movieId_str)) {
    const download = downloadQueue.get(movieId_str);
    download.status = 'cancelled';
    downloadQueue.delete(movieId_str);
  }
};

export const checkIfDownloaded = async (movieId) => {
  const movieId_str = movieId.toString ? movieId.toString() : movieId;
  const movie = await getMovie(movieId_str);
  return movie && movie.status === 'completed';
};

export const getDownloadedMovie = async (movieId) => {
  const movieId_str = movieId.toString ? movieId.toString() : movieId;
  return await getMovie(movieId_str);
};
