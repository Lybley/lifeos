/**
 * Background Service Worker for LifeOS Browser History Collector
 * 
 * Handles periodic syncing of browser history to LifeOS backend
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'http://localhost:8000'; // Will be configurable
const SYNC_INTERVAL_MINUTES = 60; // Sync every hour
const BATCH_SIZE = 100; // Send 100 entries at a time

// Privacy filters - URLs to exclude
const PRIVACY_FILTERS = [
  /^chrome:\/\//,
  /^chrome-extension:\/\//,
  /^about:/,
  /banking|paypal|accounts\.google/i,
  /password|login|signin/i,
  /private|incognito/i,
];

// ============================================================================
// INITIALIZATION
// ============================================================================

chrome.runtime.onInstalled.addListener((details) => {
  console.log('LifeOS Browser Collector installed', details);
  
  // Set up periodic sync
  chrome.alarms.create('syncHistory', {
    delayInMinutes: 1,
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
  
  // Initialize storage
  chrome.storage.local.get(['userId', 'apiKey', 'lastSyncTime'], (result) => {
    if (!result.userId || !result.apiKey) {
      // Open options page for setup
      chrome.runtime.openOptionsPage();
    }
  });
});

// ============================================================================
// ALARM HANDLER
// ============================================================================

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncHistory') {
    console.log('Starting history sync...');
    syncBrowserHistory();
  }
});

// ============================================================================
// HISTORY SYNC LOGIC
// ============================================================================

async function syncBrowserHistory() {
  try {
    // Get configuration
    const config = await chrome.storage.local.get([
      'userId',
      'apiKey',
      'lastSyncTime',
      'syncEnabled',
      'privacyMode',
    ]);
    
    if (!config.syncEnabled) {
      console.log('Sync disabled by user');
      return;
    }
    
    if (!config.userId || !config.apiKey) {
      console.warn('Missing credentials, skipping sync');
      return;
    }
    
    // Get history since last sync
    const lastSyncTime = config.lastSyncTime || Date.now() - (7 * 24 * 60 * 60 * 1000); // Default: last 7 days
    const currentTime = Date.now();
    
    const historyItems = await chrome.history.search({
      text: '',
      startTime: lastSyncTime,
      endTime: currentTime,
      maxResults: 1000,
    });
    
    console.log(`Found ${historyItems.length} history items since last sync`);
    
    if (historyItems.length === 0) {
      console.log('No new history to sync');
      await chrome.storage.local.set({ lastSyncTime: currentTime });
      return;
    }
    
    // Filter based on privacy settings
    const filteredItems = config.privacyMode 
      ? filterPrivateUrls(historyItems)
      : historyItems;
    
    console.log(`After privacy filtering: ${filteredItems.length} items`);
    
    // Get detailed visit information
    const enrichedItems = await enrichHistoryItems(filteredItems);
    
    // Send to backend in batches
    await sendHistoryBatch(enrichedItems, config);
    
    // Update last sync time
    await chrome.storage.local.set({ 
      lastSyncTime: currentTime,
      lastSyncCount: enrichedItems.length,
      lastSyncStatus: 'success',
    });
    
    // Update badge
    chrome.action.setBadgeText({ text: String(enrichedItems.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    
    // Clear badge after 3 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
    
    console.log(`Successfully synced ${enrichedItems.length} history items`);
    
  } catch (error) {
    console.error('History sync failed:', error);
    
    await chrome.storage.local.set({
      lastSyncStatus: 'error',
      lastSyncError: error.message,
    });
    
    // Show error badge
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
  }
}

// ============================================================================
// PRIVACY FILTERING
// ============================================================================

function filterPrivateUrls(historyItems) {
  return historyItems.filter(item => {
    const url = item.url || '';
    
    // Check against privacy filters
    for (const filter of PRIVACY_FILTERS) {
      if (filter.test(url)) {
        return false;
      }
    }
    
    return true;
  });
}

// ============================================================================
// HISTORY ENRICHMENT
// ============================================================================

async function enrichHistoryItems(historyItems) {
  const enriched = [];
  
  for (const item of historyItems) {
    try {
      // Get all visits for this URL
      const visits = await chrome.history.getVisits({ url: item.url });
      
      // Parse URL
      let domain = '';
      let path = '';
      try {
        const url = new URL(item.url);
        domain = url.hostname;
        path = url.pathname + url.search;
      } catch (e) {
        domain = item.url;
      }
      
      enriched.push({
        id: generateId(item.url, item.lastVisitTime),
        url: item.url,
        title: item.title || 'Untitled',
        visitTime: new Date(item.lastVisitTime),
        visitCount: item.visitCount || visits.length,
        domain,
        path,
        // Note: We don't capture actual page content for privacy
        // Backend can optionally fetch public page metadata
      });
      
    } catch (error) {
      console.error('Failed to enrich history item:', error);
    }
  }
  
  return enriched;
}

// ============================================================================
// BACKEND COMMUNICATION
// ============================================================================

async function sendHistoryBatch(historyItems, config) {
  const batches = [];
  
  // Split into batches
  for (let i = 0; i < historyItems.length; i += BATCH_SIZE) {
    batches.push(historyItems.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`Sending ${batches.length} batches to backend`);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/ingest/browser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'X-Extension-Version': chrome.runtime.getManifest().version,
        },
        body: JSON.stringify({
          userId: config.userId,
          entries: batch,
          browserMetadata: {
            browser: 'chrome',
            version: await getBrowserVersion(),
            os: await getOS(),
            extensionVersion: chrome.runtime.getManifest().version,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();
      console.log(`Batch ${i + 1}/${batches.length} sent successfully:`, result);
      
    } catch (error) {
      console.error(`Failed to send batch ${i + 1}:`, error);
      throw error;
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(url, timestamp) {
  // Simple hash function for ID
  const str = `${url}-${timestamp}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hist_${Math.abs(hash).toString(36)}`;
}

async function getBrowserVersion() {
  return new Promise((resolve) => {
    chrome.runtime.getPlatformInfo((info) => {
      resolve(info.arch || 'unknown');
    });
  });
}

async function getOS() {
  return new Promise((resolve) => {
    chrome.runtime.getPlatformInfo((info) => {
      resolve(info.os || 'unknown');
    });
  });
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'syncNow') {
    syncBrowserHistory().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Async response
  }
  
  if (message.action === 'getStatus') {
    chrome.storage.local.get([
      'lastSyncTime',
      'lastSyncCount',
      'lastSyncStatus',
      'syncEnabled',
    ], (result) => {
      sendResponse(result);
    });
    return true;
  }
});

// ============================================================================
// EXPORT FOR TESTING
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    syncBrowserHistory,
    filterPrivateUrls,
    enrichHistoryItems,
  };
}

console.log('LifeOS Browser History Collector background service loaded');
