const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const BOARD_SIZE = {width: 2400, height: 1600};
export const PRIORITIES = ["none", "low", "medium", "high", "urgent"];
export const STATUSES = ["backlog", "next", "doing", "blocked", "done"];
export function clampView(view, viewport, scale = view.k || 1) {
  const k = Math.min(1.6, Math.max(0.4, Number(scale) || 1));
  const minX = Math.min(0, viewport.width - BOARD_SIZE.width * k);
  const minY = Math.min(0, viewport.height - BOARD_SIZE.height * k);
  return {x: Math.min(0, Math.max(minX, Number(view.x) || 0)), y: Math.min(0, Math.max(minY, Number(view.y) || 0)), k};
}
export function clampPoint(point, size = BOARD_SIZE) {
  return {x: Math.min(size.width - 40, Math.max(0, Number(point.x) || 0)), y: Math.min(size.height - 40, Math.max(0, Number(point.y) || 0))};
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function inlineMarkup(value) {
  let out = escapeHtml(value);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  return out;
}

export function formatRichText(source) {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${paragraph.map(inlineMarkup).join("<br>")}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(`<${list.type}>${list.items.map(item => `<li>${inlineMarkup(item)}</li>`).join("")}</${list.type}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) { flushParagraph(); flushList(); blocks.push(`<h4>${inlineMarkup(heading[1])}</h4>`); continue; }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) { flushParagraph(); flushList(); blocks.push(`<blockquote>${inlineMarkup(quote[1])}</blockquote>`); continue; }
    const unordered = line.match(/^\s*(?:[-*•])\s+(?:\[([ xX])\]\s*)?(.+)$/);
    if (unordered) {
      flushParagraph();
      if (!list || list.type !== "ul") { flushList(); list = {type: "ul", items: []}; }
      const checked = unordered[1] && unordered[1].toLowerCase() === "x";
      list.items.push(checked ? `☑ ${unordered[2]}` : unordered[2]);
      continue;
    }
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (!list || list.type !== "ol") { flushList(); list = {type: "ol", items: []}; }
      list.items.push(ordered[1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph(); flushList();
  return blocks.join("");
}

function normalizeSticky(st) {
  if (!st || typeof st !== "object") return null;
  const kind = ["note", "todo", "title", "img"].includes(st.kind) ? st.kind : "note";
  const colors = ["yellow", "blue", "pink", "green", "purple", "cyan", "white"];
  const items = Array.isArray(st.items) ? st.items.filter(Boolean).map(it => ({
    t: String(it.t ?? "").slice(0, 500), done: Boolean(it.done),
  })) : [];
  return {
    id: String(st.id || uid()), color: colors.includes(st.color) ? st.color : "yellow", kind,
    x: Number.isFinite(Number(st.x)) ? Number(st.x) : 0, y: Number.isFinite(Number(st.y)) ? Number(st.y) : 0,
    rot: Number.isFinite(Number(st.rot)) ? Number(st.rot) : 0,
    ...(st.w ? {w: Math.min(900, Math.max(120, Number(st.w) || 240))} : {}),
    title: String(st.title ?? "").slice(0, 500), body: String(st.body ?? "").slice(0, 10000), items,
    tags: Array.isArray(st.tags) ? st.tags.map(String).map(x => x.trim()).filter(Boolean).slice(0, 20) : [],
    status: STATUSES.includes(st.status) ? st.status : "backlog",
    priority: PRIORITIES.includes(st.priority) ? st.priority : "none",
    due: typeof st.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(st.due) ? st.due : "",
    recurrence: ["none", "daily", "weekly", "monthly"].includes(st.recurrence) ? st.recurrence : "none",
    parentId: typeof st.parentId === "string" ? st.parentId : "",
    dependencies: Array.isArray(st.dependencies) ? st.dependencies.filter(x => typeof x === "string").slice(0, 20) : [],
    locked: Boolean(st.locked), groupId: typeof st.groupId === "string" ? st.groupId : "",
    z: Number.isFinite(Number(st.z)) ? Number(st.z) : 0, trashed: Boolean(st.trashed),
    ...(kind === "img" && typeof st.src === "string" ? {src: st.src} : {}),
  };
}

export function normalizeState(input) {
  const raw = input && typeof input === "object" ? input : {};
  const boards = Array.isArray(raw.boards) ? raw.boards.filter(Boolean).map(b => ({
    id: String(b.id || uid()), name: String(b.name || "未命名画板").trim().slice(0, 24) || "未命名画板",
    view: {
      x: Number.isFinite(Number(b.view?.x)) ? Number(b.view.x) : 300,
      y: Number.isFinite(Number(b.view?.y)) ? Number(b.view.y) : 80,
      k: Math.min(1.6, Math.max(0.4, Number(b.view?.k) || 1)),
    },
    stickies: Array.isArray(b.stickies) ? b.stickies.map(normalizeSticky).filter(Boolean) : [],
  })) : [];
  if (!boards.length) boards.push({id: uid(), name: "我的画板", view: {x: 300, y: 80, k: 1}, stickies: []});
  const activeId = boards.some(b => b.id === raw.activeId) ? raw.activeId : boards[0].id;
  return {v: 1, activeId, boards};
}
