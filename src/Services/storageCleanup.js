import { getAllMovies, deleteMovie, getStorageUsage } from './indexedDbService';

const MAX_STORAGE_MB = 5000; // 5GB
const EXPIRY_DAYS = 30;

/**
 * Check if storage is running low and clean old downloads
 */
export const cleanupOldDownloads = async () => {
  try {
    const usage = await getStorageUsage();
    const usedMB = parseFloat(usage.totalMB);
    const threshold = MAX_STORAGE_MB * 0.9; // 90% threshold

    if (usedMB > threshold) {
      console.log(`Storage usage (${usedMB}MB) exceeds threshold (${threshold}MB), cleaning old downloads...`);
      
      const movies = await getAllMovies();
      
      // Sort by timestamp (oldest first)
      const sorted = movies.sort((a, b) => a.timestamp - b.timestamp);

      // Delete oldest movies until under threshold
      for (const movie of sorted) {
        if (usedMB <= threshold) break;
        
        await deleteMovie(movie.id);
        const segments = movie.title ? 
          await getMovieSegments(movie.id) : [];
        const movieSizeMB = (segments.reduce((sum, seg) => sum + seg.size, 0)) / (1024 * 1024);
        usedMB -= movieSizeMB;
        
        console.log(`Deleted old download: ${movie.title} (${movieSizeMB.toFixed(2)}MB)`);
      }
    }
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
};

/**
 * Delete expired downloads (older than EXPIRY_DAYS)
 */
export const deleteExpiredDownloads = async () => {
  try {
    const now = Date.now();
    const expiryTime = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    const movies = await getAllMovies();
    
    for (const movie of movies) {
      const movieAge = now - movie.timestamp;
      
      if (movieAge > expiryTime) {
        console.log(`Deleting expired download: ${movie.title}`);
        await deleteMovie(movie.id);
      }
    }
  } catch (error) {
    console.error('Expiry cleanup failed:', error);
  }
};

/**
 * Get storage stats
 */
export const getStorageStats = async () => {
  try {
    const usage = await getStorageUsage();
    const movies = await getAllMovies();
    
    const percentUsed = (parseFloat(usage.totalMB) / MAX_STORAGE_MB) * 100;
    const availableMB = MAX_STORAGE_MB - parseFloat(usage.totalMB);

    return {
      totalMB: parseFloat(usage.totalMB).toFixed(2),
      maxMB: MAX_STORAGE_MB,
      availableMB: availableMB.toFixed(2),
      percentUsed: percentUsed.toFixed(2),
      movieCount: movies.length,
      segmentCount: usage.segmentCount
    };
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return null;
  }
};

/**
 * Schedule periodic cleanup (run on app start)
 */
export const schedulePeriodicCleanup = () => {
  // Clean up immediately
  deleteExpiredDownloads();
  cleanupOldDownloads();

  // Schedule cleanup every 24 hours
  setInterval(() => {
    deleteExpiredDownloads();
    cleanupOldDownloads();
  }, 24 * 60 * 60 * 1000);
};

/**
 * Warn if storage is getting full
 */
export const checkStorageWarning = async () => {
  try {
    const stats = await getStorageStats();
    if (stats && parseFloat(stats.percentUsed) > 80) {
      return {
        warning: true,
        message: `Storage usage is high (${stats.percentUsed}%). Consider deleting old downloads.`,
        percentUsed: parseFloat(stats.percentUsed)
      };
    }
    return { warning: false };
  } catch (error) {
    console.error('Failed to check storage:', error);
    return { warning: false };
  }
};
