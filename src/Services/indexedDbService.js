// IndexedDB Service for offline video storage
const DB_NAME = 'ZimStreama';
const DB_VERSION = 1;

const STORES = {
  MOVIES: 'downloaded_movies',
  SEGMENTS: 'video_segments',
  MANIFESTS: 'm3u8_manifests'
};

let db = null;

const initDB = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB initialization failed');
      reject(request.error);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Create stores
      if (!database.objectStoreNames.contains(STORES.MOVIES)) {
        database.createObjectStore(STORES.MOVIES, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(STORES.SEGMENTS)) {
        const segmentStore = database.createObjectStore(STORES.SEGMENTS, { 
          keyPath: 'key' 
        });
        segmentStore.createIndex('movieId', 'movieId', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.MANIFESTS)) {
        database.createObjectStore(STORES.MANIFESTS, { keyPath: 'movieId' });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
  });
};

// Movie operations
export const saveMovie = async (movieData) => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.MOVIES], 'readwrite');
    const store = transaction.objectStore(STORES.MOVIES);
    const request = store.put(movieData);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const getMovie = async (movieId) => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.MOVIES], 'readonly');
    const store = transaction.objectStore(STORES.MOVIES);
    const request = store.get(movieId.toString());

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const getAllMovies = async () => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.MOVIES], 'readonly');
    const store = transaction.objectStore(STORES.MOVIES);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const deleteMovie = async (movieId) => {
  const database = await initDB();
  const movieIdStr = movieId.toString();

  // Delete movie record
  await new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.MOVIES], 'readwrite');
    const store = transaction.objectStore(STORES.MOVIES);
    const request = store.delete(movieIdStr);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Delete all segments
  await new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SEGMENTS], 'readwrite');
    const store = transaction.objectStore(STORES.SEGMENTS);
    const index = store.index('movieId');
    const request = index.openCursor(movieIdStr);

    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
  });

  // Delete manifest
  await new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.MANIFESTS], 'readwrite');
    const store = transaction.objectStore(STORES.MANIFESTS);
    const request = store.delete(movieIdStr);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// Segment operations
export const saveSegment = async (movieId, segmentIndex, data) => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SEGMENTS], 'readwrite');
    const store = transaction.objectStore(STORES.SEGMENTS);
    
    const segmentKey = `${movieId}_segment_${segmentIndex}`;
    const request = store.put({
      key: segmentKey,
      movieId: movieId.toString(),
      segmentIndex,
      data,
      size: data.byteLength,
      timestamp: Date.now()
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const getSegment = async (movieId, segmentIndex) => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SEGMENTS], 'readonly');
    const store = transaction.objectStore(STORES.SEGMENTS);
    
    const segmentKey = `${movieId}_segment_${segmentIndex}`;
    const request = store.get(segmentKey);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.data : null);
    };
  });
};

export const getMovieSegments = async (movieId) => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SEGMENTS], 'readonly');
    const store = transaction.objectStore(STORES.SEGMENTS);
    const index = store.index('movieId');
    const request = index.getAll(movieId.toString());

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// Manifest operations
export const saveManifest = async (movieId, manifestContent) => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.MANIFESTS], 'readwrite');
    const store = transaction.objectStore(STORES.MANIFESTS);
    
    const request = store.put({
      movieId: movieId.toString(),
      content: manifestContent,
      timestamp: Date.now()
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const getManifest = async (movieId) => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.MANIFESTS], 'readonly');
    const store = transaction.objectStore(STORES.MANIFESTS);
    const request = store.get(movieId.toString());

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.content : null);
    };
  });
};

// Get total storage usage
export const getStorageUsage = async () => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SEGMENTS], 'readonly');
    const store = transaction.objectStore(STORES.SEGMENTS);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const segments = request.result;
      const totalBytes = segments.reduce((sum, seg) => sum + seg.size, 0);
      resolve({
        totalBytes,
        totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
        segmentCount: segments.length
      });
    };
  });
};

// Clear all data
export const clearAllData = async () => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.MOVIES, STORES.SEGMENTS, STORES.MANIFESTS],
      'readwrite'
    );

    const promises = [STORES.MOVIES, STORES.SEGMENTS, STORES.MANIFESTS].map(
      (storeName) => {
        return new Promise((res, rej) => {
          const request = transaction.objectStore(storeName).clear();
          request.onerror = () => rej(request.error);
          request.onsuccess = () => res();
        });
      }
    );

    Promise.all(promises).then(resolve).catch(reject);
  });
};
