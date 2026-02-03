# Setup & Deployment Guide

## Prerequisites

- Node.js 14+
- Modern browser (Chrome, Firefox, Safari, Edge)
- HTTPS enabled (Service Worker requires it in production)
- 5GB+ available disk space

## Installation

All files are already created. No additional packages needed beyond what you have.

## Verification Checklist

Run through these steps to verify everything is working:

### 1. Check Files Exist

```bash
# Core services
- src/Services/indexedDbService.js
- src/Services/downloadService.js
- src/Services/offlineHlsLoader.js
- src/Services/storageCleanup.js

# Components
- src/componets/Download/DownloadButton.jsx
- src/componets/Download/DownloadProgress.jsx
- src/Pages/Downloads.jsx

# Hooks
- src/CustomHooks/useNetworkStatus.jsx
- src/CustomHooks/useOfflineDownload.jsx

# Service Worker
- public/serviceWorker.js

# Documentation
- OFFLINE_FEATURE_README.md
- OFFLINE_QUICK_START.md
- IMPLEMENTATION_SUMMARY.md
```

### 2. Check Modified Files

Verify these files have been updated:
```bash
- src/index.jsx (Service Worker registration)
- src/App.jsx (Added Downloads route)
- src/Pages/Play.jsx (Download button integration)
```

### 3. Verify Service Worker Registration

In browser DevTools:
1. Open DevTools (F12)
2. Go to Application tab
3. Check "Service Workers" section
4. Should see `serviceWorker.js` as "activated and running"

If not active:
- Check browser console for errors
- Verify public/serviceWorker.js is served correctly
- Check HTTPS is enabled (required in production)
- Hard refresh (Ctrl+Shift+R)

### 4. Check IndexedDB Setup

In browser DevTools:
1. Go to Application tab
2. Expand "IndexedDB"
3. After first download, should see "ZimStreama" database
4. Inside: `downloaded_movies`, `video_segments`, `m3u8_manifests` stores

### 5. Test Download Feature

1. Navigate to any movie
2. Click "Play" to go to movie page
3. Look for blue "Download" button next to Like button
4. Click it
5. Select quality (e.g., "720p")
6. Verify download progress modal appears
7. Wait for completion (can be quick if you cancel it)

### 6. Test Downloads Page

1. Go to downloads page (`/downloads`)
2. Should show downloaded videos
3. Should show storage usage
4. Can delete and batch operations should work

### 7. Test Offline Mode

1. Download a video
2. Open DevTools (F12)
3. Go to Network tab
4. Click "Offline" checkbox (at top)
5. Navigate to downloaded video
6. Try to play
7. Should play without network

## Common Setup Issues

### Issue: Service Worker Not Registering

**Symptoms:**
- DevTools shows no Service Worker
- Network offline doesn't work

**Solutions:**
1. Check if using HTTPS (required)
2. Check public/serviceWorker.js exists
3. Check browser supports Service Workers
4. Hard refresh browser (Ctrl+Shift+R)
5. Check browser console for errors

### Issue: Downloads Not Appearing in IndexedDB

**Symptoms:**
- Click download but nothing happens
- No progress modal

**Solutions:**
1. Check browser supports IndexedDB
2. Verify storage quota available
3. Check browser console for errors
4. Try in incognito mode
5. Clear browser cache and retry

### Issue: Video Won't Play Offline

**Symptoms:**
- Downloaded video but shows error offline
- Only works online

**Solutions:**
1. Verify video fully downloaded (100%)
2. Check Service Worker is active
3. Verify HLS manifest was saved
4. Try different browser
5. Check browser console logs

### Issue: Storage Shows Wrong Usage

**Symptoms:**
- Storage bar doesn't update
- Shows 0MB used

**Solutions:**
1. Download a video to populate
2. Hard refresh page
3. Clear IndexedDB manually (DevTools > Storage > Delete)
4. Try on different browser
5. Check console for errors

## Configuration for Different Scenarios

### For Testing (Smaller Storage)

Edit `src/Services/downloadService.js`:
```javascript
const MAX_STORAGE_MB = 500; // 500MB for testing
```

Edit `src/Services/storageCleanup.js`:
```javascript
const EXPIRY_DAYS = 3; // 3 days for testing
```

### For Production (Larger Storage)

Edit `src/Services/downloadService.js`:
```javascript
const MAX_STORAGE_MB = 10000; // 10GB for production
```

Edit `src/Services/storageCleanup.js`:
```javascript
const EXPIRY_DAYS = 60; // 60 days for production
```

### For Slow Networks

Edit `src/Services/downloadService.js`:
```javascript
const SEGMENT_CHUNK_SIZE = 256000; // 256KB smaller chunks
```

### For Fast Networks

Edit `src/Services/downloadService.js`:
```javascript
const SEGMENT_CHUNK_SIZE = 1048576; // 1MB larger chunks
```

## Performance Optimization

### Reduce Memory Usage
```javascript
// In downloadService.js - reduce chunk size
const SEGMENT_CHUNK_SIZE = 256000;
```

### Faster Downloads
```javascript
// In downloadService.js - increase chunk size
const SEGMENT_CHUNK_SIZE = 2097152; // 2MB
```

### Auto-Delete Old Videos
Already implemented - runs every 24 hours

### Reduce Storage Usage
- Adjust MAX_STORAGE_MB lower
- Adjust EXPIRY_DAYS shorter

## Debugging

### Enable Logging

Add to `src/Services/downloadService.js`:
```javascript
console.log('Download started:', movieId);
console.log('Progress:', progress);
console.log('Download complete:', movieId);
```

### Monitor Storage

In browser console:
```javascript
// Check IndexedDB
const db = await indexedDB.databases();
console.log('Databases:', db);

// Check storage usage
const stats = await getStorageStats();
console.log('Storage:', stats);
```

### Check Service Worker

In browser console:
```javascript
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(r => console.log('SW:', r));
});
```

### Monitor Network

DevTools > Network tab:
- Filter by "Fetch/XHR" to see API calls
- Filter by "Offline" to test offline mode
- Check request/response headers

## Deployment Steps

### 1. Development Testing
```bash
npm run dev
# Test all features locally
```

### 2. Build for Production
```bash
npm run build
# Creates dist/ folder
```

### 3. Deploy to Server
- Copy dist/ contents to web server
- Ensure HTTPS is enabled
- Verify public/serviceWorker.js is served
- Test all features again

### 4. Verify Deployment
1. Open app in browser
2. Check Service Worker (DevTools > Application)
3. Test download feature
4. Test offline mode
5. Test storage management

## Monitoring in Production

### Track Errors
Add to your error tracking (Sentry, LogRocket, etc.):
```javascript
try {
  await downloadSegments(...);
} catch (error) {
  errorTracking.captureException(error);
}
```

### Monitor Storage Usage
```javascript
// Periodic check
setInterval(async () => {
  const stats = await getStorageStats();
  analytics.track('storage_usage', stats);
}, 60000);
```

### Track Downloads
```javascript
const analytics = {
  trackDownload: (movieId, quality) => {
    // Send to analytics
  },
  trackPlay: (movieId, offline) => {
    // Send to analytics
  }
};
```

## Troubleshooting Guide

| Issue | Cause | Solution |
|-------|-------|----------|
| Service Worker not registering | HTTP instead of HTTPS | Use HTTPS in production |
| Downloads not saving | IndexedDB quota full | Delete old downloads |
| Offline playback fails | Video not fully downloaded | Re-download video |
| Storage shows wrong usage | Cache not updated | Hard refresh (Ctrl+Shift+R) |
| Download very slow | Network speed | Check connection or reduce chunk size |
| Can't download video | Video not available | Check S3 URL is valid |
| Download stuck | Network interruption | Network dialog will handle retry |
| App slow offline | Too many videos cached | Delete old videos |

## Browser-Specific Notes

### Chrome
- Best support for offline feature
- IndexedDB: ~50% of available disk
- Service Worker: Full support
- HLS: Good support

### Firefox
- Full offline support
- IndexedDB: ~50% of available disk
- Service Worker: Full support
- HLS: Good support

### Safari
- Offline support available
- IndexedDB: ~50% of available disk
- Service Worker: Full support
- HLS: Native support (excellent)

### Edge
- Full offline support
- Similar to Chrome
- IndexedDB: ~50% of available disk

## Security Best Practices

1. Always use HTTPS
2. Validate video URLs
3. Check user authentication
4. Sanitize file paths
5. Monitor storage usage
6. Log download activities
7. Consider encryption
8. Update dependencies regularly

## Support Resources

1. **Browser DevTools** - F12 to open
   - Application tab: Service Workers, IndexedDB
   - Network tab: Monitor downloads
   - Console: Error messages

2. **Documentation Files**
   - OFFLINE_QUICK_START.md - User guide
   - OFFLINE_FEATURE_README.md - Technical details
   - IMPLEMENTATION_SUMMARY.md - Overview

3. **Online Resources**
   - MDN: Service Workers, IndexedDB
   - HLS.js documentation
   - Network Information API docs

## Next Steps

1. ✅ Verify installation
2. ✅ Test all features
3. ✅ Configure for your use case
4. ✅ Deploy to staging
5. ✅ Test in production
6. ✅ Monitor and optimize
7. Consider enhancements (see README)

## That's It!

Your offline download feature is now set up and ready. Follow the troubleshooting guide if you encounter any issues.

Good luck! 🚀
