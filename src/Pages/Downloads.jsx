import React, { useEffect, useState } from 'react';
import { getAllMovies, deleteMovie, getStorageUsage } from '../Services/indexedDbService';
import { checkIfDownloaded, getDownloadedMovie } from '../Services/downloadService';
import { imageUrl } from '../Constants/Constance';
import Navbar from '../componets/Header/Navbar';
import Footer from '../componets/Footer/Footer';
import { useNavigate } from 'react-router-dom';

const Downloads = () => {
  const [downloadedMovies, setDownloadedMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storageUsage, setStorageUsage] = useState(null);
  const [selectedMovies, setSelectedMovies] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    loadDownloads();
  }, []);

  const loadDownloads = async () => {
    try {
      setLoading(true);
      const movies = await getAllMovies();
      const completed = movies.filter(m => m.status === 'completed');
      setDownloadedMovies(completed);

      const usage = await getStorageUsage();
      setStorageUsage(usage);
    } catch (error) {
      console.error('Failed to load downloads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (movieId) => {
    if (window.confirm('Delete this download?')) {
      try {
        await deleteMovie(movieId);
        setDownloadedMovies(prev => prev.filter(m => m.id !== movieId));
        const usage = await getStorageUsage();
        setStorageUsage(usage);
      } catch (error) {
        console.error('Failed to delete movie:', error);
        alert('Failed to delete download');
      }
    }
  };

  const handlePlay = (movieId) => {
    navigate(`/play/${movieId}`, { state: { From: 'Downloads', offline: true } });
  };

  const handleSelectAll = () => {
    if (selectedMovies.size === downloadedMovies.length) {
      setSelectedMovies(new Set());
    } else {
      setSelectedMovies(new Set(downloadedMovies.map(m => m.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedMovies.size === 0) return;
    
    if (window.confirm(`Delete ${selectedMovies.size} downloads?`)) {
      try {
        for (const movieId of selectedMovies) {
          await deleteMovie(movieId);
        }
        setDownloadedMovies(prev =>
          prev.filter(m => !selectedMovies.has(m.id))
        );
        setSelectedMovies(new Set());
        const usage = await getStorageUsage();
        setStorageUsage(usage);
      } catch (error) {
        console.error('Failed to delete movies:', error);
        alert('Failed to delete downloads');
      }
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      
      <div className="pt-20 px-4 sm:px-8 lg:px-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">
            My Downloads
          </h1>
          <p className="text-gray-400">
            {downloadedMovies.length} video{downloadedMovies.length !== 1 ? 's' : ''} downloaded
          </p>
        </div>

        {/* Storage Usage */}
        {storageUsage && (
          <div className="mb-8 bg-neutral-900 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Storage Used</span>
              <span className="text-white font-semibold">
                {storageUsage.totalMB} MB / 5000 MB
              </span>
            </div>
            <div className="w-full h-2 bg-gray-700 rounded overflow-hidden">
              <div
                className="h-full bg-[#5b7ea4] transition-all duration-300"
                style={{
                  width: `${Math.min((parseFloat(storageUsage.totalMB) / 5000) * 100, 100)}%`
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Actions */}
        {downloadedMovies.length > 0 && (
          <div className="mb-6 flex gap-3">
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-sm transition"
            >
              {selectedMovies.size === downloadedMovies.length ? 'Deselect All' : 'Select All'}
            </button>
            {selectedMovies.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="px-4 py-2 bg-[#5b7ea4] hover:bg-[#4a6a8f] text-white rounded text-sm transition"
              >
                Delete {selectedMovies.size} Selected
              </button>
            )}
          </div>
        )}

        {/* Movies Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#5b7ea4]"></div>
          </div>
        ) : downloadedMovies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-16 h-16 text-gray-600 mb-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            <h2 className="text-xl text-gray-400 mb-2">No Downloads Yet</h2>
            <p className="text-gray-500 mb-4">
              Download movies to watch them offline
            </p>
            <button
              onClick={() => navigate('/series')}
              className="px-6 py-2 bg-[#5b7ea4] hover:bg-[#4a6a8f] text-white rounded transition"
            >
              Browse Movies
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-12">
            {downloadedMovies.map((movie) => (
              <div key={movie.id} className="group relative">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedMovies.has(movie.id)}
                  onChange={() => {
                    const newSelected = new Set(selectedMovies);
                    if (newSelected.has(movie.id)) {
                      newSelected.delete(movie.id);
                    } else {
                      newSelected.add(movie.id);
                    }
                    setSelectedMovies(newSelected);
                  }}
                  className="absolute top-2 left-2 z-30 w-4 h-4 cursor-pointer"
                />

                {/* Movie Card */}
                <div className="relative overflow-hidden rounded-lg bg-neutral-900 aspect-video">
                  <img
                    src={
                      movie.backdrop_path
                        ? imageUrl + movie.backdrop_path
                        : 'https://i.ytimg.com/vi/Mwf--eGs05U/maxresdefault.jpg'
                    }
                    alt={movie.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                  />

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition duration-300 flex flex-col justify-between p-3">
                    <div>
                      <h3 className="text-white font-semibold text-sm line-clamp-2 mb-2">
                        {movie.title}
                      </h3>
                      <p className="text-gray-300 text-xs mb-2">
                        {movie.quality}
                      </p>
                      <p className="text-gray-400 text-xs">
                        Downloaded {new Date(movie.timestamp).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePlay(movie.id)}
                        className="flex-1 bg-[#5b7ea4] hover:bg-[#4a6a8f] text-white px-2 py-1 rounded text-xs font-semibold transition"
                      >
                        Play
                      </button>
                      <button
                        onClick={() => handleDelete(movie.id)}
                        className="bg-red-800 hover:bg-red-900 text-white px-2 py-1 rounded transition"
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
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 2.991a48.114 48.114 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.51 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Downloaded Badge */}
                  <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      className="w-3 h-3"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                    Downloaded
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Downloads;
