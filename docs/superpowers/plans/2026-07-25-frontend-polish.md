# Frontend Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full polish pass on SCE frontend — remove AST, add highlighting, improve animations, accessibility, mobile, search history, and result improvements.

**Architecture:** Single-file changes to `index.html`, `style.css`, and `app.js`. No new dependencies. Commit after each task.

**Tech Stack:** Vanilla JS, CSS, HTML. localStorage for search history.

## Global Constraints

- Keep neobrutalist aesthetic (hard shadows, square corners, 0px radius)
- No external libraries
- Must work on Chrome, Firefox, Safari
- Mobile-first responsive design
- Maintain current API integration

---

## Task 1: Remove AST Button

**Files:**
- Modify: `packages/web/frontend/index.html:37-40`

**Interfaces:** None — standalone removal

- [ ] **Step 1: Remove AST button from HTML**

In `index.html`, remove the AST mode button:

```html
<!-- REMOVE these lines -->
<button class="mode" data-mode="ast" title="AST symbol lookup — functions, classes, types">
  <span class="mode-icon">🌳</span> AST
</button>
```

- [ ] **Step 2: Update footer text**

Change "4 search modes" to "3 search modes" in the footer.

- [ ] **Step 3: Commit**

```bash
git add packages/web/frontend/index.html
git commit -m "feat(frontend): remove AST mode button from UI

AST search is API/MCP only per design decision."
```

---

## Task 2: Search Highlighting

**Files:**
- Modify: `packages/web/frontend/app.js` — add `highlightText()` function
- Modify: `packages/web/frontend/style.css` — add `.highlight` style

**Interfaces:**
- Consumes: `query` string from search input
- Produces: HTML with `<mark>` tags around matched terms

- [ ] **Step 1: Add highlight function to app.js**

Add after the `escapeHtml` function:

```javascript
function highlightText(text, query) {
  if (!query || !text) return escapeHtml(text);
  
  const escaped = escapeHtml(text);
  const terms = query.trim().split(/\s+/).filter(t => t.length >= 2);
  
  if (terms.length === 0) return escaped;
  
  // Build regex that matches any term (case-insensitive)
  const pattern = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  
  return escaped.replace(regex, '<mark class="highlight">$1</mark>');
}
```

- [ ] **Step 2: Update renderResults to use highlighting**

In the `renderResults` function, change:

```javascript
// OLD
<div class="result-text">${escapeHtml(truncateText(hit.text, 400))}</div>

// NEW
<div class="result-text">${highlightText(truncateText(hit.text, 400), data.query)}</div>
```

- [ ] **Step 3: Add highlight CSS**

Add to `style.css`:

```css
.highlight {
  background: var(--primary);
  color: var(--primary-foreground);
  padding: 0.1em 0.2em;
  font-weight: 600;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/frontend/app.js packages/web/frontend/style.css
git commit -m "feat(frontend): add search term highlighting in results

Highlights query terms in result text with primary color."
```

---

## Task 3: Better Animations

**Files:**
- Modify: `packages/web/frontend/style.css` — improve transitions
- Modify: `packages/web/frontend/app.js` — staggered result animation

**Interfaces:** None — visual improvements only

- [ ] **Step 1: Add smooth hover transitions**

Update `.result-card` transition in `style.css`:

```css
.result-card {
  /* ... existing ... */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
```

- [ ] **Step 2: Add focus ring animation**

Add to `style.css`:

```css
.mode:focus-visible,
.suggestion:focus-visible,
.result-card:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Add search input glow effect**

Update `.search-box input:focus` in `style.css`:

```css
.search-box input:focus {
  border-color: var(--primary);
  box-shadow: var(--shadow-md), 0 0 0 3px var(--accent-glow);
  transform: translate(-1px, -1px);
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/frontend/style.css
git commit -m "feat(frontend): improve animations and transitions

Smoother hover effects, focus rings, and input glow."
```

---

## Task 4: Accessibility

**Files:**
- Modify: `packages/web/frontend/index.html` — ARIA labels, roles
- Modify: `packages/web/frontend/app.js` — focus management, live regions

**Interfaces:** None — accessibility improvements

- [ ] **Step 1: Add ARIA labels to search box**

In `index.html`, update the search input:

```html
<input
  type="text"
  id="query"
  placeholder="Search documentation..."
  autocomplete="off"
  spellcheck="false"
  aria-label="Search documentation"
  aria-describedby="search-hint"
>
<span id="search-hint" class="sr-only">Press / to focus search. Press Escape to clear.</span>
```

- [ ] **Step 2: Add live region for results**

In `index.html`, add after the results div:

```html
<div id="results" class="results" role="region" aria-live="polite" aria-label="Search results"></div>
```

- [ ] **Step 3: Add screen reader only class**

Add to `style.css`:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 4: Add ARIA to mode buttons**

In `index.html`, update mode buttons to have `aria-pressed`:

```html
<button class="mode active" data-mode="keyword" aria-pressed="true" title="SQL LIKE search — fast, exact matches">
  <span class="mode-icon" aria-hidden="true">🔤</span> Keyword
</button>
```

- [ ] **Step 5: Update mode selection in app.js**

Add ARIA state management in mode button click handler:

```javascript
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    modeButtons.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    currentMode = btn.dataset.mode;
    queryInput.focus();
    if (queryInput.value.trim()) {
      performSearch();
    }
  });
});
```

- [ ] **Step 6: Add skip to content link**

In `index.html`, add at start of `<body>`:

```html
<a href="#query" class="skip-link sr-only">Skip to search</a>
```

Add CSS:

```css
.skip-link:focus {
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 9999;
  padding: 0.5rem 1rem;
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 600;
  border: 2px solid var(--border);
  clip: auto;
  width: auto;
  height: auto;
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/web/frontend/index.html packages/web/frontend/app.js packages/web/frontend/style.css
git commit -m "feat(frontend): add accessibility improvements

ARIA labels, live regions, focus management, skip link."
```

---

## Task 5: Mobile Improvements

**Files:**
- Modify: `packages/web/frontend/style.css` — responsive breakpoints, touch targets

**Interfaces:** None — mobile UX improvements

- [ ] **Step 1: Increase touch targets**

Add to `style.css`:

```css
@media (pointer: coarse) {
  .mode,
  .suggestion,
  .result-card {
    min-height: 44px;
  }
  
  .mode {
    padding: 0.75rem 1rem;
  }
}
```

- [ ] **Step 2: Improve mobile search box**

Update the `@media (max-width: 644px)` section:

```css
@media (max-width: 644px) {
  .app {
    padding: 1rem;
  }

  header h1 {
    font-size: 1.5rem;
  }

  .search-box input {
    font-size: 1rem;
    padding: 1rem 1rem 1rem 3rem;
  }

  .controls {
    flex-direction: column;
    align-items: stretch;
  }

  .mode-selector {
    justify-content: center;
    gap: 0.375rem;
  }

  .mode {
    flex: 1;
    justify-content: center;
    padding: 0.75rem 0.5rem;
    font-size: 0.8rem;
  }

  .search-meta {
    justify-content: center;
    margin-top: 0.5rem;
  }

  .suggestions {
    flex-direction: column;
    align-items: stretch;
  }

  .suggestion {
    width: 100%;
    text-align: center;
  }

  .result-header {
    flex-direction: column;
    gap: 0.5rem;
  }

  .result-score {
    align-self: flex-start;
  }
  
  .welcome {
    padding: 2rem 1rem;
  }
}
```

- [ ] **Step 3: Add safe area padding for notched devices**

Add to `style.css`:

```css
@supports (padding: env(safe-area-inset-bottom)) {
  .app {
    padding-bottom: calc(2rem + env(safe-area-inset-bottom));
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/frontend/style.css
git commit -m "feat(frontend): improve mobile experience

Better touch targets, responsive spacing, safe area support."
```

---

## Task 6: Search History

**Files:**
- Modify: `packages/web/frontend/app.js` — localStorage integration
- Modify: `packages/web/frontend/style.css` — history UI styles
- Modify: `packages/web/frontend/index.html` — history container

**Interfaces:**
- Produces: `searchHistory` array in localStorage
- Consumes: Search queries from input

- [ ] **Step 1: Add history container to HTML**

In `index.html`, add after the suggestions div:

```html
<div id="search-history" class="search-history" style="display: none;">
  <div class="history-header">
    <span class="history-title">Recent Searches</span>
    <button class="history-clear" id="clear-history">Clear</button>
  </div>
  <div class="history-list" id="history-list"></div>
</div>
```

- [ ] **Step 2: Add history CSS**

Add to `style.css`:

```css
.search-history {
  margin-top: 1.5rem;
  text-align: left;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.history-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.history-clear {
  font-size: 0.75rem;
  font-family: var(--font-sans);
  font-weight: 600;
  background: none;
  border: none;
  color: var(--muted-foreground);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
}

.history-clear:hover {
  color: var(--destructive);
}

.history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.history-item {
  padding: 0.5rem 0.875rem;
  font-size: 0.8rem;
  font-family: var(--font-sans);
  font-weight: 500;
  background: var(--card);
  border: 2px solid var(--border);
  color: var(--muted-foreground);
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: var(--shadow-xs);
}

.history-item:hover {
  background: var(--muted);
  color: var(--foreground);
  transform: translate(-1px, -1px);
  box-shadow: var(--shadow-sm);
}
```

- [ ] **Step 3: Add history functions to app.js**

Add after the `loadStats` function:

```javascript
// Search history
const MAX_HISTORY = 8;
const historyDiv = document.getElementById('search-history');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('sce-search-history') || '[]');
  } catch {
    return [];
  }
}

function saveToHistory(query) {
  if (!query || query.length < 2) return;
  
  const history = getHistory();
  const filtered = history.filter(h => h.toLowerCase() !== query.toLowerCase());
  filtered.unshift(query);
  
  if (filtered.length > MAX_HISTORY) {
    filtered.pop();
  }
  
  localStorage.setItem('sce-search-history', JSON.stringify(filtered));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  
  if (history.length === 0) {
    historyDiv.style.display = 'none';
    return;
  }
  
  historyDiv.style.display = 'block';
  historyList.innerHTML = history.map(q => 
    `<button class="history-item" data-query="${escapeHtml(q)}">${escapeHtml(q)}</button>`
  ).join('');
  
  // Add click handlers
  historyList.querySelectorAll('.history-item').forEach(btn => {
    btn.addEventListener('click', () => {
      queryInput.value = btn.dataset.query;
      performSearch();
    });
  });
}

function clearHistory() {
  localStorage.removeItem('sce-search-history');
  renderHistory();
}

clearHistoryBtn.addEventListener('click', clearHistory);
```

- [ ] **Step 4: Call saveToHistory after search**

In the `performSearch` function, add after the try block:

```javascript
// After successful search
saveToHistory(query);
```

- [ ] **Step 5: Render history on load**

Add to the initialization section at bottom:

```javascript
renderHistory();
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/frontend/app.js packages/web/frontend/style.css packages/web/frontend/index.html
git commit -m "feat(frontend): add search history with localStorage

Shows recent searches, click to re-search, clear option."
```

---

## Task 7: Result Improvements

**Files:**
- Modify: `packages/web/frontend/app.js` — expandable cards, copy button
- Modify: `packages/web/frontend/style.css` — expansion and copy styles

**Interfaces:**
- Consumes: Search results from API
- Produces: Expanded card view, clipboard copy

- [ ] **Step 1: Add copy button to results**

Update the result card HTML in `renderResults`:

```javascript
const html = data.hits.map((hit, i) => `
  <div class="result-card" data-chunk-id="${escapeHtml(hit.chunkId || '')}" data-full-text="${escapeHtml(hit.text)}" style="animation: fadeIn 0.2s ease ${i * 0.03}s both">
    <div class="result-header">
      <span class="result-path">${escapeHtml(hit.relativePath)}</span>
      <div class="result-actions">
        <button class="copy-btn" title="Copy text" aria-label="Copy text to clipboard">📋</button>
        <span class="result-score">score: ${formatScore(hit.score)}</span>
      </div>
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
```

- [ ] **Step 2: Add copy button styles**

Add to `style.css`:

```css
.result-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.copy-btn {
  background: var(--muted);
  border: 2px solid var(--border);
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: var(--shadow-xs);
  line-height: 1;
}

.copy-btn:hover {
  background: var(--primary);
  transform: translate(-1px, -1px);
  box-shadow: var(--shadow-sm);
}

.copy-btn.copied {
  background: var(--success);
  color: white;
}
```

- [ ] **Step 3: Add copy click handler**

Add after the result card click handlers in `renderResults`:

```javascript
// Copy button handlers
resultsDiv.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const card = btn.closest('.result-card');
    const text = card.dataset.fullText;
    
    navigator.clipboard.writeText(text).then(() => {
      btn.classList.add('copied');
      btn.textContent = '✓';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = '📋';
      }, 1500);
    });
  });
});
```

- [ ] **Step 4: Add expand/collapse for long text**

Update the result card click handler to toggle expansion:

```javascript
resultsDiv.querySelectorAll('.result-card').forEach(card => {
  card.addEventListener('click', (e) => {
    // Don't expand if clicking copy button
    if (e.target.closest('.copy-btn')) return;
    
    const textEl = card.querySelector('.result-text');
    const isExpanded = card.classList.contains('expanded');
    
    if (isExpanded) {
      card.classList.remove('expanded');
      textEl.innerHTML = highlightText(truncateText(card.dataset.fullText, 400), data.query);
    } else {
      card.classList.add('expanded');
      textEl.innerHTML = highlightText(card.dataset.fullText, data.query);
    }
  });
});
```

- [ ] **Step 5: Add expansion CSS**

Add to `style.css`:

```css
.result-card {
  cursor: pointer;
}

.result-card .result-text {
  max-height: 200px;
  overflow: hidden;
  position: relative;
  transition: max-height 0.3s ease;
}

.result-card .result-text::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(transparent, var(--card));
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.result-card.expanded .result-text {
  max-height: none;
}

.result-card.expanded .result-text::after {
  opacity: 0;
}

.result-card:hover .result-text::after {
  background: linear-gradient(transparent, var(--card));
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/frontend/app.js packages/web/frontend/style.css
git commit -m "feat(frontend): add result improvements

Copy button, expandable cards, better text handling."
```

---

## Task 8: Final Polish

**Files:**
- Modify: `packages/web/frontend/style.css` — final tweaks
- Modify: `packages/web/frontend/index.html` — meta updates

**Interfaces:** None — final review and tweaks

- [ ] **Step 1: Update page title and meta**

In `index.html`, update the title:

```html
<title>SCE — Semantic Context Engine</title>
<meta name="description" content="Search documentation across multiple sources with keyword, semantic, and hybrid modes. Built for AI coding agents.">
```

- [ ] **Step 2: Add hover state for expanded cards**

Add to `style.css`:

```css
.result-card.expanded {
  border-color: var(--primary);
  box-shadow: var(--shadow-lg);
}
```

- [ ] **Step 3: Add transition for history items**

Update `.history-item` transition:

```css
.history-item {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
```

- [ ] **Step 4: Deploy and verify**

```bash
cd packages/web
npx wrangler deploy
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore(frontend): final polish pass

Complete frontend polish: AST removed, highlighting added,
animations improved, accessibility enhanced, mobile optimized,
search history, and result improvements."
```

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Remove AST button | index.html |
| 2 | Search highlighting | app.js, style.css |
| 3 | Better animations | style.css |
| 4 | Accessibility | index.html, app.js, style.css |
| 5 | Mobile improvements | style.css |
| 6 | Search history | index.html, app.js, style.css |
| 7 | Result improvements | app.js, style.css |
| 8 | Final polish | index.html, style.css |

**Total commits:** 8
**Estimated time:** ~2 hours
