const API_BASE = 'https://sce-api.pasttime.xyz';

let currentMode = 'keyword';
let searchTimeout = null;
let isSearching = false;

// DOM elements
const queryInput = document.getElementById('query');
const resultsDiv = document.getElementById('results');
const welcomeDiv = document.getElementById('welcome');
const statsBar = document.getElementById('stats-bar');
const resultCount = document.getElementById('result-count');
const searchTime = document.getElementById('search-time');
const footerStats = document.getElementById('footer-stats');
const modeButtons = document.querySelectorAll('.mode');
const suggestions = document.querySelectorAll('.suggestion');

// Mode selection
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    queryInput.focus();

    // Re-search if there's a query
    if (queryInput.value.trim()) {
      performSearch();
    }
  });
});

// Suggestion clicks
suggestions.forEach(btn => {
  btn.addEventListener('click', () => {
    queryInput.value = btn.dataset.query;
    performSearch();
    queryInput.focus();
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Focus search on /
  if (e.key === '/' && document.activeElement !== queryInput) {
    e.preventDefault();
    queryInput.focus();
  }
  
  // Escape to clear
  if (e.key === 'Escape' && document.activeElement === queryInput) {
    queryInput.value = '';
    showWelcome();
    queryInput.blur();
  }
});

// Search on Enter
queryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(searchTimeout);
    performSearch();
  }
});

// Debounced search as you type
queryInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (queryInput.value.trim().length >= 2) {
      performSearch();
    } else if (queryInput.value.trim().length === 0) {
      showWelcome();
    }
  }, 400);
});

async function performSearch() {
  const query = queryInput.value.trim();
  if (!query || isSearching) return;

  isSearching = true;
  hideWelcome();
  resultsDiv.innerHTML = '<div class="loading"><div class="dotmatrix-core-rotor"><div class="dmx-grid"><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot dmx-active" data-frame="0"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot dmx-active" data-frame="0"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot dmx-active" data-frame="0"></span><span class="dmx-dot dmx-active" data-frame="0"></span><span class="dmx-dot dmx-hub"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot"></span><span class="dmx-dot"></span></div></div><span>Searching...</span></div>';
  startCoreRotor();
  resultCount.textContent = '';
  searchTime.textContent = '';

  try {
    const params = new URLSearchParams({
      q: query,
      mode: currentMode,
      limit: '15',
    });

    const response = await fetch(`${API_BASE}/api/search?${params}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Search failed');
    }

    renderResults(data);
  } catch (error) {
    resultsDiv.innerHTML = `<div class="error">
      <strong>Search failed</strong><br>
      ${escapeHtml(error.message)}
    </div>`;
    resultCount.textContent = '';
    searchTime.textContent = '';
    stopCoreRotor();
  } finally {
    isSearching = false;
  }
}

function renderResults(data) {
  if (data.hits.length === 0) {
    resultsDiv.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <p>No results found for "${escapeHtml(data.query)}"</p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Try a different query or search mode</p>
      </div>
    `;
    resultCount.textContent = '0 results';
    searchTime.textContent = `${data.searchTimeMs}ms`;
    stopCoreRotor();
    return;
  }

  const html = data.hits.map((hit, i) => `
    <div class="result-card" data-chunk-id="${escapeHtml(hit.chunkId || '')}" style="animation: fadeIn 0.2s ease ${i * 0.03}s both">
      <div class="result-header">
        <span class="result-path">${escapeHtml(hit.relativePath)}</span>
        <span class="result-score">score: ${formatScore(hit.score)}</span>
      </div>
      ${hit.headingPath ? `<div class="result-heading">${escapeHtml(hit.headingPath)}</div>` : ''}
      <div class="result-text">${highlightText(truncateText(hit.text, 400), data.query)}</div>
      <div class="result-meta">
        ${hit.language ? `<span>📄 ${escapeHtml(hit.language)}</span>` : ''}
        ${hit.symbolKind ? `<span>🏷️ ${escapeHtml(hit.symbolKind)}</span>` : ''}
        ${hit.chunkId ? `<span>ID: ${hit.chunkId.substring(0, 8)}</span>` : ''}
      </div>
    </div>
  `).join('');

  resultsDiv.innerHTML = html;
  resultCount.textContent = `${data.totalHits} result${data.totalHits !== 1 ? 's' : ''}`;
  searchTime.textContent = `${data.searchTimeMs}ms`;
  stopCoreRotor();

  // Add click handlers to result cards
  resultsDiv.querySelectorAll('.result-card').forEach(card => {
    card.addEventListener('click', () => {
      const chunkId = card.dataset.chunkId;
      if (chunkId) {
        openModal(chunkId);
      }
    });
  });

  // Add fadeIn animation
  if (!document.getElementById('dynamic-styles')) {
    const style = document.createElement('style');
    style.id = 'dynamic-styles';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
}

function showWelcome() {
  welcomeDiv.style.display = 'block';
  resultsDiv.innerHTML = '';
  resultCount.textContent = '';
  searchTime.textContent = '';
}

function hideWelcome() {
  welcomeDiv.style.display = 'none';
}

function showResults() {
  stopCoreRotor();
}

function formatScore(score) {
  if (score >= 1) return '1.000';
  if (score <= 0) return '0.000';
  return score.toFixed(3);
}

function truncateText(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '...';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function highlightText(text, query) {
  if (!query || !text) return escapeHtml(text);
  
  const escaped = escapeHtml(text);
  const terms = query.trim().split(/\s+/).filter(t => t.length >= 2);
  
  if (terms.length === 0) return escaped;
  
  const pattern = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  
  return escaped.replace(regex, '<mark class="highlight">$1</mark>');
}

// Modal elements
const modal = document.getElementById('doc-modal');
const modalOverlay = modal.querySelector('.modal-overlay');
const modalClose = document.getElementById('modal-close');
const modalPath = document.getElementById('modal-path');
const modalHeading = document.getElementById('modal-heading');
const modalMeta = document.getElementById('modal-meta');
const modalBody = document.getElementById('modal-body');

// Open modal with chunk data
async function openModal(chunkId) {
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  modalBody.textContent = 'Loading...';
  modalPath.textContent = '';
  modalHeading.textContent = '';
  modalMeta.innerHTML = '';

  try {
    const response = await fetch(`${API_BASE}/api/chunk/${chunkId}`);
    const chunk = await response.json();

    if (!response.ok) {
      throw new Error(chunk.error || 'Failed to load chunk');
    }

    modalPath.textContent = chunk.relativePath || '';
    modalHeading.textContent = chunk.headingPath || '';
    modalBody.textContent = chunk.text || '';

    // Build meta info
    const metaItems = [];
    if (chunk.language) metaItems.push(`📄 ${chunk.language}`);
    if (chunk.symbolKind) metaItems.push(`🏷️ ${chunk.symbolKind}`);
    metaItems.push(`ID: ${chunk.id}`);
    modalMeta.innerHTML = metaItems.map(m => `<span>${escapeHtml(m)}</span>`).join('');
  } catch (error) {
    modalBody.textContent = `Error: ${error.message}`;
  }
}

// Close modal
function closeModal() {
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.style.display === 'flex') {
    closeModal();
  }
});

// Load stats on page load
async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/api/stats`);
    const data = await response.json();
    footerStats.textContent = `${data.chunks.toLocaleString()} chunks`;
    statsBar.textContent = `📊 ${data.chunks.toLocaleString()} chunks indexed • ${data.vectors.toLocaleString()} vectors • Model: ${data.embeddingModel}`;
  } catch (error) {
    footerStats.textContent = 'Stats unavailable';
    statsBar.textContent = '';
  }
}

// Initialize
loadStats();
queryInput.focus();

// Core Rotor animation — cycles through 8 fan blade positions
const CORE_ROTOR_FRAMES = [
  '..x.. ..x.. ..o.. ..... .....',
  '....x ...x. ..o.. ..... .....',
  '..... ..... ..oxx ..... .....',
  '..... ..... ..o.. ...x. ....x',
  '..... ..... ..o.. ..x.. ..x..',
  '..... ..... ..o.. .x... x....',
  '..... ..... xxo.. ..... .....',
  'x.... .x... ..o.. ..... .....',
];
const CORE_ROTOR_SEQ = [0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7];
let rotorFrame = 0;
let rotorInterval = null;

function tickCoreRotor() {
  const mask = CORE_ROTOR_FRAMES[CORE_ROTOR_SEQ[rotorFrame]];
  const cells = mask.replace(/\s/g, '').split('');
  document.querySelectorAll('.dotmatrix-core-rotor .dmx-grid').forEach(grid => {
    const dots = grid.querySelectorAll('.dmx-dot');
    dots.forEach((dot, i) => {
      const ch = cells[i] || '.';
      if (dot.classList.contains('dmx-hub')) {
        dot.style.opacity = '0.6';
      } else if (ch === 'x') {
        dot.style.opacity = '1';
      } else if (ch === 'o') {
        dot.style.opacity = '0.56';
      } else {
        dot.style.opacity = '0.12';
      }
    });
  });
  rotorFrame = (rotorFrame + 1) % CORE_ROTOR_SEQ.length;
}

function startCoreRotor() {
  if (rotorInterval) return;
  rotorFrame = 0;
  tickCoreRotor();
  rotorInterval = setInterval(tickCoreRotor, 1550 / CORE_ROTOR_SEQ.length);
}

function stopCoreRotor() {
  if (rotorInterval) {
    clearInterval(rotorInterval);
    rotorInterval = null;
  }
}
