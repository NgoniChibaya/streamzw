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
    const s3Url = `https://streamzw-content.s3.us-east-1.amazonaws.com/processed/${response.data.video_url}`;

    // Create a temporary HLS instance to get manifest
    const tempHls = new Hls({
      xhrSetup: function (xhr) {
        xhr.withCredentials = false;
      }
    });

    return new Promise((resolve, reject) => {
      tempHls.on(Hls.Events.MANIFEST_PARSED, async (event, data) => {
        try {
          const levels = data.levels;
          
          // Select quality level
          let selectedLevel = 0;
          if (quality !== 'auto') {
            const selectedQuality = levels.findIndex(
              (l) => l.height === parseInt(quality)
            );
            selectedLevel = selectedQuality !== -1 ? selectedQuality : 0;
          } else {
            // Auto: select middle quality to balance size and quality
            selectedLevel = Math.floor(levels.length / 2);
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
            levels
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

export const downloadSegments = async (movieId, manifestUrl, selectedLevel) => {
  try {
    const movieId_str = movieId.toString ? movieId.toString() : movieId;
    
    // Fetch the playlist for selected level
    const playlistResponse = await axios.get(manifestUrl);
    const manifestContent = playlistResponse.data;

    // Parse M3U8 manifest to get segment URLs
    const segmentUrls = parseM3U8Manifest(manifestContent, manifestUrl);
    
    // Save manifest for offline use
    await saveManifest(movieId_str, manifestContent);

    // Download each segment
    const totalSegments = segmentUrls.length;
    let downloadedSegments = 0;

    for (let i = 0; i < segmentUrls.length; i++) {
      const segmentUrl = segmentUrls[i];
      
      // Check if already downloaded
      const existingSegment = await getSegment(movieId_str, i);
      if (existingSegment) {
        downloadedSegments++;
        updateDownloadProgress(movieId_str, downloadedSegments, totalSegments);
        continue;
      }

      try {
        const segmentResponse = await axios.get(segmentUrl, {
          responseType: 'arraybuffer',
          timeout: 30000
        });

        await saveSegment(movieId_str, i, segmentResponse.data);
        downloadedSegments++;
        updateDownloadProgress(movieId_str, downloadedSegments, totalSegments);
      } catch (error) {
        console.error(`Failed to download segment ${i}:`, error);
        // Continue with next segment
      }
    }

    // Update movie status
    const movie = await getMovie(movieId_str);
    movie.status = 'completed';
    movie.downloadedSize = downloadedSegments * (SEGMENT_CHUNK_SIZE || 512000);
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
