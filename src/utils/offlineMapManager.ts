/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const CACHE_NAME = 'taxi-tera-cache-v8';

const getSanitizedCartoKey = (): string => {
  const key = (import.meta.env.VITE_CARTO_API_KEY as string) || '';
  if (key && !key.includes('YOUR_KEY') && !key.includes('http') && key.trim().length > 5) {
    return key.trim();
  }
  return 'cb1_3tnb_1_2da65b7a79e52dc561858c69';
};

export const CARTO_KEY = getSanitizedCartoKey();

// Geographic boundary of Addis Ababa Metro Area
export const ADDIS_BOUNDS = {
  north: 9.12,
  south: 8.82,
  west: 38.62,
  east: 38.90,
};

export function lon2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

export function lat2tile(lat: number, zoom: number): number {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

export interface TileCoord {
  z: number;
  x: number;
  y: number;
  url: string;
}

export interface DownloadProgress {
  total: number;
  completed: number;
  failed: number;
  percent: number;
  currentZoom: number;
  estimatedBytes: number;
  status: 'idle' | 'downloading' | 'completed' | 'cancelled' | 'error';
  error?: string;
}

export interface OfflineMapMeta {
  isDownloaded: boolean;
  tileCount: number;
  estimatedSizeMb: number;
  downloadedAt: number | null;
  packType: 'core' | 'detailed' | null;
}

/**
 * Generates tile list for Addis Ababa area across specified zoom levels
 */
export function generateAddisTileList(minZoom = 12, maxZoom = 14): TileCoord[] {
  const tiles: TileCoord[] = [];
  const subdomains = ['a', 'b', 'c', 'd'];
  let sIdx = 0;

  for (let z = minZoom; z <= maxZoom; z++) {
    const minX = lon2tile(ADDIS_BOUNDS.west, z);
    const maxX = lon2tile(ADDIS_BOUNDS.east, z);
    const minY = lat2tile(ADDIS_BOUNDS.north, z);
    const maxY = lat2tile(ADDIS_BOUNDS.south, z);

    const startX = Math.min(minX, maxX);
    const endX = Math.max(minX, maxX);
    const startY = Math.min(minY, maxY);
    const endY = Math.max(minY, maxY);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const s = subdomains[sIdx % subdomains.length];
        sIdx++;
        tiles.push({
          z,
          x,
          y,
          url: CARTO_KEY
            ? `https://${s}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png?key=${CARTO_KEY}`
            : `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`,
        });
      }
    }
  }

  return tiles;
}

/**
 * Inspects CacheStorage to calculate how many map tiles are currently cached
 */
export async function getOfflineMapStatus(): Promise<OfflineMapMeta> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return {
      isDownloaded: false,
      tileCount: 0,
      estimatedSizeMb: 0,
      downloadedAt: null,
      packType: null,
    };
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    // Count cached map tiles (Carto voyager or OSM)
    const mapTileKeys = keys.filter(
      (k) =>
        k.url.includes('basemaps.cartocdn.com') ||
        k.url.includes('tile.openstreetmap.org') ||
        k.url.includes('api.maptiler.com')
    );

    const tileCount = mapTileKeys.length;
    // Average tile size is ~15-20 KB
    const estimatedSizeMb = Number(((tileCount * 17) / 1024).toFixed(1));

    // Stored metadata
    const rawMeta = localStorage.getItem('ttOfflineMapMeta');
    const storedMeta = rawMeta ? JSON.parse(rawMeta) : null;

    // Consider downloaded if we have at least 150 tiles covering the core city
    const isDownloaded = tileCount >= 150;

    return {
      isDownloaded,
      tileCount,
      estimatedSizeMb,
      downloadedAt: storedMeta?.downloadedAt || (isDownloaded ? Date.now() : null),
      packType: storedMeta?.packType || (tileCount > 500 ? 'detailed' : tileCount >= 150 ? 'core' : null),
    };
  } catch (err) {
    console.warn('Error reading offline map cache:', err);
    return {
      isDownloaded: false,
      tileCount: 0,
      estimatedSizeMb: 0,
      downloadedAt: null,
      packType: null,
    };
  }
}

/**
 * Downloads offline map tiles with concurrency control & progress callbacks
 */
export async function downloadAddisOfflineMap(
  packType: 'core' | 'detailed' = 'core',
  onProgress?: (p: DownloadProgress) => void,
  abortSignal?: AbortSignal
): Promise<boolean> {
  if (!('caches' in window)) {
    throw new Error('Service Worker CacheStorage is not supported in this browser environment.');
  }

  const minZoom = 12;
  const maxZoom = packType === 'detailed' ? 15 : 14;
  const tiles = generateAddisTileList(minZoom, maxZoom);
  const total = tiles.length;

  const cache = await caches.open(CACHE_NAME);

  let completed = 0;
  let failed = 0;
  let totalBytes = 0;

  const notify = (status: DownloadProgress['status'], error?: string) => {
    if (!onProgress) return;
    const currentZoom = tiles[Math.min(completed, total - 1)]?.z || maxZoom;
    const percent = Math.min(100, Math.round((completed / total) * 100));
    onProgress({
      total,
      completed,
      failed,
      percent,
      currentZoom,
      estimatedBytes: totalBytes,
      status,
      error,
    });
  };

  notify('downloading');

  // Concurrency pool of 5 simultaneous requests to balance speed and low bandwidth
  const CONCURRENCY = 5;
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tiles.length) {
      if (abortSignal?.aborted) {
        throw new Error('Download cancelled by user');
      }

      const currentIndex = index++;
      const tile = tiles[currentIndex];

      try {
        // Check if already in cache
        const existing = await cache.match(tile.url);
        if (!existing) {
          const res = await fetch(tile.url, {
            mode: 'cors',
            signal: abortSignal,
          });

          if (res.status === 200) {
            const blob = await res.clone().blob();
            totalBytes += blob.size;
            await cache.put(tile.url, res);
          } else {
            failed++;
          }
        } else {
          totalBytes += 16 * 1024;
        }

        completed++;
        if (completed % 5 === 0 || completed === total) {
          notify('downloading');
        }
      } catch (err: any) {
        if (abortSignal?.aborted) {
          throw err;
        }
        failed++;
        completed++;
      }
    }
  }

  try {
    const workers = Array.from({ length: Math.min(CONCURRENCY, tiles.length) }, () => worker());
    await Promise.all(workers);

    // Save metadata
    localStorage.setItem(
      'ttOfflineMapMeta',
      JSON.stringify({
        isDownloaded: true,
        tileCount: completed,
        packType,
        downloadedAt: Date.now(),
        sizeEstimateMb: Number(((totalBytes || completed * 17 * 1024) / (1024 * 1024)).toFixed(1)),
      })
    );

    notify('completed');
    return true;
  } catch (err: any) {
    if (abortSignal?.aborted) {
      notify('cancelled');
      return false;
    }
    notify('error', err.message || 'Failed to download offline map');
    return false;
  }
}

/**
 * Deletes all cached map tiles to free up storage
 */
export async function clearOfflineMapCache(): Promise<void> {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    for (const req of keys) {
      if (
        req.url.includes('basemaps.cartocdn.com') ||
        req.url.includes('tile.openstreetmap.org') ||
        req.url.includes('api.maptiler.com')
      ) {
        await cache.delete(req);
      }
    }
    localStorage.removeItem('ttOfflineMapMeta');
  } catch (err) {
    console.error('Error clearing map cache:', err);
  }
}

/**
 * Network connection inspection helper
 */
export function getNetworkQuality(): {
  isOnline: boolean;
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  isLowSpeed: boolean;
  saveData: boolean;
  rtt: number;
} {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const conn =
    typeof navigator !== 'undefined'
      ? (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection
      : null;

  const effectiveType = conn?.effectiveType || 'unknown';
  const saveData = Boolean(conn?.saveData);
  const rtt = conn?.rtt || 0;

  // Connection is low speed if 2G, slow-2g, high latency (>800ms), or saveData is requested
  const isLowSpeed = !isOnline || effectiveType === '2g' || effectiveType === 'slow-2g' || saveData || rtt > 800;

  return {
    isOnline,
    effectiveType,
    isLowSpeed,
    saveData,
    rtt,
  };
}
