const newsList = document.getElementById("newsList");
const statusText = document.getElementById("statusText");
const refreshButton = document.getElementById("refreshButton");
const exportBookmarksButton = document.getElementById("exportBookmarksButton");
const loadMoreButton = document.getElementById("loadMoreButton");
const searchInput = document.getElementById("searchInput");
const sourceFilter = document.getElementById("sourceFilter");
const bookmarksOnly = document.getElementById("bookmarksOnly");
const tickerText = document.getElementById("tickerText");
const template = document.getElementById("newsItemTemplate");

const BOOKMARKS_KEY = "cyberPulseBookmarks";
const PAGE_SIZE = 12;

let allItems = [];
let bookmarkedLinks = new Set(loadBookmarks());
let activeItems = [];
let renderCount = PAGE_SIZE;

function loadBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistBookmarks() {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(Array.from(bookmarkedLinks)));
}

function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function clearList() {
  while (newsList.firstChild) {
    newsList.removeChild(newsList.firstChild);
  }
}

function getSeverity(item) {
  const text = `${item.title || ""} ${item.summary || ""}`.toLowerCase();

  if (/zero-day|rce|critical|actively exploited|ransomware|breach/.test(text)) {
    return "critical";
  }

  if (/vulnerability|cve-|exploit|attack|malware|phishing/.test(text)) {
    return "high";
  }

  if (/patch|advisory|security update|warning|investigation/.test(text)) {
    return "medium";
  }

  return "low";
}

function severityClass(level) {
  return `sev-${level}`;
}

function updateTicker(items) {
  const top = items.slice(0, 10).map((item) => item.title).filter(Boolean);
  if (!top.length) {
    tickerText.textContent = "No headlines available right now.";
    return;
  }

  tickerText.textContent = `${top.join("  |  ")}  |  `;
}

function hydrateSourceFilter(items) {
  const sources = Array.from(new Set(items.map((item) => item.source).filter(Boolean))).sort();
  const current = sourceFilter.value;

  sourceFilter.innerHTML = '<option value="all">All Sources</option>';
  for (const source of sources) {
    const option = document.createElement("option");
    option.value = source;
    option.textContent = source;
    sourceFilter.appendChild(option);
  }

  sourceFilter.value = sources.includes(current) ? current : "all";
}

function filteredItems() {
  const query = searchInput.value.trim().toLowerCase();
  const source = sourceFilter.value;
  const bookmarksMode = bookmarksOnly.checked;

  return allItems.filter((item) => {
    const matchesSource = source === "all" || item.source === source;
    const matchesBookmark = !bookmarksMode || bookmarkedLinks.has(item.link);

    const text = `${item.title || ""} ${item.summary || ""}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);

    return matchesSource && matchesBookmark && matchesQuery;
  });
}

function toggleBookmark(link) {
  if (!link) {
    return;
  }

  if (bookmarkedLinks.has(link)) {
    bookmarkedLinks.delete(link);
  } else {
    bookmarkedLinks.add(link);
  }

  persistBookmarks();
  applyAndRender(false);
}

function renderItems(items) {
  clearList();

  if (!items.length) {
    loadMoreButton.hidden = true;
    return;
  }

  const visibleItems = items.slice(0, renderCount);

  for (const [index, item] of visibleItems.entries()) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.style.animationDelay = `${Math.min(index * 35, 350)}ms`;

    node.querySelector(".source").textContent = item.source || "Unknown Source";
    node.querySelector(".date").textContent = formatDate(item.publishedAt);

    const severity = getSeverity(item);
    const severityNode = node.querySelector(".severity");
    severityNode.textContent = severity;
    severityNode.classList.add(severityClass(severity));

    const title = node.querySelector(".title");
    title.textContent = item.title || "Untitled";
    title.href = item.link || "#";

    node.querySelector(".summary").textContent = item.summary || "No summary available.";

    const bookmarkButton = node.querySelector(".bookmark-button");
    const isSaved = bookmarkedLinks.has(item.link);
    bookmarkButton.textContent = isSaved ? "Bookmarked" : "Bookmark";
    bookmarkButton.classList.toggle("active", isSaved);
    bookmarkButton.addEventListener("click", () => toggleBookmark(item.link));

    newsList.appendChild(node);
  }

  loadMoreButton.hidden = visibleItems.length >= items.length;
}

function applyAndRender(resetCount = true) {
  if (resetCount) {
    renderCount = PAGE_SIZE;
  }

  const items = filteredItems();
  activeItems = items;
  renderItems(items);
  return items.length;
}

function exportBookmarks() {
  const bookmarkedItems = allItems.filter((item) => bookmarkedLinks.has(item.link));
  if (!bookmarkedItems.length) {
    statusText.textContent = "No bookmarks to export yet.";
    return;
  }

  const fileName = `cyberpulse-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(bookmarkedItems, null, 2)], {
    type: "application/json;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  statusText.textContent = `Exported ${bookmarkedItems.length} bookmarks to ${fileName}.`;
}

function loadMore() {
  if (renderCount >= activeItems.length) {
    return;
  }

  renderCount += PAGE_SIZE;
  renderItems(activeItems);
  statusText.textContent = `Showing ${Math.min(renderCount, activeItems.length)} of ${activeItems.length} matching stories.`;
}

async function loadNews() {
  refreshButton.disabled = true;
  statusText.textContent = "Pulling threat intelligence streams...";

  try {
    const response = await fetch("/api/news");

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const payload = await response.json();
    allItems = payload.items || [];

    hydrateSourceFilter(allItems);
    updateTicker(allItems);
    const visible = applyAndRender(true);

    const updated = payload.generatedAt ? formatDate(payload.generatedAt) : "just now";
    statusText.textContent = `Feed synced at ${updated} (${visible} matching stories).`;
  } catch {
    clearList();
    loadMoreButton.hidden = true;
    tickerText.textContent = "Feed offline. Unable to populate ticker.";
    statusText.textContent = "Feed offline. Check function logs and source availability.";
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", loadNews);
exportBookmarksButton.addEventListener("click", exportBookmarks);
loadMoreButton.addEventListener("click", loadMore);
searchInput.addEventListener("input", () => {
  const visible = applyAndRender(true);
  statusText.textContent = `Showing ${Math.min(renderCount, visible)} of ${visible} matching stories.`;
});
sourceFilter.addEventListener("change", () => {
  const visible = applyAndRender(true);
  statusText.textContent = `Showing ${Math.min(renderCount, visible)} of ${visible} matching stories.`;
});
bookmarksOnly.addEventListener("change", () => {
  const visible = applyAndRender(true);
  statusText.textContent = `Showing ${Math.min(renderCount, visible)} of ${visible} matching stories.`;
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadMore();
        }
      }
    },
    { rootMargin: "120px 0px" }
  );
  observer.observe(loadMoreButton);
}

loadNews();
