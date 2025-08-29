// Content script for Google search results fact-checking
class TruthlyExtension {
  constructor() {
    this.serverUrl = 'http://localhost:5000';
    this.frontendUrl = 'http://localhost:3000';
    this.processingResults = new Set();
    this.cache = new Map();
    this.settings = {
      enabled: true,
      autoAnalyze: true,
      cacheResults: true
    };
    this.init();
  }

  async init() {
    console.log('Truthly Extension: Initializing...');
    
    // Load settings first
    await this.loadSettings();
    
    if (!this.settings.enabled) {
      console.log('Truthly Extension: Disabled by user settings');
      return;
    }

    this.waitForSearchResults();
    
    // Listen for dynamic content changes
    const observer = new MutationObserver(() => {
      if (this.settings.enabled) {
        this.waitForSearchResults();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['enabled', 'autoAnalyze', 'cacheResults'], (result) => {
        this.settings = {
          enabled: result.enabled !== false,
          autoAnalyze: result.autoAnalyze !== false,
          cacheResults: result.cacheResults !== false
        };
        resolve();
      });
    });
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'SETTINGS_UPDATED':
        this.settings = message.settings;
        if (!this.settings.enabled) {
          this.removeAllLabels();
        } else {
          this.waitForSearchResults();
        }
        break;
      case 'CLEAR_CACHE':
        this.cache.clear();
        this.removeAllLabels();
        if (this.settings.enabled) {
          this.waitForSearchResults();
        }
        break;
    }
  }

  removeAllLabels() {
    document.querySelectorAll('.truthly-label, .truthly-loading').forEach(el => el.remove());
    document.querySelectorAll('[data-truthly-processing]').forEach(el => {
      delete el.dataset.truthlyProcessing;
    });
  }

  waitForSearchResults() {
    setTimeout(() => {
      this.processSearchResults();
    }, 1000);
  }

  processSearchResults() {
    if (!this.settings.enabled) return;

    const searchResults = document.querySelectorAll('[data-ved]');
    
    searchResults.forEach((result, index) => {
      if (this.shouldProcessResult(result)) {
        this.processSearchResult(result, index);
      }
    });
  }

  shouldProcessResult(result) {
    if (result.querySelector('.truthly-label')) return false;
    if (result.dataset.truthlyProcessing === 'true') return false;

    const linkElement = result.querySelector('a[href]');
    if (!linkElement) return false;

    const url = linkElement.href;
    if (url.includes('google.com') || 
        url.includes('maps.google.com') || 
        url.includes('images.google.com') || 
        url.startsWith('javascript:')) {
      return false;
    }

    return true;
  }

  async processSearchResult(result, index) {
    try {
      result.dataset.truthlyProcessing = 'true';

      const linkElement = result.querySelector('a[href]');
      const titleElement = result.querySelector('h3') || result.querySelector('[role="heading"]');

      if (!linkElement || !titleElement) return;

      const url = linkElement.href;
      const title = titleElement.textContent.trim();

      // Check cache first
      const cacheKey = url;
      if (this.cache.has(cacheKey)) {
        this.displayLabel(result, this.cache.get(cacheKey), url);
        return;
      }

      this.addLoadingIndicator(result);

      const analysis = await this.analyzeUrl(url, title);
      
      if (analysis && analysis.success && analysis.data) {
        if (this.settings.cacheResults) {
          this.cache.set(cacheKey, analysis.data);
        }
        this.displayLabel(result, analysis.data, url);
        this.updateStats(analysis.data);
      } else {
        this.displayErrorLabel(result, url);
      }

    } catch (error) {
      console.error('Truthly Extension: Error processing result', error);
      this.displayErrorLabel(result, url);
    } finally {
      result.dataset.truthlyProcessing = 'false';
      this.removeLoadingIndicator(result);
    }
  }

  async analyzeUrl(url, title) {
    try {
      console.log(`Truthly Extension: Analyzing ${url}`);
      
      const response = await fetch(`${this.serverUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          title: title
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Analysis response:', data);
      return data;

    } catch (error) {
      console.error('Truthly Extension: Analysis failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  addLoadingIndicator(result) {
    const existing = result.querySelector('.truthly-loading');
    if (existing) return;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'truthly-loading';
    loadingDiv.innerHTML = `
      <div class="truthly-spinner"></div>
      <span>Checking trustworthiness...</span>
    `;

    this.insertLabel(result, loadingDiv);
  }

  removeLoadingIndicator(result) {
    const loading = result.querySelector('.truthly-loading');
    if (loading) {
      loading.remove();
    }
  }

  displayLabel(result, analysis, url) {
    // Handle different response structures from your API
    let isTrustworthy = false;
    let confidence = 0;

    // Check for different possible response formats
    if (analysis.label) {
      isTrustworthy = analysis.label.toLowerCase() === 'trustworthy';
      confidence = Math.round(analysis.confidence || 0);
    } else if (analysis.trustworthy !== undefined) {
      isTrustworthy = analysis.trustworthy;
      confidence = Math.round(analysis.confidence || 0);
    } else if (analysis.result) {
      // Handle nested result structure
      isTrustworthy = analysis.result.trustworthy || analysis.result.label === 'Trustworthy';
      confidence = Math.round(analysis.result.confidence || 0);
    } else {
      // Default fallback - Check your server logs for exact response format
      console.warn('Unknown analysis format:', analysis);
      this.displayErrorLabel(result, url);
      return;
    }

    const labelDiv = document.createElement('div');
    labelDiv.className = `truthly-label ${isTrustworthy ? 'trustworthy' : 'untrustworthy'}`;
    
    labelDiv.innerHTML = `
      <div class="truthly-content">
        <div class="truthly-status">
          <span class="truthly-icon">${isTrustworthy ? '✓' : '⚠'}</span>
          <span class="truthly-text">${isTrustworthy ? 'Trustworthy' : 'Untrustworthy'}</span>
        </div>
        <div class="truthly-confidence">${confidence}%</div>
        <div class="truthly-actions">
          <button class="truthly-details-btn" data-url="${encodeURIComponent(url)}">Details</button>
        </div>
      </div>
    `;

    // Add click handler for details button
    const detailsBtn = labelDiv.querySelector('.truthly-details-btn');
    if (detailsBtn) {
      detailsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = decodeURIComponent(e.target.dataset.url);
        window.open(`${this.frontendUrl}/result?url=${encodeURIComponent(url)}`, '_blank');
      });
    }

    this.insertLabel(result, labelDiv);
  }

  displayErrorLabel(result, url) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'truthly-label error';
    
    labelDiv.innerHTML = `
      <div class="truthly-content">
        <div class="truthly-status">
          <span class="truthly-icon">!</span>
          <span class="truthly-text">Check Failed</span>
        </div>
        <div class="truthly-actions">
          <button class="truthly-retry-btn" data-url="${encodeURIComponent(url)}">Retry</button>
        </div>
      </div>
    `;

    // Add retry functionality
    const retryBtn = labelDiv.querySelector('.truthly-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        labelDiv.remove();
        result.dataset.truthlyProcessing = 'false';
        this.processSearchResult(result, 0);
      });
    }

    this.insertLabel(result, labelDiv);
  }

  insertLabel(result, labelElement) {
    // Find the best place to insert the label
    const titleElement = result.querySelector('h3') || result.querySelector('[role="heading"]');
    
    if (titleElement) {
      // Insert after the title
      titleElement.parentNode.insertBefore(labelElement, titleElement.nextSibling);
    } else {
      // Fallback: insert at the beginning of the result
      result.insertBefore(labelElement, result.firstChild);
    }
  }

  updateStats(analysis) {
    chrome.storage.local.get(['analyzedCount', 'trustworthyCount'], (result) => {
      const newAnalyzedCount = (result.analyzedCount || 0) + 1;
      const isTrustworthy = analysis.label === 'Trustworthy' || analysis.trustworthy === true;
      const newTrustworthyCount = (result.trustworthyCount || 0) + (isTrustworthy ? 1 : 0);

      chrome.storage.local.set({
        analyzedCount: newAnalyzedCount,
        trustworthyCount: newTrustworthyCount
      });

      // Notify popup if it's open
      chrome.runtime.sendMessage({
        type: 'UPDATE_STATS',
        stats: {
          analyzedCount: newAnalyzedCount,
          trustworthyCount: newTrustworthyCount
        }
      }).catch(() => {
        // Popup might not be open, ignore error
      });
    });
  }
}

// Initialize the extension
if (window.location.hostname.includes('google.com')) {
  new TruthlyExtension();
}
