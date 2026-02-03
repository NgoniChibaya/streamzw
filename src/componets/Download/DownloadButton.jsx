import React, { useState } from 'react';
import { initializeDownload, downloadSegments, getDownloadProgress } from '../../Services/downloadService';

const DownloadButton = ({ movieDetails, movieId, isDownloaded, onDownloadStart }) => {
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('720');

  const handleDownload = async (quality) => {
    try {
      setIsDownloading(true);
      onDownloadStart?.('initializing');

      const downloadData = await initializeDownload(movieId, movieDetails, quality);
      
      onDownloadStart?.('downloading', downloadData);
      setShowQualityMenu(false);

      // Start segment download in background
      setTimeout(() => {
        downloadSegments(
          movieId,
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

  if (isDownloaded) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-600/30 border border-green-600 rounded text-green-400 text-sm font-medium">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          viewBox="0 0 24 24"
          className="w-4 h-4"
        >
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
        Downloaded
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowQualityMenu(!showQualityMenu)}
        disabled={isDownloading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded transition-colors duration-200 text-sm font-medium"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-4 h-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        {isDownloading ? 'Downloading...' : 'Download'}
      </button>

      {showQualityMenu && !isDownloading && (
        <div className="absolute top-full mt-2 right-0 bg-neutral-800 border border-neutral-700 rounded shadow-lg overflow-hidden z-50">
          <button
            onClick={() => {
              handleDownload('auto');
            }}
            className="block w-full text-left px-4 py-2 text-white text-sm hover:bg-neutral-700 transition"
          >
            Auto Quality
          </button>
          <button
            onClick={() => {
              handleDownload('1080');
            }}
            className="block w-full text-left px-4 py-2 text-white text-sm hover:bg-neutral-700 transition"
          >
            1080p
          </button>
          <button
            onClick={() => {
              handleDownload('720');
            }}
            className="block w-full text-left px-4 py-2 text-white text-sm hover:bg-neutral-700 transition"
          >
            720p
          </button>
          <button
            onClick={() => {
              handleDownload('480');
            }}
            className="block w-full text-left px-4 py-2 text-white text-sm hover:bg-neutral-700 transition border-t border-neutral-700"
          >
            480p (Low)
          </button>
        </div>
      )}
    </div>
  );
};

export default DownloadButton;
