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
  
  // Fetch from Overpass API
  const performFetch = () => {
    return fetch('https://www.overpass-api.de/api/interpreter', {
      body: `data=${overpassQuery}`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    });
  };
  
  console.log('🌐 Fetching from Overpass API...');
  let response = await performFetch();
  
  // Handle errors with retry logic
  if (!response.ok) {
    if (response.status >= 500 && response.status < 600) {
      if (response.status === 504) {
        console.warn('⚠️ Overpass timeout, retrying...');
        response = await performFetch();
        
        if (!response.ok) {
          throw new Error(
            `Failed to retrieve street data. Overpass API has timed out (${response.status}). ` +
            'They could be experiencing a temporary outage, please try again later'
          );
        }
      } else {
        throw new Error(
          `Failed to retrieve street data. Overpass API has errored (${response.status}). ` +
          'They could be experiencing a temporary outage, please try again later'
        );
      }
    } else {
      throw new Error(
        `Failed to retrieve street data from Overpass API (${response.status})`
      );
    }
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
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('Failed to write to localStorage', e);
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
