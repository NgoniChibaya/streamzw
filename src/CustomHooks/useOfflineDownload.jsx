import { useState, useCallback } from 'react';
import {
  initializeDownload,
  downloadSegments,
  checkIfDownloaded,
  getDownloadedMovie,
  getDownloadProgress
} from '../../Services/downloadService';

export const useOfflineDownload = (movieId) => {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('idle');
  const [error, setError] = useState(null);

  const initDownload = useCallback(async (movieDetails, quality = 'auto') => {
    try {
      setError(null);
      setDownloadStatus('initializing');
      setDownloadProgress(0);

      const downloadData = await initializeDownload(movieId, movieDetails, quality);
      
      setDownloadStatus('downloading');

      // Start segment download
      await downloadSegments(
        movieId,
        downloadData.s3Url,
        downloadData.selectedLevel
      );

      setDownloadStatus('completed');
      setDownloadProgress(100);
      setIsDownloaded(true);

      return downloadData;
    } catch (err) {
      setError(err.message);
      setDownloadStatus('error');
      throw err;
    }
  }, [movieId]);

  const checkDownloadStatus = useCallback(async () => {
    const downloaded = await checkIfDownloaded(movieId);
    setIsDownloaded(downloaded);
    return downloaded;
  }, [movieId]);

  const getMovie = useCallback(async () => {
    const movie = await getDownloadedMovie(movieId);
    return movie;
  }, [movieId]);

  return {
    isDownloaded,
    downloadProgress,
    downloadStatus,
    error,
    initDownload,
    checkDownloadStatus,
    getMovie
  };
};

export default useOfflineDownload;
