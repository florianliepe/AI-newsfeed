
const DATA_FILES = [
  "./data/batch1.json",
  "./data/batch2.json",
  "./data/batch3.json",
  "./data/batch4.json"
];
const NEWS_FILE = "./data/news.json";

const state = {
  view: "curriculum", // curriculum | news
  curriculum: [],
  news: [],
  filtered: []
};

const els = {
  cards: document.getElementById("cards"),
  toc: document.getElementById("toc"),
  stats: document.getElementById("stats"),
  search: document.getElementById("searchInput"),
  tier: document.getElementById("tierFilter"),
  track: document.getElementById("trackFilter"),
  difficulty: document.getElementById("difficultyFilter"),
  sourceTier: document.getElementById("sourceTierFilter"),
  urgency: document.getElementById("urgencyFilter"),
  clear: document.getElementById("clearFilters"),
  themeToggle: document.getElementById("themeToggle"),
  tabCurriculum: document.getElementById("tabCurriculum"),
  tabNews: document.getElementById("tabNews"),
  curriculumFilters: document.getElementById("curriculumFilters"),
  newsFilters: document.getElementById("newsFilters"),
  curriculumTpl: document.getElementById("curriculumCardTemplate"),
  newsTpl: document.getElementById("newsCardTemplate")
};

// ---------- Theme ----------
(function initTheme() {
  const stored = localStorage.getItem("twin-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
})();
els.themeToggle.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("twin-theme", next);
});

// ---------- Utils ----------
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

function difficultyDots(n = 0) {
  const full = "●".repeat(Number(n));
  const empty = "○".repeat(Math.max(0, 5 - Number(n)));
  return `${full}${empty}`;
}

function parseMarkdownish(text = "") {
  // tiny parser for fenced code blocks + paragraphs
  const parts = String(text).split(/```/g);
  if (parts.length < 3) return `<p>${esc(text)}</p>`;

  let html = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const plain = parts[i].trim();
      if (plain) html += `<p>${esc(plain)}</p>`;
    } else {
      const block = parts[i];
      const lb = block.indexOf("\n");
      let lang = "";
      let code = block;
      if (lb > -1) {
        lang = block.slice(0, lb).trim();
        code = block.slice(lb + 1);
      }
      html += `
        <div class="code-wrap">
          <pre><code data-lang="${esc(lang)}">${esc(code.trim())}</code></pre>
        </div>`;
    }
  }
  return html;
}

function levelClass(v = "none") {
  if (v === "high" || v === "act_now") return "level-high";
  if (v === "medium" || v === "evaluate") return "level-medium";
  if (v === "low" || v === "watch") return "level-low";
  return "level-none";
}

// ---------- Tabs ----------
function setView(view) {
  state.view = view;
  const isCurriculum = view === "curriculum";

  els.tabCurriculum.classList.toggle("active", isCurriculum);
  els.tabNews.classList.toggle("active", !isCurriculum);
  els.curriculumFilters.classList.toggle("hidden", !isCurriculum);
  els.newsFilters.classList.toggle("hidden", isCurriculum);

  applyFilters();
}

els.tabCurriculum.addEventListener("click", () => setView("curriculum"));
els.tabNews.addEventListener("click", () => setView("news"));

// ---------- Data ----------
async function loadAllData() {
  const curriculum = [];
  for (const file of DATA_FILES) {
    try {
      const res = await fetch(file);
      if (!res.ok) continue;
      const json = await res.json();
      if (Array.isArray(json)) curriculum.push(...json);
    } catch (e) {
      console.warn("Could not load", file, e);
    }
  }

  let news = [];
  try {
    const res = await fetch(NEWS_FILE);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) news = json;
    }
  } catch (e) {
    console.warn("Could not load news file", e);
  }

  state.curriculum = curriculum.filter(n => String(n.nugget_id || "").startsWith("AITWIN-"));
  state.news = news.filter(n => String(n.nugget_id || "").startsWith("NEWS-"));
}

// ---------- Filters ----------
function applyFilters() {
  const q = els.search.value.trim().toLowerCase();

  if (state.view === "curriculum") {
    const tier = els.tier.value;
    const track = els.track.value;
    const diffMax = Number(els.difficulty.value || 99);

    state.filtered = state.curriculum.filter(n => {
      if (tier && n.tier !== tier) return false;
      if (track && n.track !== track) return false;
      if (Number(n.difficulty || 0) > diffMax) return false;

      if (!q) return true;
      const hay = [
        n.title, n.concept, n.why_it_matters, n.learn_5min, n.apply_10min,
        ...(n.tags || []), ...(n.key_terms || []), ...(n.okf_standards || [])
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });

  } else {
    const sourceTier = els.sourceTier.value;
    const urgency = els.urgency.value;

    state.filtered = state.news.filter(n => {
      if (sourceTier && n?.source?.tier !== sourceTier) return false;
      if (urgency && n?.impact?.urgency !== urgency) return false;

      if (!q) return true;
      const hay = [
        n.headline, n.summary, n.why_it_matters, n.action,
        n?.source?.name, ...(n.tags || [])
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });

    // newest first
    state.filtered.sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at));
  }

  render();
}

els.search.addEventListener("input", applyFilters);
els.tier.addEventListener("change", applyFilters);
els.track.addEventListener("change", applyFilters);
els.difficulty.addEventListener("change", applyFilters);
els.sourceTier.addEventListener("change", applyFilters);
els.urgency.addEventListener("change", applyFilters);

els.clear.addEventListener("click", () => {
  els.search.value = "";
  els.tier.value = "";
  els.track.value = "";
  els.difficulty.value = "";
  els.sourceTier.value = "";
  els.urgency.value = "";
  applyFilters();
});

// ---------- Render ----------
function render() {
  els.cards.innerHTML = "";
  els.toc.innerHTML = "";

  if (state.view === "curriculum") {
    renderCurriculum();
  } else {
    renderNews();
  }
}

function renderCurriculum() {
  const total = state.curriculum.length;
  const shown = state.filtered.length;
  els.stats.textContent = `${shown} / ${total} curriculum nuggets shown`;

  const sorted = [...state.filtered].sort((a, b) => {
    const na = Number((a.nugget_id || "").split("-")[1] || 999);
    const nb = Number((b.nugget_id || "").split("-")[1] || 999);
    return na - nb;
  });

  const byId = Object.fromEntries(state.curriculum.map(n => [n.nugget_id, n]));

  for (const nugget of sorted) {
    const node = els.curriculumTpl.content.firstElementChild.cloneNode(true);
    const id = nugget.nugget_id;
    node.id = id;

    node.querySelector(".badge.tier").textContent = String(nugget.tier || "").toUpperCase();
    node.querySelector(".badge.track").textContent = String(nugget.track || "").replaceAll("_", " ");
    node.querySelector(".meta.difficulty").textContent = `Difficulty ${difficultyDots(nugget.difficulty)}`;
    node.querySelector(".meta.duration").textContent = `⏱ ${nugget.duration_min || 15} min`;
    node.querySelector(".meta.id").textContent = id;

    node.querySelector(".title").textContent = nugget.title || "";
    node.querySelector(".concept").textContent = nugget.concept || "";
    node.querySelector(".callout.why").innerHTML = `<strong>Why it matters:</strong> ${esc(nugget.why_it_matters || "")}`;

    node.querySelector(".chips.keyterms").innerHTML =
      (nugget.key_terms || []).map(k => `<span class="chip">${esc(k)}</span>`).join("");

    node.querySelector(".chips.standards").innerHTML =
      (nugget.okf_standards || []).map(s => `<span class="chip">OKF: ${esc(s)}</span>`).join("");

    node.querySelector(".mini-card.learn").innerHTML =
      `<strong>⏱ Learn (5 min)</strong><br>${esc(nugget.learn_5min || "")}`;

    node.querySelector(".mini-card.apply").innerHTML =
      `<strong>⏱ Apply (10 min)</strong><br>${parseMarkdownish(nugget.apply_10min || "")}`;

    node.querySelector(".refs").innerHTML = (nugget.reference_projects || []).map(r => `
      <div class="mini-card" style="margin-top:.5rem">
        <strong><a href="${esc(r.url || "#")}" target="_blank" rel="noopener">${esc(r.name || "Project")}</a></strong><br>
        ${esc(r.description || "")}
      </div>
    `).join("");

    node.querySelector(".resources").innerHTML = (nugget.resources || []).map(r => `
      <li><span class="chip">${esc(r.type || "resource")}</span>
      <a href="${esc(r.url || "#")}" target="_blank" rel="noopener">${esc(r.title || r.url || "Link")}</a></li>
    `).join("");

    node.querySelector(".callout.consulting").innerHTML =
      `💼 <strong>Consulting angle:</strong> ${esc(nugget.consulting_angle || "")}`;

    node.querySelector(".callout.hook").innerHTML =
      `🧬 <strong>Twin platform hook:</strong> ${esc(nugget.twin_platform_hook || "")}`;

    node.querySelector(".chips.tags").innerHTML =
      (nugget.tags || []).map(t => `<span class="chip">#${esc(t)}</span>`).join("");

    const nextId = nugget.next_nugget_id;
    const nextEl = node.querySelector(".next-link");
    if (nextId && byId[nextId]) {
      nextEl.innerHTML = `Next: <a href="#${esc(nextId)}">${esc(nextId)}</a>`;
    } else {
      nextEl.textContent = "End of sequence";
    }

    node.querySelector(".copy-json").addEventListener("click", async () => {
      await navigator.clipboard.writeText(JSON.stringify(nugget, null, 2));
      alert(`${id} JSON copied`);
    });

    els.cards.appendChild(node);

    const tocA = document.createElement("a");
    tocA.href = `#${id}`;
    tocA.textContent = `${id} · ${nugget.title || "Untitled"}`;
    els.toc.appendChild(tocA);
  }
}

function renderNews() {
  const total = state.news.length;
  const shown = state.filtered.length;
  els.stats.textContent = `${shown} / ${total} news nuggets shown`;

  for (const n of state.filtered) {
    const node = els.newsTpl.content.firstElementChild.cloneNode(true);
    node.id = n.nugget_id;

    node.querySelector(".badge.source-tier").textContent = `Tier ${n?.source?.tier || "?"}`;
    node.querySelector(".meta.captured").textContent = n.captured_at || "";
    node.querySelector(".meta.id").textContent = n.nugget_id || "";

    node.querySelector(".title").textContent = n.headline || "";
    node.querySelector(".source-line").innerHTML =
      `Source: <a href="${esc(n?.source?.url || "#")}" target="_blank" rel="noopener">${esc(n?.source?.name || "Unknown")}</a>`;
    node.querySelector(".summary").textContent = n.summary || "";
    node.querySelector(".callout.why").innerHTML =
      `<strong>Why it matters:</strong> ${esc(n.why_it_matters || "")}`;

    const impact = n.impact || {};
    node.querySelector(".impact-grid").innerHTML = `
      <div class="impact-cell ${levelClass(impact.twin_platform)}">
        <strong>Twin Platform</strong>${esc(String(impact.twin_platform || "none").toUpperCase())}
      </div>
      <div class="impact-cell ${levelClass(impact.consulting_offering)}">
        <strong>Consulting</strong>${esc(String(impact.consulting_offering || "none").toUpperCase())}
      </div>
      <div class="impact-cell ${levelClass(impact.urgency)}">
        <strong>Urgency</strong>${esc(String(impact.urgency || "watch").toUpperCase())}
      </div>`;

    node.querySelector(".callout.action").innerHTML =
      `✅ <strong>Action:</strong> ${esc(n.action || "none")}`;

    node.querySelector(".chips.related").innerHTML =
      (n.related_nugget_ids || []).map(id => `<span class="chip">${esc(id)}</span>`).join("");

    node.querySelector(".chips.tags").innerHTML =
      (n.tags || []).map(t => `<span class="chip">#${esc(t)}</span>`).join("");

    node.querySelector(".copy-json").addEventListener("click", async () => {
      await navigator.clipboard.writeText(JSON.stringify(n, null, 2));
      alert(`${n.nugget_id} JSON copied`);
    });

    els.cards.appendChild(node);

    const tocA = document.createElement("a");
    tocA.href = `#${n.nugget_id}`;
    tocA.textContent = `${n.nugget_id} · ${n.headline || "Untitled"}`;
    els.toc.appendChild(tocA);
  }
}

// ---------- Boot ----------
(async function init() {
  await loadAllData();
  setView("curriculum");
})();
