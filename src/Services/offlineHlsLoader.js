import Hls from 'hls.js';
import { getSegment, getManifest } from './indexedDbService';

/**
 * Custom Hls.js loader that supports offline playback
 * Fetches segments from IndexedDB if available, otherwise from network
 */
export class OfflineHlsLoader {
  constructor(movieId, isOfflineMode = false) {
    this.movieId = movieId.toString();
    this.isOfflineMode = isOfflineMode;
  }

  async load(context, config, callbacks) {
    const { type, url } = context;

    // Only handle playlist and segment loading
    if (type !== 'playlist' && type !== 'segment') {
      return;
    }

    try {
      if (type === 'playlist') {
        // Load manifest from IndexedDB if offline
        if (this.isOfflineMode) {
          const manifestContent = await getManifest(this.movieId);
          if (manifestContent) {
            callbacks.onSuccess({
              data: new TextEncoder().encode(manifestContent),
              url: url
            }, context, null);
            return;
          }
        }
        // Fall back to network
        this._loadFromNetwork(url, callbacks, context);
      } else if (type === 'segment') {
        // Extract segment index from URL
        const segmentIndex = this._extractSegmentIndex(url);
        
        if (segmentIndex !== null) {
          // Try to load from IndexedDB first
          const segmentData = await getSegment(this.movieId, segmentIndex);
          if (segmentData) {
            callbacks.onSuccess({
              data: segmentData,
              url: url
            }, context, null);
            return;
          }
        }

        // If offline, can't load segment
        if (this.isOfflineMode) {
          callbacks.onError({
            code: 404,
            text: 'Segment not available offline'
          }, context, null);
          return;
        }

        // Fall back to network
        this._loadFromNetwork(url, callbacks, context);
      }
    } catch (error) {
      console.error('OfflineHlsLoader error:', error);
      if (this.isOfflineMode) {
        callbacks.onError({
          code: 500,
          text: error.message
        }, context, null);
      } else {
        this._loadFromNetwork(url, callbacks, context);
      }
    }
  }

  _loadFromNetwork(url, callbacks, context) {
    const xhr = new XMLHttpRequest();
    xhr.addEventListener('loadstart', this._onLoadStart.bind(this));
    xhr.addEventListener('progress', this._onProgress.bind(this, callbacks, context));
    xhr.addEventListener('load', this._onLoad.bind(this, callbacks, context, xhr));
    xhr.addEventListener('error', this._onError.bind(this, callbacks, context));
    xhr.addEventListener('abort', this._onAbort.bind(this, callbacks, context));
    xhr.addEventListener('timeout', this._onTimeout.bind(this, callbacks, context));

    xhr.open('GET', url, true);
    xhr.withCredentials = false;
    xhr.responseType = 'arraybuffer';
    xhr.timeout = 30000;
    xhr.send();
  }

  _onLoadStart() {
    // Can be used for loading indicator
  }

  _onProgress(callbacks, context, event) {
    if (event.lengthComputable) {
      const loaded = event.loaded;
      callbacks.onProgress?.({
        loaded,
        total: event.total
      }, context, null);
    }
  }

  _onLoad(callbacks, context, xhr) {
    if (xhr.status >= 400) {
      callbacks.onError({
        code: xhr.status,
        text: xhr.statusText
      }, context, null);
    } else {
      callbacks.onSuccess({
        data: xhr.response,
        url: context.url
      }, context, null);
    }
  }

  _onError(callbacks, context) {
    callbacks.onError({
      code: -1,
      text: 'Network request failed'
    }, context, null);
  }

  _onAbort(callbacks, context) {
    callbacks.onAbort?.(context, null);
  }

  _onTimeout(callbacks, context) {
    callbacks.onError({
      code: -1,
      text: 'Network request timeout'
    }, context, null);
  }

  _extractSegmentIndex(url) {
    // Parse segment index from URL
    // Typical HLS segment URLs look like: https://example.com/path/segment0.ts
    const match = url.match(/segment(\d+)/i);
    return match ? parseInt(match[1]) : null;
  }
}

/**
 * Create HLS instance with offline support
 */
export const createOfflineHlsInstance = (videoRef, movieId, isOfflineMode = false) => {
  const hls = new Hls({
    loader: OfflineHlsLoader,
    xhrSetup: function (xhr, url) {
      xhr.withCredentials = false;
    }
  });

  // Inject custom loader
  const offlineLoader = new OfflineHlsLoader(movieId, isOfflineMode);
  hls.loader = offlineLoader;

  hls.attachMedia(videoRef);
  return hls;
};
