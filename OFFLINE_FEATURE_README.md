# Offline Video Download Feature - Implementation Guide

## Overview
This implementation adds offline video download capability to your Netflix-style streaming app, allowing users to download movies for offline viewing, similar to YouTube's offline feature.

## Architecture

### Core Components

#### 1. **IndexedDB Service** (`src/Services/indexedDbService.js`)
- Manages local storage of videos using IndexedDB
- Three stores:
  - `downloaded_movies`: Stores movie metadata
  - `video_segments`: Stores HLS video segments
  - `m3u8_manifests`: Stores playlist manifests

**Key Functions:**
- `saveMovie()`, `getMovie()`, `getAllMovies()`, `deleteMovie()`
- `saveSegment()`, `getSegment()`, `getMovieSegments()`
- `saveManifest()`, `getManifest()`
- `getStorageUsage()` - Returns total storage used
- `clearAllData()` - Removes all offline data

#### 2. **Download Service** (`src/Services/downloadService.js`)
- Orchestrates the download process
- Fetches HLS manifests and video segments
- Manages download queue and progress

**Key Functions:**
- `initializeDownload(movieId, movieDetails, quality)` - Starts download
- `downloadSegments(movieId, manifestUrl, selectedLevel)` - Downloads all segments
- `checkIfDownloaded(movieId)` - Checks if movie is cached
- `getDownloadProgress(movieId)` - Returns download progress
- `pauseDownload()`, `resumeDownload()`

#### 3. **Offline HLS Loader** (`src/Services/offlineHlsLoader.js`)
- Custom HLS.js loader for offline playback
- Attempts to load segments from IndexedDB first
- Falls back to network if segment not available

**Key Class:**
- `OfflineHlsLoader` - Custom loader implementation

#### 4. **Service Worker** (`public/serviceWorker.js`)
- Enables offline functionality at app level
- Caches API responses and static assets
- Uses network-first strategy for API calls
- Uses cache-first strategy for static content

#### 5. **Storage Cleanup** (`src/Services/storageCleanup.js`)
- Manages storage quota (5GB default)
- Deletes expired downloads (30 days)
- Cleans old downloads when storage exceeds 90%

**Key Functions:**
- `cleanupOldDownloads()` - Removes old downloads
- `deleteExpiredDownloads()` - Removes expired downloads
- `getStorageStats()` - Returns storage info
- `checkStorageWarning()` - Warns if storage > 80%
- `schedulePeriodicCleanup()` - Runs cleanup every 24 hours

### UI Components

#### 1. **DownloadButton** (`src/componets/Download/DownloadButton.jsx`)
- Quality selector dropdown
- Shows download status (Downloaded/Downloading)
- Allows users to initiate downloads

**Props:**
- `movieDetails` - Movie data
- `movieId` - Movie ID
- `isDownloaded` - Download status
- `onDownloadStart` - Callback when download starts

#### 2. **DownloadProgress** (`src/componets/Download/DownloadProgress.jsx`)
- Modal showing download progress
- Displays segments downloaded and ETA
- Allows pause/resume/cancel

#### 3. **Downloads Page** (`src/Pages/Downloads.jsx`)
- Browse all downloaded videos
- Manage storage (view usage, delete downloads)
- Batch operations (select multiple, delete all)
- Shows download metadata (quality, date, size)

### Custom Hooks

#### 1. **useNetworkStatus** (`src/CustomHooks/useNetworkStatus.jsx`)
- Tracks online/offline status
- Detects network speed (4g, 3g, 2g, slow-2g)

#### 2. **useOfflineDownload** (`src/CustomHooks/useOfflineDownload.jsx`)
- Manages download state for a movie
- Provides functions to check/initiate downloads

## Integration in Play Page

The Play.jsx page has been enhanced with:

1. **Network Status Indicator** - Shows when offline
2. **Download Button** - Appears next to My List button
3. **Download Progress Modal** - Shows when downloading
4. **Offline Detection** - Service Worker handles offline playback

## Usage Flow

### Downloading a Video

1. User navigates to Play page
2. Clicks "Download" button
3. Selects quality (Auto, 1080p, 720p, 480p)
4. Download progress modal appears
5. Segments are downloaded to IndexedDB
6. Once complete, video is playable offline

### Playing Offline

1. User loses internet connection
2. App shows offline indicator
3. If video is downloaded, HLS loader serves from IndexedDB
4. If not downloaded, playback fails gracefully

### Managing Downloads

1. Navigate to `/downloads` page
2. View all downloaded videos
3. See storage usage (e.g., 2.5GB / 5GB)
4. Delete individual videos or batch delete
5. Storage auto-cleans old downloads when full

## Configuration

### Storage Limits
Edit `downloadService.js` and `storageCleanup.js`:
```javascript
const MAX_STORAGE_MB = 5000; // 5GB
const EXPIRY_DAYS = 30;      // 30-day expiry
```

### Quality Options
Edit `DownloadButton.jsx` to customize available qualities:
```javascript
<button onClick={() => handleDownload('1080')}>1080p</button>
<button onClick={() => handleDownload('720')}>720p</button>
<button onClick={() => handleDownload('480')}>480p</button>
```

## Browser Requirements

- **IndexedDB Support** - All modern browsers
- **Service Worker Support** - All modern browsers
- **HLS Support** - Chrome, Firefox, Edge, Safari
- **Minimum Storage** - 5GB available disk space recommended

## Technical Details

### HLS Segmentation
- Videos are stored as segments (.ts files)
- Each segment typically 512KB
- Segments stored in IndexedDB with movie ID and index
- Manifest file (.m3u8) stored for offline reference

### Storage Management
- IndexedDB quota: ~50% of available disk
- Default max: 5GB (configurable)
- Automatic cleanup when 90% full
- 30-day expiry (configurable)

### Network Detection
- Uses `navigator.onLine` API
- Listens to `online`/`offline` events
- Detects network speed via Network Information API

## Files Created/Modified

### New Files
```
src/Services/
├── indexedDbService.js
├── downloadService.js
├── offlineHlsLoader.js
└── storageCleanup.js

src/componets/Download/
├── DownloadButton.jsx
└── DownloadProgress.jsx

src/Pages/
└── Downloads.jsx

src/CustomHooks/
├── useNetworkStatus.jsx
└── useOfflineDownload.jsx

public/
└── serviceWorker.js
```

### Modified Files
```
src/Pages/Play.jsx
src/App.jsx
src/index.jsx
```

## Future Enhancements

1. **Smart Download** - Auto-download on WiFi
2. **Download Resumption** - Resume interrupted downloads
3. **Background Download** - Continue downloading in background
4. **Download Scheduling** - Schedule downloads for specific times
5. **Multiple Quality Versions** - Allow downloading same video in multiple qualities
6. **Sync Across Devices** - Sync downloads to Firebase per user
7. **Bandwidth Limiting** - Control download speed
8. **Download Recommendations** - Suggest popular videos to download

## Troubleshooting

### Downloads Not Working
1. Check IndexedDB quota available
2. Verify browser supports IndexedDB
3. Check console for errors
4. Clear cache and retry

### Offline Playback Issues
1. Verify video was fully downloaded
2. Check Service Worker is registered
3. Ensure HLS loader is properly initialized
4. Check browser supports HLS

### Storage Issues
1. Check `/downloads` page for storage usage
2. Delete old videos to free space
3. Adjust MAX_STORAGE_MB setting
4. Check disk space available

## Security Considerations

1. Videos stored locally on device
2. No encryption at rest (can be added)
3. Each user has separate storage
4. No cross-origin issues with S3 URLs
5. Service Worker handles CORS properly

## Performance Notes

- Segment size: ~512KB (configurable)
- Average download: 2-5 hours for 2GB video on 4G
- Offline playback: Native HLS.js handling
- Storage cleanup: Runs every 24 hours

## Support & Maintenance

- Monitor IndexedDB quota
- Review storage usage regularly
- Update HLS.js if needed
- Test on various network speeds
- Monitor Service Worker logs
