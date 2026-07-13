const API_BASE = '';  // Same origin

let currentMode = 'keyword';
let searchTimeout = null;

// DOM elements
const queryInput = document.getElementById('query');
const searchBtn = document.getElementById('search-btn');
const resultsDiv = document.getElementById('results');
const statsDiv = document.getElementById('stats');
const modeButtons = document.querySelectorAll('.mode');

// Mode selection
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;

    // Re-search if there's a query
    if (queryInput.value.trim()) {
      performSearch();
    }
  });
});

// Search on Enter
queryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    performSearch();
  }
});

// Search button click
searchBtn.addEventListener('click', performSearch);

// Debounced search as you type
queryInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (queryInput.value.trim().length >= 3) {
      performSearch();
    }
  }, 500);
});

async function performSearch() {
  const query = queryInput.value.trim();
  if (!query) {
    resultsDiv.innerHTML = '';
    return;
  }

  resultsDiv.innerHTML = '<div class="loading">Searching...</div>';

  try {
    const params = new URLSearchParams({
      q: query,
      mode: currentMode,
      limit: '20',
    });

    const response = await fetch(`${API_BASE}/api/search?${params}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Search failed');
    }

    renderResults(data);
  } catch (error) {
    resultsDiv.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

function renderResults(data) {
  if (data.hits.length === 0) {
    resultsDiv.innerHTML = '<div class="loading">No results found</div>';
    return;
  }

  const html = data.hits.map(hit => `
    <div class="result-card">
      <div class="result-header">
        <span class="result-path">${escapeHtml(hit.relativePath)}</span>
        <span class="result-score">${hit.score.toFixed(3)}</span>
      </div>
      ${hit.headingPath ? `<div class="result-heading">${escapeHtml(hit.headingPath)}</div>` : ''}
      <div class="result-text">${escapeHtml(hit.text)}</div>
      <div class="result-meta">
        ${hit.language ? `<span>${escapeHtml(hit.language)}</span>` : ''}
        ${hit.symbolKind ? `<span>${escapeHtml(hit.symbolKind)}</span>` : ''}
      </div>
    </div>
  `).join('');

  resultsDiv.innerHTML = html;

  // Update stats
  statsDiv.textContent = `${data.totalHits} results | ${data.searchTimeMs}ms | Mode: ${data.mode}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load stats on page load
async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/api/stats`);
    const data = await response.json();
    statsDiv.textContent = `${data.chunks} chunks indexed | ${data.symbols} symbols | Model: ${data.embeddingModel}`;
  } catch (error) {
    statsDiv.textContent = 'Stats unavailable';
  }
}

loadStats();
