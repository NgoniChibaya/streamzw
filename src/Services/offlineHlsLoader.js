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
    this._xhr = null;
  }

  destroy() {
    if (this._xhr) {
      try {
        this._xhr.abort();
      } catch (e) {
        console.warn('OfflineHlsLoader destroy: failed to abort XHR', e);
      }
      this._xhr = null;
    }
  }

  async load(context, config, callbacks) {
    try {
      if (!context) {
        console.error('OfflineHlsLoader: context is null');
        callbacks.onError({ code: 500, text: 'Invalid context' }, {}, null);
        return;
      }

      const { type, url } = context;
      console.log(`OfflineHlsLoader: Loading ${type} from ${url}`);

      // Handle both playlist and level types for manifest
      if (type === 'manifest' || type === 'level') {
        if (this.isOfflineMode) {
          console.log(`OfflineHlsLoader: Loading manifest from IndexedDB for movie ${this.movieId}`);
          const manifestContent = await getManifest(this.movieId);
          if (manifestContent) {
            console.log(`OfflineHlsLoader: Manifest loaded, length: ${manifestContent.length}`);
            const response = { url: url, data: manifestContent };
            const stats = { trequest: performance.now(), tfirst: performance.now(), tload: performance.now(), loaded: manifestContent.length, total: manifestContent.length, bw: 0, retry: 0 };
            callbacks.onSuccess(response, stats, context);
            return;
          } else {
            console.error(`OfflineHlsLoader: No manifest found in IndexedDB for movie ${this.movieId}`);
            callbacks.onError({ code: 404, text: 'Manifest not found' }, context);
            return;
          }
        }
        this._loadFromNetwork(url, callbacks, context);
        return;
      }

      // Handle segments
      if (type === 'fragment') {
        const segmentIndex = this._extractSegmentIndex(url);
        console.log(`OfflineHlsLoader: Loading segment ${segmentIndex}`);
        
        if (segmentIndex !== null) {
          const segmentData = await getSegment(this.movieId, segmentIndex);
          if (segmentData) {
            console.log(`OfflineHlsLoader: Segment ${segmentIndex} loaded from IndexedDB`);
            const response = { url: url, data: segmentData };
            const stats = { trequest: performance.now(), tfirst: performance.now(), tload: performance.now(), loaded: segmentData.byteLength, total: segmentData.byteLength, bw: 0, retry: 0 };
            callbacks.onSuccess(response, stats, context);
            return;
          }
        }

        if (this.isOfflineMode) {
          console.error(`OfflineHlsLoader: Segment ${segmentIndex} not found`);
          callbacks.onError({ code: 404, text: 'Segment not available offline' }, context);
          return;
        }

        this._loadFromNetwork(url, callbacks, context);
      }
    } catch (error) {
      console.error('OfflineHlsLoader load error:', error);
      callbacks.onError({ code: 500, text: error.message }, context || {}, null);
    }
  }

  _loadFromNetwork(url, callbacks, context) {
    const xhr = new XMLHttpRequest();
    this._xhr = xhr;
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
    // Clear stored XHR when load completes
    if (this._xhr === xhr) {
      this._xhr = null;
    }

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
    // Clear stored XHR on error
    this._xhr = null;
    callbacks.onError({
      code: -1,
      text: 'Network request failed'
    }, context, null);
  }

  _onAbort(callbacks, context) {
    // Clear stored XHR when request is aborted
    this._xhr = null;
    callbacks.onAbort?.(context, null);
  }

  _onTimeout(callbacks, context) {
    callbacks.onError({
      code: -1,
      text: 'Network request timeout'
    }, context, null);
  }

  _extractSegmentIndex(url) {
    // Parse segment index from URL.
    // Handles patterns like:
    //  - .../segment0.ts
    //  - .../chunk-123.ts
    //  - .../000123.ts
    //  - .../segment-123.ts?token=...
    // We pick the last digits immediately before ".ts" (ignoring query params).
    const lastSegment = url.split('/').pop();
    if (!lastSegment) return null;

    const match = lastSegment.match(/(\d+)(?=\.ts(?:\?|$))/i);
    if (match) {
      return parseInt(match[1], 10);
    }

    return null;
  }
}

/**
 * Create HLS instance with offline support
 */
export const createOfflineHlsInstance = (videoRef, movieId, isOfflineMode = false) => {
  // Create a custom loader class that captures movieId and isOfflineMode
  class ConfiguredOfflineLoader extends OfflineHlsLoader {
    constructor(config) {
      super(movieId, isOfflineMode);
      this.config = config;
    }
  }

  const hls = new Hls({
    loader: ConfiguredOfflineLoader,
    xhrSetup: function (xhr, url) {
      xhr.withCredentials = false;
    }
  });

  hls.attachMedia(videoRef);
  return hls;
};
