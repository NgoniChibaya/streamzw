import React, { useEffect, useState } from 'react';
import { getDownloadProgress, cancelDownload } from '../../Services/downloadService';

const DownloadProgress = ({ movieId, movieTitle, onComplete, onError, onCancel }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('initializing');
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [downloadedSegments, setDownloadedSegments] = useState(0);
  const [totalSegments, setTotalSegments] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const downloadData = getDownloadProgress(movieId);
      if (downloadData) {
        setProgress(downloadData.progress || 0);
        setStatus(downloadData.status || 'downloading');
        setDownloadedSegments(downloadData.downloadedSegments || 0);
        setTotalSegments(downloadData.totalSegments || 0);

        // Calculate estimated time
        if (downloadData.progress > 0 && downloadData.progress < 100) {
          const elapsedSeconds = (Date.now() / 1000);
          const bytesPerSecond = (downloadData.progress / 100) / (elapsedSeconds || 1);
          const remainingBytes = ((100 - downloadData.progress) / 100);
          const estimatedSeconds = remainingBytes / (bytesPerSecond || 1);
          
          if (estimatedSeconds > 0) {
            const minutes = Math.floor(estimatedSeconds / 60);
            const seconds = Math.floor(estimatedSeconds % 60);
            setEstimatedTime(
              minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
            );
          }
        }

        if (downloadData.progress === 100 && downloadData.status === 'completed') {
          onComplete?.();
          clearInterval(interval);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [movieId, onComplete]);

  const handleCancel = () => {
    cancelDownload(movieId);
    onCancel?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
      <div className="bg-neutral-800 rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-white text-2xl font-bold mb-2">{movieTitle}</h2>
        <p className="text-gray-400 mb-6 text-sm">Downloading for offline viewing</p>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-white text-sm font-medium">
              {downloadedSegments} / {totalSegments} segments
            </span>
            <span className="text-[#5b7ea4] text-sm font-medium">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded overflow-hidden">
            <div
              className="h-full bg-[#5b7ea4] transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Status and ETA */}
        <div className="flex justify-between items-center mb-6">
          <span className="text-gray-400 text-sm">
            {status === 'completed' && 'Download complete!'}
            {status === 'downloading' && 'Downloading...'}
            {status === 'paused' && 'Paused'}
            {status === 'initializing' && 'Initializing...'}
            {status === 'cancelled' && 'Download cancelled'}
          </span>
          {estimatedTime && status === 'downloading' && (
            <span className="text-gray-400 text-sm">{estimatedTime} remaining</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {status === 'downloading' && (
            <button className="flex-1 bg-red-800 hover:bg-red-900 text-white py-2 px-4 rounded transition">
              Pause
            </button>
          )}
          {status === 'paused' && (
            <button className="flex-1 bg-red-800 hover:bg-red-900 text-white py-2 px-4 rounded transition">
              Resume
            </button>
          )}
          {status === 'completed' ? (
            <button
              onClick={onComplete}
              className="flex-1 bg-[#5b7ea4] hover:bg-[#4a6a8f] text-white py-2 px-4 rounded transition font-bold"
            >
              Done
            </button>
          ) : (
            <button 
              onClick={handleCancel}
              className="flex-1 bg-neutral-600 hover:bg-neutral-700 text-white py-2 px-4 rounded transition"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Info Text */}
        <p className="text-gray-500 text-xs mt-4 text-center">
          Download will be available for 30 days
        </p>
      </div>
    </div>
  );
};

export default DownloadProgress;
