(function () {
  let allData = [];
  const state = { kind: "all", q: "", book: "" };

  const subhead = document.getElementById("subhead");
  const tabs = document.getElementById("tabs");
  const searchInput = document.getElementById("searchInput");
  const bookSelect = document.getElementById("bookSelect");
  const content = document.getElementById("content");

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function loadData() {
    return fetch("data.json", { cache: "no-cache" })
      .then((r) => r.json())
      .then((data) => {
        allData = data;
        init();
      })
      .catch(() => {
        content.innerHTML =
          '<p class="empty">Couldn\u2019t load your data. Make sure data.json is sitting next to index.html.</p>';
      });
  }

  function init() {
    const books = [...new Set(allData.map((r) => r.book))].sort();
    books.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      bookSelect.appendChild(opt);
    });
    render();
  }

  function getFiltered() {
    return allData.filter((r) => {
      if (state.book && r.book !== state.book) return false;
      if (state.q) {
        const q = state.q.toLowerCase();
        const hay = (r.highlight_text + " " + (r.note_text || "") + " " + r.book).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function render() {
    const matching = getFiltered();
    const quoteCount = matching.filter((r) => r.kind === "quote").length;
    const vocabCount = matching.filter((r) => r.kind === "vocabulary").length;

    const totalQuotes = allData.filter((r) => r.kind === "quote").length;
    const totalVocab = allData.filter((r) => r.kind === "vocabulary").length;
    const totalBooks = new Set(allData.map((r) => r.book)).size;
    subhead.textContent =
      totalQuotes + " quotes and " + totalVocab + " words collected, from " + totalBooks + " books.";

    tabs.querySelectorAll("button").forEach((btn) => {
      const k = btn.dataset.kind;
      btn.classList.toggle("active", k === state.kind);
      const count = k === "all" ? quoteCount + vocabCount : k === "quote" ? quoteCount : vocabCount;
      const label = k === "all" ? "All" : k === "quote" ? "Quotes" : "Vocabulary";
      btn.textContent = label + " (" + count + ")";
    });

    const rows = state.kind === "all" ? matching : matching.filter((r) => r.kind === state.kind);

    if (!rows.length) {
      content.innerHTML = '<p class="empty">Nothing here yet. Try a different search or book.</p>';
      return;
    }

    let html = "";
    if (state.kind === "vocabulary") {
      const byBook = new Map();
      rows.forEach((r) => {
        if (!byBook.has(r.book)) byBook.set(r.book, []);
        byBook.get(r.book).push(r);
      });
      byBook.forEach((words, book) => {
        html += '<div class="vocab-group">';
        if (!state.book) html += "<h2>" + escapeHtml(book) + "</h2>";
        html += '<div class="word-grid">';
        words.forEach((w) => {
          html += '<span class="word-tag" tabindex="0">' + escapeHtml(w.highlight_text) + "</span>";
        });
        html += "</div></div>";
      });
    } else {
      rows.forEach((r) => {
        if (r.kind === "quote") {
          html +=
            '<div class="quote-card"><p class="text">' +
            escapeHtml(r.highlight_text) +
            '</p><div class="cite">' +
            escapeHtml(r.book) +
            "</div></div>";
        } else {
          html +=
            '<div class="word-grid" style="margin-bottom:1.1rem;"><span class="word-tag" tabindex="0">' +
            escapeHtml(r.highlight_text) +
            "</span></div>";
        }
      });
    }
    content.innerHTML = html;
    attachWordTagHandlers();
  }

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.kind = btn.dataset.kind;
    render();
  });
  searchInput.addEventListener("input", () => {
    state.q = searchInput.value;
    render();
  });
  bookSelect.addEventListener("change", () => {
    state.book = bookSelect.value;
    render();
  });

  // ---------------------------------------------------------------------
  // Definitions: same two-source strategy as the local Flask version
  // (dictionaryapi.dev, falling back to datamuse.com), but called
  // directly from the browser and cached in localStorage instead of a
  // server-side database, since there's no server here.
  // ---------------------------------------------------------------------

  const DICTIONARY_API = "https://api.dictionaryapi.dev/api/v2/entries/en/";
  const DATAMUSE_API = "https://api.datamuse.com/words?md=d&max=1&sp=";
  const DATAMUSE_POS = { n: "noun", v: "verb", adj: "adjective", adv: "adverb", u: "" };

  function cacheGet(word) {
    try {
      const raw = localStorage.getItem("def:" + word);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function cacheSet(word, data) {
    try {
      localStorage.setItem("def:" + word, JSON.stringify(data));
    } catch (e) {
      // Storage full or unavailable - lookups still work, just uncached.
    }
  }

  function simplifyDictionaryApi(entry) {
    return {
      word: entry.word || "",
      phonetic: entry.phonetic || "",
      meanings: (entry.meanings || []).slice(0, 3).map((m) => ({
        partOfSpeech: m.partOfSpeech || "",
        definitions: (m.definitions || []).slice(0, 2).map((d) => ({
          definition: d.definition || "",
          example: d.example || "",
        })),
      })),
    };
  }

  function tryDictionaryApi(word) {
    return fetch(DICTIONARY_API + encodeURIComponent(word))
      .then((r) => {
        if (r.status === 404) return { error: "No definition found." };
        if (!r.ok) return null;
        return r.json().then((raw) => (raw && raw[0] ? simplifyDictionaryApi(raw[0]) : { error: "No definition found." }));
      })
      .catch(() => null);
  }

  function tryDatamuse(word) {
    return fetch(DATAMUSE_API + encodeURIComponent(word))
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        if (!raw || !raw[0] || !raw[0].defs || !raw[0].defs.length) return { error: "No definition found." };
        const meanings = raw[0].defs.slice(0, 4).map((d) => {
          const idx = d.indexOf("\t");
          const pos = idx >= 0 ? d.slice(0, idx) : "";
          const definition = idx >= 0 ? d.slice(idx + 1) : d;
          return { partOfSpeech: DATAMUSE_POS[pos] || pos, definitions: [{ definition: definition, example: "" }] };
        });
        return { word: raw[0].word || word, phonetic: "", meanings: meanings };
      })
      .catch(() => null);
  }

  function fetchDefinition(word) {
    const key = word.trim().toLowerCase();
    const cached = cacheGet(key);
    if (cached && (!cached.error || cached.error === "No definition found.")) {
      return Promise.resolve(cached);
    }
    return tryDictionaryApi(key).then((result) => {
      if (result === null || (result && result.error === "No definition found.")) {
        return tryDatamuse(key).then((fallback) => {
          let finalResult = result;
          if (fallback !== null && (!fallback.error || result === null)) finalResult = fallback;
          if (finalResult === null) {
            finalResult = { error: "Couldn't reach either dictionary source - check your connection." };
          }
          if (!finalResult.error || finalResult.error === "No definition found.") cacheSet(key, finalResult);
          return finalResult;
        });
      }
      if (!result.error) cacheSet(key, result);
      return result;
    });
  }

  // ---------------------------------------------------------------------
  // Popover
  // ---------------------------------------------------------------------

  const popover = document.createElement("div");
  popover.className = "def-popover";
  document.body.appendChild(popover);
  let hoverTimer = null;
  let activeTag = null;

  function renderDef(data) {
    if (data.error) {
      popover.innerHTML = '<div class="def-error">' + escapeHtml(data.error) + "</div>";
      return;
    }
    let html = "";
    if (data.phonetic) html += '<div class="def-phonetic">' + escapeHtml(data.phonetic) + "</div>";
    (data.meanings || []).forEach((m) => {
      if (m.partOfSpeech) html += '<div class="def-pos">' + escapeHtml(m.partOfSpeech) + "</div>";
      (m.definitions || []).forEach((d) => {
        if (d.definition) html += '<div class="def-text">' + escapeHtml(d.definition) + "</div>";
        if (d.example) html += '<div class="def-example">\u201c' + escapeHtml(d.example) + "\u201d</div>";
      });
    });
    popover.innerHTML = html || '<div class="def-error">No definition found.</div>';
  }

  function position(tag) {
    const rect = tag.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - 330;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    popover.style.left = left + "px";
    popover.style.top = rect.bottom + window.scrollY + 8 + "px";
  }

  function showFor(tag) {
    const word = tag.textContent.trim();
    activeTag = tag;
    position(tag);
    popover.classList.add("visible");
    popover.innerHTML = '<div class="def-loading">Looking up \u201c' + escapeHtml(word) + "\u201d\u2026</div>";
    fetchDefinition(word).then((data) => {
      if (activeTag === tag) renderDef(data);
    });
  }

  function hide() {
    popover.classList.remove("visible");
    activeTag = null;
  }

  function attachWordTagHandlers() {
    document.querySelectorAll(".word-tag").forEach((tag) => {
      tag.addEventListener("click", (e) => {
        e.stopPropagation();
        if (activeTag === tag && popover.classList.contains("visible")) hide();
        else showFor(tag);
      });
      tag.addEventListener("mouseenter", () => {
        hoverTimer = setTimeout(() => showFor(tag), 550);
      });
      tag.addEventListener("mouseleave", () => clearTimeout(hoverTimer));
    });
  }

  document.addEventListener("click", (e) => {
    if (!popover.contains(e.target) && !e.target.classList.contains("word-tag")) hide();
  });
  window.addEventListener(
    "scroll",
    () => {
      if (activeTag) position(activeTag);
    },
    true
  );

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }

  loadData();
})();
