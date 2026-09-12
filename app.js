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

  // ---------------------------------------------------------------------
  // My Lexicon: words you type in yourself, from outside your books.
  // Stored in localStorage - completely separate from data.json, so
  // regenerating that file from new Moon Reader exports never touches it.
  // ---------------------------------------------------------------------

  const LEXICON_KEY = "myLexicon";

  function getLexicon() {
    try {
      const raw = localStorage.getItem(LEXICON_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLexicon(words) {
    try {
      localStorage.setItem(LEXICON_KEY, JSON.stringify(words));
    } catch (e) {
      // Storage full or unavailable - the word just won't persist.
    }
  }

  function addLexiconWord(word) {
    const key = word.trim();
    if (!key) return;
    const words = getLexicon();
    const exists = words.some((w) => w.toLowerCase() === key.toLowerCase());
    if (!exists) {
      words.push(key);
      words.sort((a, b) => a.localeCompare(b));
      saveLexicon(words);
    }
  }

  function removeLexiconWord(word) {
    saveLexicon(getLexicon().filter((w) => w !== word));
  }

  function attachLexiconHandlers() {
    const addBtn = document.getElementById("lexiconAddBtn");
    const input = document.getElementById("lexiconInput");
    if (addBtn && input) {
      const doAdd = () => {
        const word = input.value.trim();
        if (!word) return;
        addLexiconWord(word);
        render();
      };
      addBtn.addEventListener("click", doAdd);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doAdd();
      });
    }
    document.querySelectorAll(".lex-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeLexiconWord(btn.dataset.word);
        render();
      });
    });
  }

  function render() {
    const matching = getFiltered();
    const quoteCount = matching.filter((r) => r.kind === "quote").length;
    const vocabCount = matching.filter((r) => r.kind === "vocabulary").length;
    const lexiconWords = getLexicon();

    const totalQuotes = allData.filter((r) => r.kind === "quote").length;
    const totalVocab = allData.filter((r) => r.kind === "vocabulary").length;
    const totalBooks = new Set(allData.map((r) => r.book)).size;
    subhead.textContent =
      totalQuotes + " quotes and " + totalVocab + " words collected, from " + totalBooks + " books.";

    tabs.querySelectorAll("button").forEach((btn) => {
      const k = btn.dataset.kind;
      btn.classList.toggle("active", k === state.kind);
      let count, label;
      if (k === "all") { count = quoteCount + vocabCount; label = "All"; }
      else if (k === "quote") { count = quoteCount; label = "Quotes"; }
      else if (k === "vocabulary") { count = vocabCount; label = "Vocabulary"; }
      else { count = lexiconWords.length; label = "My Lexicon"; }
      btn.textContent = label + " (" + count + ")";
    });

    // The book filter doesn't apply to your own typed-in lexicon.
    bookSelect.style.display = state.kind === "lexicon" ? "none" : "";
    searchInput.placeholder =
      state.kind === "lexicon" ? "Search your lexicon..." : "Search your commonplace book...";

    let html = "";
    shareRegistry = [];

    if (state.kind === "lexicon") {
      const filtered = state.q
        ? lexiconWords.filter((w) => w.toLowerCase().includes(state.q.toLowerCase()))
        : lexiconWords;

      html +=
        '<div class="lexicon-add">' +
        '<input type="text" id="lexiconInput" placeholder="Add a word to your lexicon..." autocomplete="off">' +
        '<button id="lexiconAddBtn">Add</button>' +
        "</div>";

      if (!filtered.length) {
        html +=
          '<p class="empty">' +
          (lexiconWords.length ? "No matches." : "No words yet \u2014 type one above to start your lexicon.") +
          "</p>";
      } else {
        html += '<div class="word-grid">';
        filtered.forEach((w) => {
          html +=
            '<span class="word-tag lex-tag" data-word="' +
            escapeHtml(w) +
            '" tabindex="0">' +
            escapeHtml(w) +
            '<button class="lex-delete" data-word="' +
            escapeHtml(w) +
            '" title="Remove">\u00d7</button></span>';
        });
        html += "</div>";
      }

      content.innerHTML = html;
      attachWordTagHandlers();
      attachLexiconHandlers();
      return;
    }

    const rows = state.kind === "all" ? matching : matching.filter((r) => r.kind === state.kind);

    if (!rows.length) {
      content.innerHTML = '<p class="empty">Nothing here yet. Try a different search or book.</p>';
      return;
    }

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
          html +=
            '<span class="word-tag" data-word="' +
            escapeHtml(w.highlight_text) +
            '" tabindex="0">' +
            escapeHtml(w.highlight_text) +
            "</span>";
        });
        html += "</div></div>";
      });
    } else {
      rows.forEach((r) => {
        if (r.kind === "quote") {
          const idx = shareRegistry.length;
          shareRegistry.push({ text: r.highlight_text, book: r.book });
          html +=
            '<div class="quote-card"><p class="text">' +
            escapeHtml(r.highlight_text) +
            '</p><div class="cite-row"><button class="share-btn" data-share-idx="' +
            idx +
            '">Share</button><div class="cite">' +
            escapeHtml(r.book) +
            "</div></div></div>";
        } else {
          html +=
            '<div class="word-grid" style="margin-bottom:1.1rem;"><span class="word-tag" data-word="' +
            escapeHtml(r.highlight_text) +
            '" tabindex="0">' +
            escapeHtml(r.highlight_text) +
            "</span></div>";
        }
      });
    }
    content.innerHTML = html;
    attachWordTagHandlers();
    attachShareHandlers();
  }

  let shareRegistry = [];

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
    const word = tag.dataset.word || tag.textContent.trim();
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
        if (e.target.classList.contains("lex-delete")) return;
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

  // ---------------------------------------------------------------------
  // Share quote as image: renders a card (app name, quote, book) onto a
  // canvas and downloads it as a PNG.
  // ---------------------------------------------------------------------

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let current = "";
    words.forEach((word) => {
      const test = current ? current + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  async function shareQuoteAsImage(text, book) {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {
        // Fonts may still be loading - proceed anyway with fallback fonts.
      }
    }

    const WIDTH = 1080;
    const PADDING = 90;
    const MAX_TEXT_WIDTH = WIDTH - PADDING * 2;

    const measure = document.createElement("canvas").getContext("2d");
    let fontSize = 54;
    measure.font = 'italic 400 ' + fontSize + 'px "Source Serif 4"';
    let lines = wrapText(measure, text, MAX_TEXT_WIDTH);
    while (lines.length > 12 && fontSize > 34) {
      fontSize -= 4;
      measure.font = 'italic 400 ' + fontSize + 'px "Source Serif 4"';
      lines = wrapText(measure, text, MAX_TEXT_WIDTH);
    }

    const lineHeight = fontSize * 1.42;
    const headerHeight = 150;
    const citeHeight = 110;
    const height = Math.round(headerHeight + lines.length * lineHeight + citeHeight + PADDING);

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ECE4D3";
    ctx.fillRect(0, 0, WIDTH, height);

    ctx.fillStyle = "#7C2D2D";
    ctx.fillRect(0, 0, 14, height);

    ctx.fillStyle = "#2B2620";
    ctx.font = '600 40px "Fraunces"';
    ctx.fillText("Commonplace", PADDING, 96);

    ctx.strokeStyle = "#C8BB98";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PADDING, headerHeight - 20);
    ctx.lineTo(WIDTH - PADDING, headerHeight - 20);
    ctx.stroke();

    ctx.font = 'italic 400 ' + fontSize + 'px "Source Serif 4"';
    ctx.fillStyle = "#2B2620";
    let y = headerHeight + fontSize;
    lines.forEach((line) => {
      ctx.fillText(line, PADDING, y);
      y += lineHeight;
    });

    ctx.font = 'italic 400 30px "IBM Plex Mono"';
    ctx.fillStyle = "#6B6252";
    ctx.textAlign = "right";
    ctx.fillText("\u2014 " + book, WIDTH - PADDING, height - 50);
    ctx.textAlign = "left";

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "commonplace-quote.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function attachShareHandlers() {
    document.querySelectorAll(".share-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = shareRegistry[Number(btn.dataset.shareIdx)];
        if (item) shareQuoteAsImage(item.text, item.book);
      });
    });
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }

  loadData();
})();
