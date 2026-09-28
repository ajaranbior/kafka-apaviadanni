// Reader for «Прысуд». The book text comes from book/book.json next to the page.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const PREFS_KEY = "kafka-reader:prefs";
  const POS_KEY = "kafka-reader:pos";

  let book = null;
  let works = [];        // flat list: {work, group, index}
  let current = null;

  // ---------- small storage helpers (all optional: private windows may refuse) ----------
  const prefs = Object.assign({ font: 20, theme: null, toc: true, ortho: "narkam" }, readJSON(PREFS_KEY));
  // book text in the chosen orthography (наркамаўка as printed, тарашкевіца or łacinka converted)
  const T = (text) => (window.Orthography ? Orthography.convert(text, prefs.ortho) : text);
  const LANG = { narkam: "be", tarask: "be-tarask", lacinka: "be-Latn" };
  const SITE_TITLE = document.title;
  const SITE_NAME = "Кафка па-беларуску";  // after a work's title in the tab
  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not critical */ }
  }

  // ---------- loading ----------
  function validate(data) {
    if (!data || !Array.isArray(data.groups) || !data.groups.some((g) => g.works && g.works.length)) {
      throw new Error("Гэта не падобна на book.json для гэтай чытанкі.");
    }
    return data;
  }

  async function boot() {
    applyPrefs();
    try {
      const res = await fetch("book/book.json", { cache: "no-cache" });  // revalidated, so fixes show at once
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      start(validate(await res.json()));
    } catch {
      showLoader();
    }
  }

  function showLoader() {
    closeToc({ remember: false });
    $("toc-open").disabled = true;
    $("loader").hidden = false;
    $("reader").hidden = true;
    updateBarWork();
  }


  // ---------- building the UI ----------
  function start(data) {
    book = data;
    if (window.Orthography) Orthography.setFirstStressed(book.firstStressed);
    works = [];
    book.groups.forEach((group) => group.works.forEach((work) => works.push({ work, group, index: works.length })));
    buildToc();
    $("toc-filter").value = "";
    filterToc();
    $("loader").hidden = true;
    $("reader").hidden = false;
    $("toc-open").disabled = false;
    route();
    if (wide.matches && prefs.toc !== false) openToc({ focus: false, remember: false });
  }

  function el(tag, props = {}, text) {
    const node = Object.assign(document.createElement(tag), props);
    if (text != null) node.textContent = text;
    return node;
  }

  // a paragraph of the book; "[^1]" marks a footnote, kept in work.notes and opened below the paragraph
  function paragraph(para, className, notes) {
    const node = el("p", { className });
    const opened = [];
    para.split(/(\[\^\w+\])/).forEach((piece) => {
      const ref = piece.match(/^\[\^(\w+)\]$/);
      if (!ref || !notes || !notes[ref[1]]) { node.append(T(piece)); return; }
      const id = `note-${ref[1]}`;
      const btn = el("button", { type: "button", className: "fn", title: T(notes[ref[1]]) }, ref[1]);
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", id);
      btn.setAttribute("aria-label", `${T("Заўвага")} ${ref[1]}`);
      const note = el("span", { className: "fn-note", id, hidden: true }, T(notes[ref[1]]));
      btn.addEventListener("click", () => {
        note.hidden = !note.hidden;
        btn.setAttribute("aria-expanded", String(!note.hidden));
      });
      node.append(btn);
      opened.push(note);
    });
    node.append(...opened);
    return node;
  }

  function buildToc() {
    const list = $("toc-list");
    list.replaceChildren();
    book.groups.forEach((group) => {
      const label = el("div", { className: "toc-group" }, T(group.title));
      list.append(label);
      group.works.forEach((w) => {
        const btn = el("button", { className: "toc-work", type: "button" });
        btn.dataset.id = w.id;
        btn.dataset.key = fold(`${T(w.title)} ${w.title} ${w.id}`);
        btn.groupLabel = label;
        btn.append(el("span", { className: "toc-title" }, T(w.title)));
        if (w.date) btn.append(el("small", {}, w.date));
        btn.addEventListener("click", () => { go(w.id); if (!wide.matches) closeToc(); });
        list.append(btn);
      });
    });
  }

  // ---------- search in the contents panel ----------
  // case-insensitive; ё/е, ў/у and the various apostrophes count as the same letter
  const fold = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l").replace(/[’ʼ`]/g, "'");

  function filterToc() {
    const q = fold($("toc-filter").value.trim());
    const buttons = [...document.querySelectorAll(".toc-work")];
    const shownGroups = new Set();
    let shown = 0;
    buttons.forEach((b) => {
      const title = b.querySelector(".toc-title");
      const text = title.textContent;
      const hit = !q || b.dataset.key.includes(q);
      b.hidden = !hit;
      if (hit) { shown++; shownGroups.add(b.groupLabel); }
      // highlight the match inside the title (the folded text keeps the same length)
      const at = q ? fold(text).indexOf(q) : -1;
      if (at >= 0) {
        title.replaceChildren(text.slice(0, at), el("mark", {}, text.slice(at, at + q.length)), text.slice(at + q.length));
      } else if (title.childElementCount) {
        title.textContent = text;
      }
    });
    document.querySelectorAll(".toc-group").forEach((g) => { g.hidden = !shownGroups.has(g); });
    $("toc-empty").hidden = shown > 0;
    $("toc-list").hidden = shown === 0;
  }

  $("toc-filter").addEventListener("input", filterToc);
  $("toc-filter").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = document.querySelector(".toc-work:not([hidden])");
      if (first) first.click();
    } else if (e.key === "Escape" && e.target.value) {
      e.stopPropagation();
      e.target.value = "";
      filterToc();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const first = document.querySelector(".toc-work:not([hidden])");
      if (first) first.focus();
    }
  });

  // ---------- routing: #/<work-id>[/<part-number>] ----------
  function parseHash() {
    const [, id, part] = location.hash.match(/^#\/([\w-]+)(?:\/(\d+))?/) || [];
    return { id, part: part ? Number(part) : null };
  }

  function go(id, part) {
    const hash = `#/${id}${part ? "/" + part : ""}`;
    if (location.hash === hash) route(); else location.hash = hash;
  }

  function route() {
    if (!book) return;
    let { id, part } = parseHash();
    let restoreScroll = null;
    if (!id) {
      const pos = readJSON(POS_KEY);
      id = pos.id && works.some((w) => w.work.id === pos.id) ? pos.id : (book.landing || works[0].work.id);
      restoreScroll = pos.id === id ? pos.scroll : null;
      history.replaceState(null, "", `#/${id}`);
    }
    const entry = works.find((w) => w.work.id === id) || works[0];
    if (current !== entry) render(entry);
    if (part) {
      const target = document.getElementById(`part-${part}`);
      if (target) target.scrollIntoView();
    } else if (restoreScroll != null) {
      requestAnimationFrame(() => window.scrollTo(0, restoreScroll * docHeight()));
    } else if (current !== entry || !part) {
      window.scrollTo(0, 0);
    }
    current = entry;
    savePosition();
  }

  function render(entry) {
    const { work, group, index } = entry;
    document.title = `${T(work.title)} — ${T(SITE_NAME)}`;
    $("work-group").textContent = T(group.title);
    $("work-title").textContent = T(work.title);
    $("work-meta").textContent = [work.author && T(work.author), work.date && `(${work.date})`].filter(Boolean).join(" · ");

    const parts = $("parts");
    parts.replaceChildren();
    const titled = work.parts.filter((p) => p.title);
    if (titled.length > 1) {
      work.parts.forEach((p, i) => {
        if (!p.title) return;
        const a = el("a", { href: `#/${work.id}/${i + 1}` }, p.title);
        a.dataset.part = String(i + 1);
        parts.append(a);
      });
    }

    const text = $("text");
    text.replaceChildren();
    if (index === 0 && book.source) {
      const note = el("p", { className: "source-note" }, `${T(book.source.label)} `);
      note.append(el("a", { href: book.source.url, target: "_blank", rel: "noopener" }, book.source.name));
      text.append(note);
    }
    if (work.dedication) text.append(el("p", { className: "dedication" }, T(work.dedication)));
    work.parts.forEach((p, i) => {
      if (p.title) text.append(el("h2", { className: "part-title", id: `part-${i + 1}` }, p.title));
      let verse = null;  // consecutive verse lines share one block
      p.paragraphs.forEach((para, j) => {
        if (p.verse && p.verse.includes(j)) {
          if (!verse) text.append(verse = el("div", { className: "verse" }));
          verse.append(paragraph(para, "", work.notes));
          return;
        }
        verse = null;
        const signed = p.signatures && p.signatures.includes(j);  // a letter's sign-off, flush right
        text.append(paragraph(para, signed ? "sign-off" : j === 0 && !p.title ? "first" : "", work.notes));
      });
    });
    if (work.author) text.append(el("p", { className: "signature" }, T(work.author)));

    const prev = works[index - 1], next = works[index + 1];
    $("prev").hidden = !prev;
    $("next").hidden = !next;
    if (prev) $("prev-title").textContent = T(prev.work.title);
    if (next) $("next-title").textContent = T(next.work.title);

    document.querySelectorAll(".toc-work").forEach((b) => b.setAttribute("aria-current", String(b.dataset.id === work.id)));
    const curBtn = document.querySelector('.toc-work[aria-current="true"]');
    if (curBtn && tocIsOpen()) curBtn.scrollIntoView({ block: "nearest" });
    current = entry;
    onScroll();
  }

  $("prev").addEventListener("click", () => current && works[current.index - 1] && go(works[current.index - 1].work.id));
  $("next").addEventListener("click", () => current && works[current.index + 1] && go(works[current.index + 1].work.id));
  window.addEventListener("hashchange", route);

  // ---------- reading position & progress ----------
  const docHeight = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
  let saveTimer = null;
  function savePosition() {
    if (!current) return;
    writeJSON(POS_KEY, { id: current.work.id, scroll: scrollY / docHeight() });
  }
  function onScroll() {
    $("progress").style.width = `${Math.min(100, (scrollY / docHeight()) * 100)}%`;
    highlightPart();
    updateBarWork();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(savePosition, 300);
  }
  function highlightPart() {
    const heads = [...document.querySelectorAll(".part-title")];
    let active = null;
    heads.forEach((h) => { if (h.getBoundingClientRect().top < innerHeight * 0.4) active = h.id.replace("part-", ""); });
    document.querySelectorAll(".parts a").forEach((a) => a.setAttribute("aria-current", String(a.dataset.part === active)));
    activePart = active;
  }
  let activePart = null;

  // the bar shows the work's title (and part) only once the heading on the page is out of view
  function updateBarWork() {
    const bar = $("bar-work");
    const title = $("work-title");
    const shown = !!current && !$("reader").hidden &&
      title.getBoundingClientRect().bottom < document.querySelector(".bar").offsetHeight;
    bar.classList.toggle("shown", shown);
    bar.setAttribute("aria-hidden", String(!shown));
    bar.tabIndex = shown ? 0 : -1;
    if (!shown) return;
    const part = activePart && current.work.parts[activePart - 1];
    const label = [T(current.work.title), part && part.title].filter(Boolean).join(" · ");
    if (bar.dataset.label === label) return;
    bar.dataset.label = label;
    bar.replaceChildren(T(current.work.title));
    if (part && part.title) bar.append(" ", el("span", { className: "bar-part" }, `· ${part.title}`));
  }
  $("bar-work").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  window.addEventListener("scroll", onScroll, { passive: true });

  // ---------- contents panel: docked sidebar on wide screens, slide-over on phones ----------
  const wide = matchMedia("(min-width: 1000px)");
  const tocIsOpen = () => !$("toc").hidden;

  function openToc({ focus = true, remember = true } = {}) {
    $("toc").hidden = false;
    $("scrim").hidden = wide.matches;
    document.body.classList.toggle("toc-docked", wide.matches);
    $("toc-open").setAttribute("aria-expanded", "true");
    if (wide.matches && remember) { prefs.toc = true; writeJSON(PREFS_KEY, prefs); }
    const cur = document.querySelector('.toc-work[aria-current="true"]');
    if (cur) cur.scrollIntoView({ block: "center" });
    if (focus) (cur || $("toc-close")).focus();
  }
  function closeToc({ remember = true } = {}) {
    $("toc").hidden = true;
    $("scrim").hidden = true;
    document.body.classList.remove("toc-docked");
    $("toc-open").setAttribute("aria-expanded", "false");
    if (wide.matches && remember) { prefs.toc = false; writeJSON(PREFS_KEY, prefs); }
  }
  const toggleToc = () => (tocIsOpen() ? closeToc() : openToc());
  $("toc-open").addEventListener("click", toggleToc);
  $("toc-close").addEventListener("click", () => closeToc());
  $("scrim").addEventListener("click", () => closeToc());
  wide.addEventListener("change", () => {
    if (!book) return;
    if (wide.matches && prefs.toc !== false) openToc({ focus: false, remember: false });
    else closeToc({ remember: false });
  });

  // ---------- interface text follows the chosen orthography too ----------
  // everything written in the page itself, except the book text, which render() and buildToc() convert
  const UI_SKIP = "#text, #toc-list, #work-group, #work-title, #work-meta, #prev-title, #next-title, #bar-work, #ortho option, code";
  const UI_ATTRS = ["title", "aria-label", "placeholder"];
  let uiStrings = null;  // [node, attribute or null, original наркамаўка text]
  function translateUI() {
    if (!uiStrings) {
      uiStrings = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode());) {
        if (/[А-Яа-яІіЎўЁё]/.test(n.nodeValue) && !n.parentElement.closest(UI_SKIP)) uiStrings.push([n, null, n.nodeValue]);
      }
      document.querySelectorAll(UI_ATTRS.map((a) => `[${a}]`).join()).forEach((node) => {
        UI_ATTRS.forEach((a) => node.hasAttribute(a) && uiStrings.push([node, a, node.getAttribute(a)]));
      });
    }
    uiStrings.forEach(([node, attr, text]) => {
      if (attr) node.setAttribute(attr, T(text)); else node.nodeValue = T(text);
    });
    if (!current) document.title = T(SITE_TITLE);
  }

  // ---------- settings ----------
  function applyPrefs() {
    document.documentElement.lang = LANG[prefs.ortho] || "be";
    $("ortho").value = LANG[prefs.ortho] ? prefs.ortho : "narkam";
    translateUI();
    showOrthoNote();
    document.documentElement.style.setProperty("--font-size", `${prefs.font}px`);
    if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
    else delete document.documentElement.dataset.theme;
  }
  // the conversion note sits in the contents footer and the selector's tooltip, not above the text
  function showOrthoNote() {
    const converted = prefs.ortho !== "narkam";
    $("ortho-note").hidden = !converted;
    $("ortho").title = T(converted ? "Правапіс: аўтаматычная канверсія з наркамаўкі, магчымыя недакладнасці" : "Правапіс");
  }
  function setFont(delta) {
    const anchor = scrollY / docHeight();
    prefs.font = Math.min(28, Math.max(15, prefs.font + delta));
    applyPrefs(); writeJSON(PREFS_KEY, prefs);
    window.scrollTo(0, anchor * docHeight());
  }
  function setOrtho(mode) {
    if (!LANG[mode]) mode = "narkam";
    const anchor = scrollY / docHeight();
    prefs.ortho = mode;
    writeJSON(PREFS_KEY, prefs);
    document.documentElement.lang = LANG[mode];
    $("ortho").value = mode;
    translateUI();
    showOrthoNote();
    if (!book) return;
    buildToc();
    filterToc();
    if (current) render(current);
    window.scrollTo(0, anchor * docHeight());
  }
  $("ortho").addEventListener("change", (e) => setOrtho(e.target.value));
  $("font-down").addEventListener("click", () => setFont(-1));
  $("font-up").addEventListener("click", () => setFont(1));
  $("theme").addEventListener("click", () => {
    const dark = prefs.theme ? prefs.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    prefs.theme = dark ? "light" : "dark";
    applyPrefs(); writeJSON(PREFS_KEY, prefs);
  });

  // ---------- keyboard ----------
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape" && tocIsOpen() && !wide.matches) closeToc();
    else if ((e.key === "t" || e.key === "е") && book) toggleToc();
    else if (e.key === "/" && book) {
      e.preventDefault();
      if (!tocIsOpen()) openToc({ focus: false });
      $("toc-filter").focus();
      $("toc-filter").select();
    }
    else if (e.key === "[" && current && works[current.index - 1]) go(works[current.index - 1].work.id);
    else if (e.key === "]" && current && works[current.index + 1]) go(works[current.index + 1].work.id);
  });

  boot();
})();
