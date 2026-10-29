import { makeOverpassQuery, getCacheKey } from './overpassQuery';

/**
 * Fetch street data from Overpass API or localStorage cache
 */
export async function fetchOverpassData({ areaSelection, shouldCacheResponseInBrowser = true }) {
  const overpassQuery = makeOverpassQuery({ areaSelection });
  const localStorageKey = getCacheKey(overpassQuery);
  
  // Try to get from cache first
  if (shouldCacheResponseInBrowser) {
    const responseFromLocalStorage = tryGetFromLocalStorage(localStorageKey);
    
    if (responseFromLocalStorage) {
      try {
        console.log('✅ Using cached Overpass data');
        return JSON.parse(responseFromLocalStorage);
      } catch (e) {
        console.warn('Failed to parse cached data, fetching fresh', e);
      }
    }
    
    // Prune old cache entries
    pruneOldCacheEntries(localStorageKey);
  }
  
    // Fetch from Overpass API, trying each endpoint until one succeeds
  const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];
  const TIMEOUT_MS = 60000;

  let response;
  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(overpassQuery),
        signal: controller.signal,
      });
      if (response.ok) break;
      lastError = new Error(`${endpoint} returned ${response.status}`);
      // 4xx other than 429 means a bad query; another server won't fix it
      if (response.status < 500 && response.status !== 429) break;
    } catch (err) {
      lastError = err.name === 'AbortError'
        ? new Error(`${endpoint} timed out after ${TIMEOUT_MS / 1000}s`)
        : err;
    } finally {
      clearTimeout(timeoutId);
    }
    response = undefined;
  }

  if (!response?.ok) {
    throw new Error(
      `Failed to retrieve street data from every Overpass server. Last error: ${lastError?.message}`
    );
  }

  // Parse response
  let result;
  try {
    result = await response.json();
    console.log(`✅ Fetched ${result.elements?.length || 0} elements from Overpass`);
  } catch (e) {
    console.error(e);
    throw new Error(
      `Cannot parse street data from Overpass API. [${e}]`
    );
  }
  
  // Cache the response
  if (shouldCacheResponseInBrowser) {
    trySetInLocalStorage(localStorageKey, JSON.stringify(result));
  }
  
  return result;
}

/**
 * Try to get from localStorage without throwing
 */
function tryGetFromLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('Failed to read from localStorage', e);
    return null;
  }
}

/**
 * Try to set in localStorage without throwing
 */
function trySetInLocalStorage(key, value) {
  try {
    // Check if value is too large (>4MB is risky for localStorage)
    const sizeInMB = new Blob([value]).size / (1024 * 1024);
    if (sizeInMB > 4) {
      console.warn(`Response too large to cache (${sizeInMB.toFixed(2)}MB), skipping cache`);
      return;
    }
    
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('Failed to write to localStorage', e);
    // If quota exceeded, try clearing all overpass cache and retry once
    if (e.name === 'QuotaExceededError') {
      console.log('Clearing all Overpass cache and retrying...');
      clearAllOverpassCache();
      try {
        localStorage.setItem(key, value);
      } catch (retryError) {
        console.warn('Still failed after clearing cache, skipping cache', retryError);
      }
    }
  }
}

/**
 * Clear all Overpass cache entries
 */
function clearAllOverpassCache() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('overpass-response')) {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // Ignore errors
        }
      }
    });
    console.log('Cleared all Overpass cache');
  } catch (e) {
    console.warn('Failed to clear cache', e);
  }
}

/**
 * Remove old cache entries to prevent localStorage overflow
 */
function pruneOldCacheEntries(currentKey) {
  try {
    const entries = Object.entries(localStorage);
    const oldEntries = entries
      .map(([key]) => key)
      .filter(key => 
        key !== currentKey && 
        key.startsWith('overpass-response')
      );
    
    oldEntries.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore errors when pruning
      }
    });
    
    if (oldEntries.length > 0) {
      console.log(`🧹 Pruned ${oldEntries.length} old cache entries`);
    }
  } catch (e) {
    console.warn('Failed to prune cache', e);
  }
}
