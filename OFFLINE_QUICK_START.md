# Offline Download Feature - Quick Start Guide

## What Was Implemented

A complete offline video download system similar to YouTube, allowing users to:
- Download movies for offline viewing
- Manage downloaded videos
- Store up to 5GB of content
- Auto-cleanup old/expired downloads
- Play videos offline with HLS support

## How to Use

### 1. Enable Service Worker (IMPORTANT)

The Service Worker must be running for offline support. It's already registered in `src/index.jsx`.

Make sure your backend serves the Service Worker at `/public/serviceWorker.js`

### 2. User Download Flow

**On Movie Page:**
1. Navigate to any movie's Play page
2. Look for the blue "Download" button (next to Like button)
3. Click it to see quality options (Auto, 1080p, 720p, 480p)
4. Select quality
5. Download progress modal appears
6. Once complete, button shows "Downloaded"

**Access Downloads:**
1. Click on your profile menu
2. Go to "Downloads" (new menu item)
3. See all downloaded videos
4. See storage usage (e.g., "2.5 MB / 5000 MB")
5. Click Play to watch offline
6. Click Delete to remove

### 3. Offline Playback

- When offline, internet indicator shows at top
- Downloaded videos play seamlessly offline
- Non-downloaded videos show error message
- Quality automatically adjusts based on available connection

## Files Overview

### Services (Handle Data & Logic)
- `indexedDbService.js` - Local storage management
- `downloadService.js` - Download orchestration
- `offlineHlsLoader.js` - Video playback offline
- `storageCleanup.js` - Storage management

### Components (UI)
- `DownloadButton.jsx` - Button with quality selector
- `DownloadProgress.jsx` - Download status modal
- `Downloads.jsx` - Full downloads management page

### Hooks (Reusable Logic)
- `useNetworkStatus.jsx` - Detect online/offline status
- `useOfflineDownload.jsx` - Manage download state

### Other
- `serviceWorker.js` - Offline app functionality

## Key Features

### ✅ Download Management
- Download with quality selection
- Show progress with ETA
- Pause/Resume (structure ready)
- Batch delete

### ✅ Storage Management
- Track storage usage (5GB max)
- Auto-cleanup when full
- Delete expired (30-day) downloads
- Storage stats on download page

### ✅ Offline Playback
- Play any downloaded video offline
- Fast loading from IndexedDB
- Fall back to network if available
- HLS quality switching

### ✅ User Experience
- Shows offline indicator
- Download button on play page
- Dedicated downloads page
- Progress with segments info
- Download metadata (quality, date)

## Configuration

### Change Storage Limit
`src/Services/downloadService.js`:
```javascript
const MAX_STORAGE_MB = 5000; // Change this
```

### Change Expiry Duration
`src/Services/storageCleanup.js`:
```javascript
const EXPIRY_DAYS = 30; // Change this
```

### Change Available Qualities
`src/componets/Download/DownloadButton.jsx`:
```javascript
<button onClick={() => handleDownload('720')}>720p</button>
// Add/remove quality buttons
```

## Testing

### Test Download
1. Go to any movie
2. Click Download button
3. Select quality
4. Watch progress
5. Close browser and reopen
6. Click "Browse Downloads"
7. Downloaded video should be there

### Test Offline Playback
1. Download a video
2. Open DevTools (F12)
3. Go to Network tab
4. Filter to "Offline"
5. Go to downloaded video
6. Click Play
7. Should play without network

### Test Storage Cleanup
1. Download multiple videos
2. Check `/downloads` page
3. See storage usage
4. Delete videos
5. Storage usage decreases
6. When > 5GB, oldest auto-deletes

## API Integration

The download system works with your current stack:
- Django backend for video URLs
- S3 for video storage
- Firebase for user data
- HLS for video streaming

No changes needed to existing API.

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| HLS.js | ✅ | ✅ | ✅ | ✅ |
| Network API | ✅ | ✅ | ⚠️ | ✅ |

## Common Issues

### "Download Failed"
- Check available storage
- Check internet connection
- Check browser supports IndexedDB
- Check S3 URL is accessible

### "Video Not Playing Offline"
- Verify video fully downloaded
- Check Service Worker is registered
- Clear browser cache
- Check browser supports HLS

### "Storage Full"
- Delete old downloads
- Check `/downloads` page
- Increase MAX_STORAGE_MB setting
- Clear IndexedDB manually

## Next Steps

1. Test on different devices/browsers
2. Monitor download speeds
3. Adjust storage limits based on usage
4. Add background download capability
5. Add download scheduling
6. Sync downloads across devices

## Support

For issues:
1. Check browser console (F12)
2. Check IndexedDB contents (DevTools > Application > IndexedDB)
3. Check Service Worker status (DevTools > Application > Service Workers)
4. Review logs in OFFLINE_FEATURE_README.md

## Files to Remember

- **Play page**: `src/Pages/Play.jsx` - Has download button
- **Downloads page**: `src/Pages/Downloads.jsx` - Full management
- **Main entry**: `src/index.jsx` - Service Worker registration
- **Routes**: `src/App.jsx` - Added `/downloads` route

## That's It!

The offline feature is now fully integrated and ready to use. Users can:
✅ Download videos
✅ Manage downloads
✅ Play offline
✅ Auto-cleanup
✅ Check storage

Happy streaming! 🎬
