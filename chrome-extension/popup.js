/**
 * Popup UI Script
 */

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  loadStatus();
  setupEventListeners();
});

// ============================================================================
// LOAD STATUS
// ============================================================================

async function loadStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
    
    // Update status
    const statusEl = document.getElementById('syncStatus');
    if (response.lastSyncStatus === 'success') {
      statusEl.textContent = 'Active';
      statusEl.classList.add('success');
    } else if (response.lastSyncStatus === 'error') {
      statusEl.textContent = 'Error';
      statusEl.classList.add('error');
    } else {
      statusEl.textContent = 'Ready';
    }
    
    // Update last sync time
    const lastSyncEl = document.getElementById('lastSync');
    if (response.lastSyncTime) {
      const date = new Date(response.lastSyncTime);
      lastSyncEl.textContent = formatRelativeTime(date);
    }
    
    // Update item count
    const itemCountEl = document.getElementById('itemCount');
    if (response.lastSyncCount) {
      itemCountEl.textContent = response.lastSyncCount;
    }
    
    // Update toggle
    const toggleEl = document.getElementById('syncToggle');
    toggleEl.checked = response.syncEnabled !== false;
    
  } catch (error) {
    console.error('Failed to load status:', error);
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Sync now button
  document.getElementById('syncNowBtn').addEventListener('click', async () => {
    const btn = document.getElementById('syncNowBtn');
    const loading = document.getElementById('loading');
    
    btn.disabled = true;
    loading.classList.add('active');
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'syncNow' });
      
      if (response.success) {
        showNotification('Sync completed successfully!', 'success');
      } else {
        showNotification('Sync failed: ' + response.error, 'error');
      }
      
      // Reload status
      await loadStatus();
      
    } catch (error) {
      console.error('Sync failed:', error);
      showNotification('Sync failed: ' + error.message, 'error');
    } finally {
      btn.disabled = false;
      loading.classList.remove('active');
    }
  });
  
  // Options button
  document.getElementById('optionsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Sync toggle
  document.getElementById('syncToggle').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    
    await chrome.storage.local.set({ syncEnabled: enabled });
    
    showNotification(
      enabled ? 'Auto-sync enabled' : 'Auto-sync disabled',
      'success'
    );
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

function showNotification(message, type) {
  const statusEl = document.getElementById('syncStatus');
  statusEl.textContent = message;
  statusEl.className = `status-value ${type}`;
  
  setTimeout(() => {
    loadStatus();
  }, 2000);
}
