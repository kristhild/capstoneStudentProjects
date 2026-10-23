/* ==========================================================
   Capstone Gallery
   Reads projects.csv and builds the pages.
   To add or remove projects, edit projects.csv (see README.md).
   ========================================================== */

const CSV_FILE = "projects.csv";
const HOME_COUNT = 12;   // how many projects the home page shows at first
// The order of the department buttons. Departments not listed here go at the end.
const DEPARTMENT_ORDER = ["Engineering", "Arts", "Education", "Design"];

/* ---------- Load projects.csv ---------- */

// Turns CSV text into rows. Supports "quoted, values" with commas.
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim()));
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}

// Allows http/https links, files in this site (images/x.jpg), and "#" (placeholder).
function safeLink(url) {
  if (!url) return "";
  if (url === "#") return "#";
  if (/^[\w./-]+$/.test(url) && !url.startsWith("//")) return url;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch { return ""; }
}

const ART_STYLES = ["mist", "deep", "cream", "lavender"];
const ART_TEXT = { mist: "Water,|reconsidered.", deep: "Small systems.|New possibilities.", cream: "Ways|of seeing.", lavender: "A shared|future." };

async function loadProjects() {
  const res = await fetch(CSV_FILE, { cache: "no-cache" });
  if (!res.ok) throw new Error("Could not load projects.csv");
  const rows = parseCSV(await res.text());
  const headers = rows.shift().map(h => h.trim().toLowerCase());
  const seen = {};

  return rows.map((cells, order) => {
    const r = {};
    headers.forEach((h, i) => (r[h] = (cells[i] || "").trim()));
    if (!r.title) return null;
    let id = slugify(r.title);
    seen[id] = (seen[id] || 0) + 1;
    if (seen[id] > 1) id += "-" + seen[id];
    const size = parseFloat(r.cover_size);
    return {
      ...r, id, order,
      placeholder: /^placeholder$/i.test(r.label),
      image: safeLink(r.image),
      coverStyle: ART_STYLES.includes(r.cover_style) ? r.cover_style : "",
      coverSize: size > 0.3 && size < 3 ? size : 0,
      moreImages: (r.more_images || "").split("|").map(s => s.trim()).filter(Boolean)
        .map(s => (s.startsWith("art:") ? s : safeLink(s))).filter(Boolean),
      report: safeLink(r.report), presentation: safeLink(r.presentation), website: safeLink(r.website),
    };
  }).filter(Boolean);
}

// "[Fall 2026]" or "Fall 2026" -> sortable number.
function semesterRank(s) {
  const m = /(spring|summer|fall|winter)\s+(\d{4})/i.exec(s || "");
  if (!m) return 0;
  return Number(m[2]) * 10 + { winter: 0, spring: 1, summer: 2, fall: 3 }[m[1].toLowerCase()];
}
const unique = (list, key) => [...new Set(list.map(p => p[key]).filter(Boolean))];
function departments(projects) {
  const rank = d => { const i = DEPARTMENT_ORDER.indexOf(d.replace(/^\[(.*)\]$/, "$1")); return i < 0 ? 999 : i; };
  return unique(projects, "department").sort((a, b) => rank(a) - rank(b));
}

// Placeholder values are written in [brackets]. These keep them looking like the design:
// "[Engineering]" + "[Prototype]" -> "[Engineering · Prototype]"
const unbracket = s => s.replace(/^\[(.*)\]$/, "$1");
const isBracketed = s => /^\[.*\]$/.test(s);
function joinMeta(parts, sep = " · ") {
  parts = parts.filter(Boolean);
  const text = parts.map(unbracket).join(sep);
  return parts.some(isBracketed) ? "[" + text + "]" : text;
}
const field = (name, value) => value ? (isBracketed(value) ? `[${name}: ${unbracket(value)}]` : `${name}: ${value}`) : "";

/* ---------- Small helpers ---------- */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "style") node.style.cssText = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  children.flat().forEach(c => c && node.append(c));
  return node;
}
function icon(name) {
  const paths = {
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    out: '<path d="M7 17L17 7M9 7h8v8"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths[name];
  return svg;
}

/* ---------- Covers: photo or placeholder artwork ---------- */
function artStyleFor(p) {
  if (p.coverStyle) return p.coverStyle;
  const n = [...p.title].reduce((a, c) => a + c.charCodeAt(0), 0);
  return ART_STYLES[n % ART_STYLES.length];
}
function art(p, style, { small = false, short = false } = {}) {
  const text = (style === p.coverStyle && p.cover_text) || (p.coverStyle ? ART_TEXT[style] : p.title);
  const top = p.placeholder ? "[Concept study] / Placeholder" : joinMeta([p.type, p.department], " / ");
  return el("div", { class: `art art-${style}${small ? " art-sm" : ""}${short ? " art-short" : ""}`, "aria-hidden": "true" },
    el("span", { class: "art-note", text: top }),
    el("span", { class: "art-text", text: text.replace(/\|/g, "\n") }),
    el("span", { class: "art-shapes" }, el("span"), el("span"), el("span")),
    p.placeholder ? el("span", { class: "art-note art-foot", text: "[Sample artwork · Not a real project]" }) : null);
}
// fixed = use the project's cover_size (gallery cards); otherwise fill the box it's in
function cover(p, { fixed = false } = {}) {
  const ratio = p.coverSize || (p.image ? 0 : 0.8);
  const box = el("div", { class: "cover", style: fixed && ratio ? `aspect-ratio: ${ratio}` : null });
  const style = artStyleFor(p);
  const makeArt = () => art(p, style, { short: ratio >= 0.95 });
  if (p.image) {
    const img = el("img", { src: p.image, alt: "", loading: "lazy" });
    img.addEventListener("error", () => {
      if (!box.style.aspectRatio) box.style.aspectRatio = "0.8";
      img.replaceWith(makeArt());
    }, { once: true });
    box.append(img);
  } else box.append(makeArt());
  return box;
}

/* ---------- Dropdown (custom, matches the design) ---------- */
// options: [{value, label}]; inline = list opens inside the filter panel
function dropdown(root, options, value, onChange, { inline = false } = {}) {
  const label = root.getAttribute("aria-labelledby") ? null : root.closest(".field")?.querySelector(".field-label");
  const btn = el("button", { class: "dd-btn", type: "button", "aria-haspopup": "listbox", "aria-expanded": "false" },
    el("span"), icon("down"));
  if (label) { label.id ||= "l-" + root.id; btn.setAttribute("aria-labelledby", label.id + " " + root.id + "-val"); }
  btn.firstChild.id = root.id + "-val";
  const list = el("ul", { class: "menu", role: "listbox", hidden: true });
  root.replaceChildren(btn, list);
  if (inline) root.classList.add("dropdown-inline");

  let current = value;
  function draw() {
    const sel = options.find(o => o.value === current) || options[0];
    btn.firstChild.textContent = sel.label;
    list.replaceChildren(...options.map(o => {
      const item = el("button", { type: "button", role: "option", "aria-selected": String(o.value === current) }, o.label, icon("check"));
      item.addEventListener("click", () => { current = o.value; close(); draw(); onChange(current); btn.focus(); });
      return el("li", {}, item);
    }));
  }
  function open() {
    document.dispatchEvent(new CustomEvent("dropdown-open", { detail: root }));
    list.hidden = false; btn.setAttribute("aria-expanded", "true");
    list.querySelector('[aria-selected="true"]')?.focus();
  }
  function close() { list.hidden = true; btn.setAttribute("aria-expanded", "false"); }
  btn.addEventListener("click", () => (list.hidden ? open() : close()));
  document.addEventListener("dropdown-open", e => { if (e.detail !== root) close(); });
  document.addEventListener("click", e => { if (!root.contains(e.target)) close(); });
  root.addEventListener("keydown", e => {
    if (e.key === "Escape" && !list.hidden) { close(); btn.focus(); e.stopPropagation(); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const items = [...list.querySelectorAll("button")];
      if (list.hidden) { open(); e.preventDefault(); return; }
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      e.preventDefault();
    }
  });
  draw();
  return { set(v) { current = v; draw(); }, get value() { return current; } };
}

/* ---------- Departments menu in the header (all pages) ---------- */
function initDeptMenu(projects) {
  const toggle = document.querySelector(".dept-toggle");
  const list = document.querySelector(".dept-list");
  if (!toggle || !list) return;
  const depts = departments(projects);
  list.replaceChildren(
    el("li", {}, el("a", { href: "search.html", text: "All departments" })),
    ...depts.map(d => el("li", {}, el("a", { href: "search.html?dept=" + encodeURIComponent(d), text: d }))));
  const setOpen = open => { list.hidden = !open; toggle.setAttribute("aria-expanded", open); };
  toggle.addEventListener("click", e => { e.stopPropagation(); setOpen(list.hidden); });
  document.addEventListener("click", e => { if (!list.contains(e.target)) setOpen(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") setOpen(false); });
}

/* ---------- Shared gallery pieces ---------- */
function sortProjects(list, sort) {
  if (sort === "az") return list.sort((a, b) => a.title.localeCompare(b.title));
  const dir = sort === "old" ? -1 : 1;
  return list.sort((a, b) => (semesterRank(b.semester) - semesterRank(a.semester)) * dir || a.order - b.order);
}
const SORTS = [{ value: "new", label: "Newest first" }, { value: "old", label: "Oldest first" }, { value: "az", label: "A–Z" }];

function card(p, onOpen) {
  const a = el("a", { class: "card", href: "?project=" + encodeURIComponent(p.id) },
    cover(p, { fixed: true }),
    el("p", { class: "card-label", text: p.label || unbracket(p.semester || "") }),
    el("h3", { class: "card-title", text: p.title }),
    el("p", { class: "card-meta", text: joinMeta([p.department, p.type]) }));
  a.querySelector(".cover").append(el("span", { class: "card-view", "aria-hidden": "true" },
    p.placeholder ? "View placeholder project" : "View project", icon("out")));
  a.addEventListener("click", e => { e.preventDefault(); onOpen(p); });
  return a;
}

// Deals cards into columns left-to-right so the order reads across rows.
function drawMasonry(container, list, onOpen) {
  const w = container.clientWidth || window.innerWidth;
  const n = w >= 1000 ? 4 : w >= 700 ? 3 : w >= 440 ? 2 : 1;
  const cols = Array.from({ length: n }, () => el("div", { class: "m-col" }));
  list.forEach((p, i) => cols[i % n].append(card(p, onOpen)));
  container.replaceChildren(...cols);
  container.dataset.cols = n;
}
function watchColumns(container, redraw) {
  window.addEventListener("resize", () => {
    const w = container.clientWidth;
    const n = w >= 1000 ? 4 : w >= 700 ? 3 : w >= 440 ? 2 : 1;
    if (String(n) !== container.dataset.cols) redraw();
  });
}
function emptyState(container, onClear) {
  const reset = el("button", { class: "btn", type: "button", text: "Clear search and filters" });
  reset.addEventListener("click", onClear);
  container.replaceChildren(el("div", { class: "empty" }, el("p", { text: "No projects match your search." }), reset));
}
const searchText = p => [p.title, p.students, p.team, p.department, p.type, p.partner, p.advisor, p.summary, p.semester, p.overview].join(" ").toLowerCase();
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ---------- Project popup ---------- */
function initModal(projects) {
  const modal = document.getElementById("project");
  const baseTitle = document.title;

  function section(title, text) { return text ? [el("h2", { text: title }), el("p", { text })] : null; }

  function open(p, push = true) {
    const close = el("button", { class: "btn", type: "button" }, "Close", icon("x"));
    const back = el("button", { class: "btn m-back", type: "button" }, "Back to gallery", icon("back"));
    close.addEventListener("click", () => modal.close());
    back.addEventListener("click", () => modal.close());

    const kind = p.placeholder ? "Placeholder project" : unbracket(p.semester || "");
    const names = [p.students, p.team].filter(Boolean).join(" · ");
    const linkDefs = [["report", "report · PDF", "Report"], ["presentation", "presentation · PDF", "Presentation"], ["website", "project website", "Project website"]];
    const links = linkDefs.filter(([k]) => p[k]).map(([k, ph, real]) => [p[k] === "#" ? `[Placeholder ${ph}]` : real, p[k]]);
    const placeholderLinks = links.length && links.every(([, href]) => href === "#");

    const closer = p.moreImages.map(src => {
      if (src.startsWith("art:")) {
        const style = ART_STYLES.includes(src.slice(4)) ? src.slice(4) : "deep";
        const box = el("div", { class: "cover" }, art({ ...p, coverStyle: style, cover_text: ART_TEXT[style] }, style, { small: true }));
        return box;
      }
      return el("div", { class: "cover" }, el("img", { src, alt: p.title, loading: "lazy" }));
    });

    modal.replaceChildren(
      el("div", { class: "m-top" },
        el("span", { class: "m-crumb", text: "Gallery / " + (p.placeholder ? "Placeholder project" : p.title) }), close),
      el("div", { class: "m-head" },
        cover(p),
        el("div", { class: "m-intro" },
          el("p", { class: "m-label", text: kind }),
          el("h1", { id: "p-title", text: p.title.replace(/,\s*/, ",\n") , style: "white-space: pre-line" }),
          p.summary ? el("p", { class: "m-summary", text: p.summary }) : null)),
      el("div", { class: "m-body" },
        el("div", { class: "credits" },
          names ? el("strong", { text: names }) : null,
          el("p", { text: [field("Department", p.department), p.semester].filter(Boolean).join("  /  ") }),
          p.type ? el("p", { text: field("Project type", p.type) }) : null,
          (p.advisor || p.partner) ? el("p", { text: [field("Faculty advisor", p.advisor), field("Community partner", p.partner)].filter(Boolean).join("  /  ") }) : null,
          p.placeholder ? el("small", { text: "All names, credits, categories and dates are editable placeholders." }) : null),
        section("Overview", p.overview),
        section("Purpose", p.purpose),
        section("Development process", p.process),
        section("Outcomes & reflection", p.outcomes),
        closer.length ? [el("h2", { text: "A closer look" }), el("div", { class: "closer" }, closer)] : null,
        links.length ? [el("hr", { class: "m-rule" }), el("h2", { text: "Explore the work further" }),
          el("ul", { class: "links" }, links.map(([label, href]) =>
            el("li", {}, el("a", href === "#" ? { href: "#", "data-placeholder": "" } : { href, target: "_blank", rel: "noopener" },
              el("span", { text: label }), icon("out")))))] : null,
        placeholderLinks ? el("p", { class: "m-small", text: "Placeholder links • No live documents or external project site." }) : null,
        p.placeholder ? el("p", { class: "m-small", text: "Placeholder projects • Illustrative imagery, not documented capstones" }) : null,
        back));

    modal.querySelectorAll("[data-placeholder]").forEach(a => a.addEventListener("click", e => e.preventDefault()));

    if (push) {
      const u = new URL(location.href); u.searchParams.set("project", p.id);
      history.pushState({ project: p.id }, "", u);
    }
    document.title = p.title + " · Capstone Gallery";
    if (!modal.open) modal.showModal();
    modal.scrollTop = 0;
    close.focus();
  }

  modal.addEventListener("close", () => {
    document.title = baseTitle;
    const u = new URL(location.href);
    if (u.searchParams.has("project")) { u.searchParams.delete("project"); history.replaceState(null, "", u); }
  });
  modal.addEventListener("click", e => { if (e.target === modal) modal.close(); });
  window.addEventListener("popstate", () => {
    const p = projects.find(x => x.id === new URLSearchParams(location.search).get("project"));
    if (p) open(p, false); else if (modal.open) modal.close();
  });

  const start = projects.find(x => x.id === new URLSearchParams(location.search).get("project"));
  if (start) open(start, false);
  return open;
}

/* ---------- Home page ---------- */
function initHome(projects, openProject) {
  const $ = id => document.getElementById(id);
  const results = $("results"), search = $("search"), count = $("count"), chips = $("chips"), more = $("more"), toSearch = $("to-search");
  const depts = departments(projects);
  let dept = "", sort = "new", shown = HOME_COUNT;

  const sortDD = dropdown($("sort"), SORTS, sort, v => { sort = v; render(); });

  const chipBtns = ["", ...depts].map(d => {
    const b = el("button", { class: "chip", type: "button", text: d || "All departments" });
    b.addEventListener("click", () => { dept = d; shown = HOME_COUNT; render(); });
    chips.append(b);
    return [d, b];
  });

  function render() {
    const q = search.value.trim().toLowerCase();
    const list = sortProjects(projects.filter(p => (!q || searchText(p).includes(q)) && (!dept || p.department === dept)), sort);
    chipBtns.forEach(([d, b]) => b.setAttribute("aria-pressed", String(d === dept)));
    const allSample = list.length && list.every(p => p.placeholder);
    count.textContent = allSample ? `[${plural(list.length, "sample project")}]` : plural(list.length, "project");

    // "Search & filters" carries what typed over to the search page
    const params = new URLSearchParams({ filters: "open" });
    if (search.value.trim()) params.set("q", search.value.trim());
    if (dept) params.set("dept", dept);
    toSearch.href = "search.html?" + params;

    if (!list.length) { emptyState(results, () => { search.value = ""; dept = ""; render(); }); more.hidden = true; return; }
    drawMasonry(results, list.slice(0, shown), openProject);
    more.hidden = list.length <= shown;   // only shows when there are more projects to load
  }

  // "Explore more projects" adds the next 12 cards below, without leaving the page
  more.addEventListener("click", () => { shown += HOME_COUNT; render(); });
  search.addEventListener("input", () => { shown = HOME_COUNT; render(); });
  search.addEventListener("keydown", e => { if (e.key === "Enter") location.href = toSearch.href.replace("filters=open", "filters=closed"); });
  watchColumns(results, render);
  render();
  void sortDD;
}

/* ---------- Search page ---------- */
function initSearch(projects, openProject) {
  const $ = id => document.getElementById(id);
  const results = $("results"), search = $("search"), clearBtn = $("search-clear");
  const filtersBtn = $("filters-btn"), filters = $("filters"), active = $("active");
  const count = $("count"), order = $("order"), note = $("note");

  const params = new URLSearchParams(location.search);
  const pick = (key, allowed) => (allowed.includes(params.get(key)) ? params.get(key) : "");

  const depts = departments(projects);
  const sems = unique(projects, "semester").sort((a, b) => semesterRank(b) - semesterRank(a));
  const types = unique(projects, "type");
  const partners = [{ value: "", label: "Any" }, { value: "yes", label: "[With a partner]" }, { value: "no", label: "[Without a partner]" }];
  if (!projects.some(p => p.placeholder)) partners.forEach(o => (o.label = unbracket(o.label)));

  const state = {
    q: params.get("q") || "",
    dept: pick("dept", depts), sem: pick("sem", sems), type: pick("type", types),
    partner: pick("partner", ["yes", "no"]), sort: pick("sort", ["old", "az"]) || "new",
  };
  search.value = state.q;

  const opts = (all, list) => [{ value: "", label: all }, ...list.map(v => ({ value: v, label: v }))];
  const dd = {
    dept: dropdown($("f-dept"), opts("All departments", depts), state.dept, v => update("dept", v), { inline: true }),
    sem: dropdown($("f-sem"), opts("All semesters", sems), state.sem, v => update("sem", v), { inline: true }),
    type: dropdown($("f-type"), opts("All types", types), state.type, v => update("type", v), { inline: true }),
    partner: dropdown($("f-partner"), partners, state.partner, v => update("partner", v), { inline: true }),
    sort: dropdown($("f-sort"), SORTS, state.sort, v => update("sort", v), { inline: true }),
  };
  function update(key, v) { state[key] = v; dd[key]?.set(v); render(); }

  function setFiltersOpen(open) {
    filters.hidden = !open;
    filtersBtn.setAttribute("aria-expanded", String(open));
    filtersBtn.querySelector("span").textContent = open ? "Filters open" : "Search & filters";
  }
  setFiltersOpen(params.get("filters") === "open");
  filtersBtn.addEventListener("click", () => setFiltersOpen(filters.hidden));

  function pills() {
    const out = [];
    const add = (label, key) => {
      const b = el("button", { class: "pill", type: "button", "aria-label": "Remove " + label }, label, icon("x"));
      b.addEventListener("click", () => { if (key === "q") search.value = ""; update(key, ""); });
      out.push(b);
    };
    if (state.q) add("“" + state.q + "”", "q");
    if (state.dept) add(state.dept, "dept");
    if (state.sem) add(state.sem, "sem");
    if (state.type) add(state.type, "type");
    if (state.partner) add(partners.find(o => o.value === state.partner).label, "partner");
    if (out.length) {
      const c = el("button", { class: "clear-all", type: "button", text: "Clear all" });
      c.addEventListener("click", clearAll);
      out.push(c);
    }
    active.replaceChildren(...out);
  }

  function render() {
    state.q = search.value.trim();
    search.closest(".search").classList.toggle("has-value", Boolean(state.q));
    clearBtn.hidden = !state.q;
    const q = state.q.toLowerCase();
    const list = sortProjects(projects.filter(p =>
      (!q || searchText(p).includes(q)) &&
      (!state.dept || p.department === state.dept) &&
      (!state.sem || p.semester === state.sem) &&
      (!state.type || p.type === state.type) &&
      (!state.partner || (state.partner === "yes") === Boolean(p.partner))), state.sort);

    pills();
    const allSample = list.length && list.every(p => p.placeholder);
    const n = allSample ? `[${plural(list.length, "sample result")}]` : plural(list.length, "result");
    count.textContent = state.q ? `${n} for “${state.q}”` : n;
    order.textContent = SORTS.find(s => s.value === state.sort).label + (allSample ? " • Sample ordering" : "");
    note.textContent = list.some(p => p.placeholder) ? "Placeholder projects • Illustrative imagery, not documented capstones" : "";

    const next = new URLSearchParams();
    if (state.q) next.set("q", state.q);
    ["dept", "sem", "type", "partner"].forEach(k => state[k] && next.set(k, state[k]));
    if (state.sort !== "new") next.set("sort", state.sort);
    if (!filters.hidden) next.set("filters", "open");
    const pid = new URLSearchParams(location.search).get("project");
    if (pid) next.set("project", pid);
    history.replaceState(history.state, "", next.toString() ? "?" + next : location.pathname);

    if (!list.length) { emptyState(results, clearAll); return; }
    drawMasonry(results, list, openProject);
  }

  function clearAll() {
    search.value = "";
    ["dept", "sem", "type", "partner"].forEach(k => { state[k] = ""; dd[k].set(""); });
    render(); search.focus();
  }

  search.addEventListener("input", render);
  clearBtn.addEventListener("click", () => { search.value = ""; render(); search.focus(); });
  watchColumns(results, render);
  render();
  if (!params.get("q") && params.get("filters") !== "open") search.focus({ preventScroll: true });
}

/* ---------- Start ---------- */
(async () => {
  const page = document.body.dataset.page;
  let projects;
  try { projects = await loadProjects(); }
  catch {
    const r = document.getElementById("results");
    if (r) r.replaceChildren(el("div", { class: "empty" },
      el("p", { text: "Couldn't load the projects." }),
      el("p", { text: "If you're testing on your computer, use Live Server or a local server (see README.md)." })));
    return;
  }
  initDeptMenu(projects);
  const openProject = document.getElementById("project") ? initModal(projects) : null;
  if (page === "home") initHome(projects, openProject);
  if (page === "search") initSearch(projects, openProject);
})();
