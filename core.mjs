const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const BOARD_SIZE = {width: 2400, height: 1600};
export const PRIORITIES = ["none", "low", "medium", "high", "urgent"];
export const STATUSES = ["backlog", "next", "doing", "blocked", "done"];
export const ELEMENT_TYPES = ["shape", "connector", "stroke", "table"];
export function selectInRect(items, rect) {
  const right = rect.x + rect.w, bottom = rect.y + rect.h;
  return items.filter(item => item.x < right && item.x + (item.w || 0) > rect.x && item.y < bottom && item.y + (item.h || 0) > rect.y);
}
export function alignItems(items, mode) {
  if (!items.length) return [];
  const copy = items.map(item => ({...item}));
  if (mode === "left") { const x = Math.min(...copy.map(item => item.x)); copy.forEach(item => { item.x = x; }); }
  if (mode === "right") { const x = Math.max(...copy.map(item => item.x + (item.w || 0))); copy.forEach(item => { item.x = x - (item.w || 0); }); }
  if (mode === "top") { const y = Math.min(...copy.map(item => item.y)); copy.forEach(item => { item.y = y; }); }
  if (mode === "bottom") { const y = Math.max(...copy.map(item => item.y + (item.h || 0))); copy.forEach(item => { item.y = y - (item.h || 0); }); }
  if (mode === "center-x") { const x = copy.reduce((sum, item) => sum + item.x + (item.w || 0) / 2, 0) / copy.length; copy.forEach(item => { item.x = x - (item.w || 0) / 2; }); }
  if (mode === "center-y") { const y = copy.reduce((sum, item) => sum + item.y + (item.h || 0) / 2, 0) / copy.length; copy.forEach(item => { item.y = y - (item.h || 0) / 2; }); }
  return copy;
}
export function distributeItems(items, axis) {
  if (items.length < 3) return items.map(item => ({...item}));
  const dimension = axis === "y" ? "h" : "w";
  const copy = items.map(item => ({...item})).sort((a, b) => a[axis] - b[axis]);
  const start = copy[0][axis], end = copy[copy.length - 1][axis] + (copy[copy.length - 1][dimension] || 0);
  const totalSize = copy.reduce((sum, item) => sum + (item[dimension] || 0), 0);
  const gap = (end - start - totalSize) / (copy.length - 1);
  let cursor = start;
  copy.forEach(item => { item[axis] = Math.round(cursor); cursor += (item[dimension] || 0) + gap; });
  return copy;
}
export function snapConnector(connector, items, radius = 42) {
  const points = [{key: "from", x: connector.x, y: connector.y}, {key: "to", x: connector.x2 ?? connector.x + (connector.w || 0), y: connector.y2 ?? connector.y}];
  const snapped = {...connector};
  points.forEach(point => {
    let best = null, distance = radius;
    items.forEach(item => {
      const w = item.w || 0, h = item.h || 0, cx = item.x + w / 2, cy = item.y + h / 2;
      const d = Math.hypot(Math.max(Math.abs(point.x - cx) - w / 2, 0), Math.max(Math.abs(point.y - cy) - h / 2, 0));
      if (d < distance) { best = {id: item.id, x: cx, y: cy}; distance = d; }
    });
    if (best) { snapped[point.key + "Id"] = best.id; snapped[point.key + "X"] = best.x; snapped[point.key + "Y"] = best.y; }
  });
  return snapped;
}
export function nextOccurrence(date, recurrence) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || recurrence === "none") return date;
  const d = new Date(date + "T00:00:00Z");
  if (recurrence === "daily") d.setUTCDate(d.getUTCDate() + 1);
  if (recurrence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  if (recurrence === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
export function highlightCode(source, language = "text") {
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const code = String(source ?? "");
  const token = /\/\/.*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b/g;
  let result = "", last = 0, match;
  while ((match = token.exec(code))) {
    result += escape(code.slice(last, match.index)).replace(/\b(const|let|var|function|return|if|else|for|while|class|new|import|from|export|async|await|def|print|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|true|false|null|undefined)\b/g, '<span class="tok-keyword">$1</span>');
    const value = match[0];
    const cls = /^\/\//.test(value) || /^\/\*/.test(value) ? "tok-comment" : /^["'`]/.test(value) ? "tok-string" : "tok-number";
    result += '<span class="' + cls + '">' + escape(value) + '</span>';
    last = match.index + value.length;
  }
  return result + escape(code.slice(last)).replace(/\b(const|let|var|function|return|if|else|for|while|class|new|import|from|export|async|await|def|print|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|true|false|null|undefined)\b/g, '<span class="tok-keyword">$1</span>');
}
export function progressTree(nodes) {
  const byParent = new Map(); nodes.forEach(node => { const key = node.parentId || "root"; if (!byParent.has(key)) byParent.set(key, []); byParent.get(key).push(node); });
  const walk = node => { const children = byParent.get(node.id) || []; if (!children.length) return node.status === "done" ? 1 : 0; return children.reduce((sum, child) => sum + walk(child), 0) / children.length; };
  return nodes.map(node => ({...node, progress: Math.round(walk(node) * 100)}));
}
export function streakFromDates(dates, today = new Date()) {
  const set = new Set(dates);
  const key = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  let cursor = new Date(today); let streak = 0;
  while (set.has(key(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}
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
  const codeish = lines.filter(line => /^(\s*(?:const|let|var|function|async\s+function|class|import|export|def|return|SELECT|FROM|WHERE|if\s*\(|for\s*\(|while\s*\())|[{}][;,]?\s*$/.test(line)).length;
  if (!lines.some(line => line.trim().startsWith("```")) && codeish >= 2 && codeish >= Math.ceil(lines.filter(Boolean).length * 0.25)) return `<pre><code>${highlightCode(lines.join("\n"))}</code></pre>`;
  const blocks = [];
  let paragraph = [];
  let list = null;
  let code = null;
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
    if (line.trim().startsWith("```")) {
      if (code) { blocks.push(`<pre><code>${highlightCode(code.join("\n"))}</code></pre>`); code = null; }
      else { flushParagraph(); flushList(); code = []; }
      continue;
    }
    if (code) { code.push(line); continue; }
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
  if (code) blocks.push(`<pre><code>${highlightCode(code.join("\n"))}</code></pre>`);
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
    x: Math.min(BOARD_SIZE.width - 40, Math.max(0, Number.isFinite(Number(st.x)) ? Number(st.x) : 0)), y: Math.min(BOARD_SIZE.height - 40, Math.max(0, Number.isFinite(Number(st.y)) ? Number(st.y) : 0)),
    rot: Number.isFinite(Number(st.rot)) ? Number(st.rot) : 0,
    ...(st.w ? {w: Math.min(900, Math.max(120, Number(st.w) || 240))} : {}),
    title: String(st.title ?? "").slice(0, 500), body: String(st.body ?? "").slice(0, 10000), items,
    tags: Array.isArray(st.tags) ? st.tags.map(String).map(x => x.trim()).filter(Boolean).slice(0, 20) : [],
    status: STATUSES.includes(st.status) ? st.status : "backlog",
    priority: PRIORITIES.includes(st.priority) ? st.priority : "none",
    due: typeof st.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(st.due) ? st.due : "",
    recurrence: ["none", "daily", "weekly", "monthly"].includes(st.recurrence) ? st.recurrence : "none",
    recurringCreatedFor: typeof st.recurringCreatedFor === "string" ? st.recurringCreatedFor : "",
    dependencies: Array.isArray(st.dependencies) ? st.dependencies.filter(x => typeof x === "string").slice(0, 20) : [],
    locked: Boolean(st.locked), groupId: typeof st.groupId === "string" ? st.groupId : "",
    z: Number.isFinite(Number(st.z)) ? Number(st.z) : 0, trashed: Boolean(st.trashed),
    ...(kind === "img" && typeof st.src === "string" ? {src: st.src} : {}),
    subtasks: Array.isArray(st.subtasks) ? st.subtasks.filter(Boolean).map(item => ({id: String(item.id || uid()), title: String(item.title || item.t || "").slice(0, 500), status: STATUSES.includes(item.status) ? item.status : "backlog"})) : [],
    goalId: typeof st.goalId === "string" ? st.goalId : "",
    reminder: typeof st.reminder === "string" ? st.reminder : "",
    crop: st.crop && typeof st.crop === "object" ? {x: Number.isFinite(Number(st.crop.x)) ? Number(st.crop.x) : 50, y: Number.isFinite(Number(st.crop.y)) ? Number(st.crop.y) : 50, scale: Math.max(1, Number(st.crop.scale) || 1)} : {x: 50, y: 50, scale: 1},
    annotation: typeof st.annotation === "string" ? st.annotation.slice(0, 1000) : "",
  };
}
function normalizeElement(el) {
  if (!el || typeof el !== "object" || !ELEMENT_TYPES.includes(el.type)) return null;
  const w = Math.min(BOARD_SIZE.width, Math.max(20, Number(el.w) || 120)), h = Math.min(BOARD_SIZE.height, Math.max(20, Number(el.h) || 80));
  return {...el, id: String(el.id || uid()), x: Math.min(BOARD_SIZE.width - w, Math.max(0, Number(el.x) || 0)), y: Math.min(BOARD_SIZE.height - h, Math.max(0, Number(el.y) || 0)), w, h, locked: Boolean(el.locked), z: Number(el.z) || 0};
}

export function normalizeState(input) {
  const raw = input && typeof input === "object" ? input : {};
  const boards = Array.isArray(raw.boards) ? raw.boards.filter(Boolean).map(b => ({
    id: String(b.id || uid()), name: String(b.name || "未命名画板").trim().slice(0, 24) || "未命名画板",
    view: {
      x: Number.isFinite(Number(b.view?.x)) ? Number(b.view.x) : 0,
      y: Number.isFinite(Number(b.view?.y)) ? Number(b.view.y) : 0,
      k: Math.min(1.6, Math.max(0.4, Number(b.view?.k) || 1)),
    },
    stickies: Array.isArray(b.stickies) ? b.stickies.map(normalizeSticky).filter(Boolean) : [],
    elements: Array.isArray(b.elements) ? b.elements.map(normalizeElement).filter(Boolean) : [],
  })) : [];
  if (!boards.length) boards.push({id: uid(), name: "我的画板", view: {x: 0, y: 0, k: 1}, stickies: [], elements: []});
  const plans = raw.plans && typeof raw.plans === "object" ? {daily: String(raw.plans.daily || ""), weekly: String(raw.plans.weekly || ""), review: String(raw.plans.review || ""), habitDates: Array.isArray(raw.plans.habitDates) ? raw.plans.habitDates.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-365) : []} : {daily:"", weekly:"", review:"", habitDates:[]};
  const goals = Array.isArray(raw.goals) ? raw.goals.filter(Boolean).map(g => ({id: String(g.id || uid()), title: String(g.title || "未命名目标").slice(0, 120), type: ["goal","stage","milestone"].includes(g.type) ? g.type : "goal", parentId: typeof g.parentId === "string" ? g.parentId : "", playbook: String(g.playbook || ""), reviewTemplate: String(g.reviewTemplate || ""), status: ["backlog","doing","done"].includes(g.status) ? g.status : "backlog"})) : [];
  const activity = Array.isArray(raw.activity) ? raw.activity.filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.date)).slice(-90) : [];
  const activeId = boards.some(b => b.id === raw.activeId) ? raw.activeId : boards[0].id;
  return {v: 1, activeId, boards, plans, goals, activity};
}
