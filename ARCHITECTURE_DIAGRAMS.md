# Architecture & Flow Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ZimStreama App                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Play.jsx (Movie Page)                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │  │
│  │  │ Video Player │  │Download Btn  │  │Like/MyList │ │  │
│  │  │   (HLS.js)   │  │(Quality Menu)│  │   Buttons  │ │  │
│  │  └──────────────┘  └──────────────┘  └────────────┘ │  │
│  │         ↓                  ↓                          │  │
│  │   offlineHlsLoader    DownloadButton                 │  │
│  │         ↓                  ↓                          │  │
│  │   Service Worker      downloadService                │  │
│  └──────────────────────────────────────────────────────┘  │
│                        ↓              ↓                     │
│  ┌────────────────┐  ┌──────────────────────────────────┐  │
│  │ Downloads Page │  │ DownloadProgress Modal           │  │
│  │ (Manage videos)│  │ (Show progress & ETA)            │  │
│  └────────────────┘  └──────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓                                          ↓
┌─────────────────────────────────┐   ┌──────────────────────┐
│    Local Storage Layer          │   │  Network/API         │
│  (IndexedDB)                    │   │                      │
│                                 │   │  ┌────────────────┐  │
│  ┌──────────────────────────┐   │   │  │ Django Backend │  │
│  │ ZimStreama Database      │   │   │  │ (/videos API)  │  │
│  │                          │   │   │  └────────────────┘  │
│  │ Stores:                  │   │   │                      │
│  │ • downloaded_movies      │   │   │  ┌────────────────┐  │
│  │ • video_segments         │   │   │  │ AWS S3         │  │
│  │ • m3u8_manifests         │   │   │  │ (HLS Videos)   │  │
│  │                          │   │   │  └────────────────┘  │
│  │ Max: 5GB (configurable)  │   │   │                      │
│  │                          │   │   │  ┌────────────────┐  │
│  │ Auto-cleanup:            │   │   │  │ TMDB API       │  │
│  │ • When > 90% full        │   │   │  │ (Movie details)│  │
│  │ • After 30 days expired  │   │   │  └────────────────┘  │
│  └──────────────────────────┘   │   │                      │
└─────────────────────────────────┘   └──────────────────────┘
```

## Download Flow Diagram

```
User Clicks Download Button
         ↓
    ┌─────────────────────────────┐
    │ DownloadButton Component    │
    │ Shows Quality Menu:         │
    │ • Auto                      │
    │ • 1080p                     │
    │ • 720p                      │
    │ • 480p                      │
    └─────────────────────────────┘
         ↓ (User selects quality)
    ┌─────────────────────────────┐
    │ initializeDownload()        │
    │ • Fetch video URL           │
    │ • Get HLS manifest          │
    │ • Select quality level      │
    │ • Save movie metadata       │
    └─────────────────────────────┘
         ↓
    ┌─────────────────────────────┐
    │ DownloadProgress Modal      │
    │ Shows:                      │
    │ • Progress bar (%)          │
    │ • Segments info             │
    │ • ETA                       │
    │ • Download speed            │
    └─────────────────────────────┘
         ↓
    ┌─────────────────────────────┐
    │ downloadSegments()          │
    │ For each segment:           │
    │ • Fetch from S3             │
    │ • Save to IndexedDB         │
    │ • Update progress           │
    └─────────────────────────────┘
         ↓
    ┌─────────────────────────────┐
    │ Save to IndexedDB           │
    │ • Movie record              │
    │ • All segments              │
    │ • M3U8 manifest             │
    └─────────────────────────────┘
         ↓
    ┌─────────────────────────────┐
    │ Download Complete!          │
    │ Button shows "Downloaded"   │
    │ Video available offline     │
    └─────────────────────────────┘
```

## Offline Playback Flow Diagram

```
User Clicks Play (Offline)
         ↓
    ┌──────────────────────────┐
    │ useNetworkStatus Hook    │
    │ Checks if online         │
    └──────────────────────────┘
         ↓
    ┌──────────────────────────┐
    │ HLS.js Video Player      │
    │ Loads source (S3 URL)    │
    └──────────────────────────┘
         ↓
    ┌──────────────────────────┐
    │ OfflineHlsLoader         │
    │ Custom loader           │
    └──────────────────────────┘
         ├─ Segment needed?
         │  ↓
         │ Check IndexedDB
         │  ↓
         ├─ Found in DB?
         │  │
         │  ├─ YES: Return segment
         │  │     ↓
         │  │  Play from local storage
         │  │
         │  └─ NO: Fetch from S3
         │      (if online)
         │
         └─ Offline? No internet
            ↓
         Show error if segment
         not available
```

## Data Flow: Download → Storage → Playback

```
┌────────────────────────────────────────────────────────────────┐
│                    DOWNLOAD PROCESS                            │
│                                                                │
│  S3 Bucket          Download Service       IndexedDB          │
│  ┌──────────────┐   ┌──────────────────┐  ┌─────────────┐    │
│  │ segment0.ts  │   │                  │  │ downloaded_ │    │
│  │ segment1.ts  │───→ Fetch segments  ──→ │ movies      │    │
│  │ segment2.ts  │   │                  │  │ video_      │    │
│  │ manifest.m3u8│───→ Save manifest    ──→ │ segments    │    │
│  │ ...          │   │                  │  │ m3u8_       │    │
│  └──────────────┘   │ Track progress  │  │ manifests  │    │
│                    │                  │  └─────────────┘    │
│                    │ Auto-cleanup    │                       │
│                    └──────────────────┘                       │
└────────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────────┐
│                    OFFLINE STORAGE                             │
│                                                                │
│  IndexedDB (5GB)                                               │
│  ┌────────────────────────────────────────────────────┐       │
│  │ Movie_1                                            │       │
│  │ ├─ metadata: title, quality, date, size           │       │
│  │ ├─ segments: segment_0_data, segment_1_data...    │       │
│  │ └─ manifest: m3u8 content                         │       │
│  │                                                    │       │
│  │ Movie_2                                            │       │
│  │ ├─ metadata: title, quality, date, size           │       │
│  │ ├─ segments: segment_0_data, segment_1_data...    │       │
│  │ └─ manifest: m3u8 content                         │       │
│  │                                                    │       │
│  │ ... (auto-cleanup when >5GB or >30 days)          │       │
│  └────────────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────────┐
│                    PLAYBACK PROCESS                            │
│                                                                │
│  HLS.js Player          OfflineHlsLoader        IndexedDB      │
│  ┌──────────────────┐   ┌────────────────────┐ ┌───────────┐  │
│  │ Load manifest    │───→ Check IndexedDB    │ │ segments  │  │
│  │                  │   │                    │ │ found!    │  │
│  │ Request          │   │ For each segment:  │ │           │  │
│  │ segment 0        │───→ • Query IndexedDB  │ │ Return    │  │
│  │                  │   │ • If exists,       │ │ segment   │  │
│  │ Request          │   │   return it        │ └───────────┘  │
│  │ segment 1        │───→ • If not, fetch    │                │
│  │                  │   │   from S3          │                │
│  │ Decode & play    │   │                    │                │
│  │                  │   │ Offline fallback   │                │
│  │                  │   │ if no network      │                │
│  └──────────────────┘   └────────────────────┘                │
└────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
Play.jsx
├── Navbar
├── DownloadButton
│   └── Quality Menu
│       ├── Auto
│       ├── 1080p
│       ├── 720p
│       └── 480p
├── DownloadProgress (Modal)
│   ├── Progress Bar
│   ├── Segment Counter
│   ├── ETA Display
│   └── Action Buttons
├── Video Player
│   ├── HLS.js
│   ├── OfflineHlsLoader
│   └── Custom Controls
├── Movie Details
│   ├── Title
│   ├── Description
│   ├── Ratings
│   ├── My List Button
│   └── Like Button
├── Similar Movies
│   └── Movie Cards
└── Footer

Downloads.jsx
├── Navbar
├── Storage Usage Bar
├── Action Buttons
│   ├── Select All
│   └── Delete Selected
├── Movie Grid
│   ├── Thumbnail
│   ├── Overlay
│   ├── Metadata
│   ├── Play Button
│   └── Delete Button
└── Footer
```

## Service Worker Communication

```
┌─────────────────────────────────────┐
│      Web App (Main Thread)          │
├─────────────────────────────────────┤
│                                     │
│  1. Register Service Worker        │
│     await register('sw.js')         │
│                                     │
│  2. Send Message to SW             │
│     postMessage({ type: 'SKIP' })  │
│                                     │
│  3. Receive Messages from SW       │
│     onmessage = (e) => {}          │
│                                     │
└─────────────────────────────────────┘
            ↕ (postMessage)
┌─────────────────────────────────────┐
│    Service Worker (Background)      │
├─────────────────────────────────────┤
│                                     │
│  1. Install Event                  │
│     Cache static assets            │
│                                     │
│  2. Activate Event                 │
│     Cleanup old caches             │
│                                     │
│  3. Fetch Event                    │
│     Intercept network requests     │
│     Apply caching strategy         │
│                                     │
│  4. Message Event                  │
│     Receive commands from app      │
│                                     │
└─────────────────────────────────────┘
            ↕ (fetch/cache)
┌─────────────────────────────────────┐
│        Browser Cache                │
├─────────────────────────────────────┤
│ • API responses                    │
│ • Static assets (HTML, CSS, JS)   │
│ • Network fallbacks                │
└─────────────────────────────────────┘
```

## State Management Flow

```
Play Component State
├── Video State
│   ├── videoUrl
│   ├── videoError
│   ├── isPlaying
│   ├── currentTime
│   ├── duration
│   └── volume
│
├── Download State
│   ├── isDownloaded
│   ├── showDownloadProgress
│   ├── downloadStatus
│   └── downloadData
│
├── UI State
│   ├── showControls
│   ├── isFullscreen
│   ├── showQualityMenu
│   └── qualityLevels
│
└── Movie Data
    ├── movieDetails
    ├── similarMovies
    ├── savedProgress
    └── showContinuePrompt

Downloads Component State
├── downloadedMovies
├── loading
├── storageUsage
├── selectedMovies
└── selectedMovies operations
    ├── selectAll()
    ├── toggleSelect()
    └── deleteSelected()
```

## Error Handling Flow

```
User Action
    ↓
Try {
    ├─ Download starts
    ├─ Network request
    ├─ Save to IndexedDB
    ├─ Update progress
    └─ Mark complete
}
Catch (error) {
    ├─ Set error state
    ├─ Show error message
    ├─ Log to console
    └─ Suggest action
}
    ↓
Error States:
├─ Network Error → "Check internet"
├─ Storage Full → "Delete old videos"
├─ Invalid Quality → "Select valid quality"
├─ Corrupted Segment → "Re-download video"
└─ IndexedDB Error → "Check storage quota"
```

## Summary

This architecture provides:
- ✅ Clean separation of concerns
- ✅ Modular components
- ✅ Efficient data flow
- ✅ Robust error handling
- ✅ Scalable storage
- ✅ Offline-first approach
- ✅ User-friendly interface

All working together to provide a seamless offline video experience!
