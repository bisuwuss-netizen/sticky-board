// 针对真实发布代码的测试：所有函数都来自 index.html 里 PURE-CORE 标记的纯逻辑区，
// 经 tests/harness.mjs 用 node:vm 取出后命名导出，不存在影子实现。
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOARD,
  uid, rot,
  mkSticky, seed,
  clampView,
  normalizeSticky, normalizeElement, normalizeState,
  escapeRich, inlineRich, highlightCode, richText,
  dateKey,
} from './harness.mjs';

// vm 沙箱里的对象原型与宿主不同源，strict 版 deepEqual 会因原型不一致误报失败。
// 比较对象/数组前先做一次 JSON 往返，换成宿主侧的同构值。
const plain = value => JSON.parse(JSON.stringify(value));

/* ---------- 常量与基础工具 ---------- */

test('BOARD exposes the fixed board size used by the app', () => {
  assert.deepEqual(plain(BOARD), {width: 2400, height: 1600});
});

test('uid returns short unique lowercase ids', () => {
  assert.match(uid(), /^[0-9a-z]{4,}$/);
  // 同一毫秒内多次调用也不应撞号（随机后缀 4 位 base36）
  const ids = new Set(Array.from({length: 10}, () => uid()));
  assert.equal(ids.size, 10);
});

test('rot returns a small tilt within -2..2', () => {
  for (let i = 0; i < 20; i += 1) {
    const value = rot();
    assert.ok(typeof value === 'number' && !Number.isNaN(value));
    assert.ok(value >= -2 && value <= 2);
  }
});

test('mkSticky fills a fresh card with defaults', () => {
  const st = mkSticky('blue', 'note', 10, 20, '标题', '正文', [{t: 'a', done: false}]);
  assert.equal(st.color, 'blue');
  assert.equal(st.kind, 'note');
  assert.equal(st.x, 10);
  assert.equal(st.y, 20);
  assert.equal(st.title, '标题');
  assert.equal(st.body, '正文');
  assert.equal(st.items.length, 1);
  assert.ok(typeof st.id === 'string' && st.id.length > 0);
  assert.ok(typeof st.rot === 'number');

  // 省略尾部参数时补空串 / 空数组，而不是 undefined
  const bare = mkSticky('yellow', 'title', 0, 0);
  assert.equal(bare.title, '');
  assert.equal(bare.body, '');
  assert.deepEqual(plain(bare.items), []);
});

test('seed builds the welcome and journey boards', () => {
  const state = seed();
  assert.equal(state.v, 1);
  assert.equal(state.boards.length, 2);
  assert.deepEqual(plain(state.activity), []);
  assert.equal(state.activeId, state.boards[0].id);

  assert.equal(state.boards[0].name, '欢迎使用');
  assert.equal(state.boards[0].stickies.length, 3);
  assert.equal(state.boards[1].name, '成长旅程 · 模板');
  assert.equal(state.boards[1].stickies.length, 12);

  // 每张卡片都带齐必需字段，且缩放落在合法区间
  state.boards.forEach(board => {
    assert.ok(board.view.k >= 0.4 && board.view.k <= 1.6);
    board.stickies.forEach(st => {
      assert.ok(st.id && st.color && st.kind);
    });
    assert.deepEqual(plain(board.elements), []);
  });

  // seed 的结果应能原样通过归一化，不丢画板
  assert.equal(normalizeState(seed()).boards.length, 2);
});

/* ---------- clampView：只钳缩放，不钳平移边界 ---------- */

test('clampView clamps the zoom factor into 0.4..1.6', () => {
  assert.equal(clampView({x: 0, y: 0, k: 99}).k, 1.6);
  assert.equal(clampView({x: 0, y: 0, k: 0.1}).k, 0.4);
  assert.equal(clampView({x: 0, y: 0, k: 1}).k, 1);

  // 真实的 clampView 只接受 view 一个参数
  assert.equal(clampView.length, 1);
});

test('clampView falls back to safe values for invalid input', () => {
  assert.deepEqual(plain(clampView({x: 'abc', y: null, k: 'x'})), {x: 0, y: 0, k: 1});
  assert.deepEqual(plain(clampView({x: Infinity, y: -Infinity, k: 0})), {x: 0, y: 0, k: 1});
  assert.deepEqual(plain(clampView()), {x: 0, y: 0, k: 1});
  assert.deepEqual(plain(clampView({})), {x: 0, y: 0, k: 1});
});

test('clampView does not clamp pan offsets to board bounds', () => {
  // 真实版本只做缩放钳制，不做 viewport 边界钳制：负值 / 越界平移原样保留
  assert.deepEqual(plain(clampView({x: 900, y: -3000, k: 1})), {x: 900, y: -3000, k: 1});
  assert.deepEqual(plain(clampView({x: -120, y: 40, k: 0.9})), {x: -120, y: 40, k: 0.9});
});

/* ---------- normalizeSticky ---------- */

test('normalizeSticky repairs kind, color and out-of-board coordinates', () => {
  const st = normalizeSticky({id: 's', x: -5, y: 99999, kind: 'weird', color: 'red', title: 'T'});
  assert.equal(st.x, 0);
  assert.equal(st.y, BOARD.height - 40);
  assert.equal(st.kind, 'note');
  assert.equal(st.color, 'yellow');
  assert.equal(st.title, 'T');

  const far = normalizeSticky({x: 99999, y: -2});
  assert.equal(far.x, BOARD.width - 40);
  assert.equal(far.y, 0);
  assert.ok(far.id); // 缺 id 时补一个
});

test('normalizeSticky migrates urgent priority and cleans tags', () => {
  assert.equal(normalizeSticky({priority: 'urgent'}).priority, 'high');
  assert.equal(normalizeSticky({priority: 'nope'}).priority, 'none');
  assert.equal(normalizeSticky({}).priority, 'none');
  assert.deepEqual(plain(normalizeSticky({tags: [' work ', '', '  ', 'x']}).tags), ['work', 'x']);
  assert.deepEqual(plain(normalizeSticky({tags: 'nope'}).tags), []);
  assert.equal(normalizeSticky({due: 20261001}).due, ''); // 非字符串归零
  assert.deepEqual(plain(normalizeSticky({items: 'nope'}).items), []);
});

test('normalizeSticky drops retired recurring/reminder/group fields', () => {
  const st = normalizeSticky({recurrence: 'weekly', recurringCreatedFor: '2026-09-13', reminder: '12:30', dependencies: ['x'], groupId: 'g'});
  assert.equal(st.recurrence, undefined);
  assert.equal(st.recurringCreatedFor, undefined);
  assert.equal(st.reminder, undefined);
  assert.equal(st.dependencies, undefined);
  assert.equal(st.groupId, undefined);
  // 落盘（JSON）时这些键会彻底消失，不会污染存档
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(st))).filter(k => /recurr|reminder|dependencies|groupId/.test(k)), []);
});

test('normalizeSticky keeps subtasks and drops retired image fields', () => {
  // 图片/裁剪/标注功能已移除：旧存档里的 src / crop / annotation / w 落盘时静默清除
  const st = normalizeSticky({subtasks: [{title: 'Ship', status: 'done'}, {t: 'Draft'}], src: 'data:image/png;base64,x', crop: {x: 20, y: 80, scale: 1.5}, annotation: '<note>', w: 400});
  assert.equal(st.subtasks[0].status, 'done');
  assert.equal(st.subtasks[1].title, 'Draft');
  assert.equal(st.subtasks[1].status, 'backlog');
  // 落盘后这些键彻底消失，不会污染存档
  const saved = Object.keys(JSON.parse(JSON.stringify(st))).filter(k => /^(src|crop|annotation|w)$/.test(k));
  assert.deepEqual(saved, []);
});

test('normalizeSticky repairs malformed checklist items', () => {
  // 渲染期读 it.t / it.done，混进一个 null 会整块白屏，所以逐项兜底而不是整批透传
  assert.deepEqual(plain(normalizeSticky({items: [null, {t: 'ok', done: true}, '裸字符串', 7, undefined]}).items), [
    {t: 'ok', done: true},
    {t: '裸字符串', done: false},
    {t: '7', done: false},
  ]);
  // 缺 t / done 的项补默认值
  assert.deepEqual(plain(normalizeSticky({items: [{}]}).items), [{t: '', done: false}]);
  assert.deepEqual(plain(normalizeSticky({items: 'nope'}).items), []);
  assert.deepEqual(plain(normalizeSticky({items: []}).items), []);
});

/* ---------- normalizeElement ---------- */

test('normalizeElement enforces size limits and keeps elements on the board', () => {
  const el = normalizeElement({type: 'shape', w: 0, h: 0});
  assert.equal(el.w, 120);
  assert.equal(el.h, 80);

  // 越界坐标按「整块可见」回收
  const moved = normalizeElement({w: 400, h: 300, x: 9999, y: 9999});
  assert.equal(moved.x, BOARD.width - 400);
  assert.equal(moved.y, BOARD.height - 300);

  // 超大尺寸收到板子大小
  assert.equal(normalizeElement({w: 99999, h: 99999}).w, BOARD.width);
  assert.equal(normalizeElement({w: 99999, h: 99999}).h, BOARD.height);
});

test('normalizeElement falls back to shape and normalizes flags', () => {
  assert.equal(normalizeElement({type: 'nope'}).type, 'shape');
  assert.equal(normalizeElement({type: 'connector'}).type, 'connector');
  const el = normalizeElement({type: 'stroke', locked: 1, z: 5});
  assert.equal(el.locked, true);
  assert.equal(el.trashed, false);
  assert.equal(el.z, 5);
  assert.ok(el.id);
});

/* ---------- normalizeState ---------- */

test('normalizeState preserves activity data', () => {
  const state = normalizeState({boards: [], activity: [{date: '2026-09-13', done: 2}]});
  assert.equal(state.activity[0].done, 2);
});

test('normalizeState keeps only well-formed activity dates', () => {
  const state = normalizeState({activity: [{date: 'bad'}, {date: '2026-09-13'}, null]});
  assert.equal(state.activity.length, 1);
  assert.equal(state.activity[0].date, '2026-09-13');
});

test('normalizeState drops retired plans and goals fields', () => {
  const state = normalizeState({boards: [], plans: {daily: 'focus', habitDates: ['2026-09-13']}, goals: [{id: 'g', title: 'Ship', type: 'goal'}]});
  assert.equal(state.plans, undefined);
  assert.equal(state.goals, undefined);
  // 序列化后键彻底消失，旧存档字段不会被写回
  const saved = Object.keys(JSON.parse(JSON.stringify(state)));
  assert.equal(saved.includes('plans'), false);
  assert.equal(saved.includes('goals'), false);
  assert.deepEqual(saved.sort(), ['activeId', 'activity', 'boards', 'v']);
});

test('normalizeState repairs missing boards and invalid active board', () => {
  const state = normalizeState({version: 1, activeId: 'missing', boards: []});
  assert.equal(state.boards.length, 1);
  assert.equal(state.activeId, state.boards[0].id);
  assert.ok(Array.isArray(state.boards[0].stickies));
  assert.deepEqual(plain(state.boards[0].view), {x: 0, y: 0, k: 1});

  // 非对象输入同样兜底成一个空画板
  assert.equal(normalizeState(null).boards.length, 1);
  assert.equal(normalizeState('nope').v, 1);
});

test('normalizeState keeps a valid activeId and clamps the board zoom', () => {
  const state = normalizeState({boards: [{id: 'b1'}, {id: 'b2'}], activeId: 'b2'});
  assert.equal(state.activeId, 'b2');
  assert.equal(normalizeState({boards: [{id: 'b', view: {k: 5}}]}).boards[0].view.k, 1.6);
  assert.equal(normalizeState({boards: [{id: 'b', view: {k: 0.01}}]}).boards[0].view.k, 0.4);
});

test('normalizeState migrates task metadata with safe defaults', () => {
  const state = normalizeState({boards: [{id: 'b', stickies: [{id: 's', title: 'Task', tags: [' work '], priority: 'high', status: 'doing', due: '2026-10-01'}]}]});
  const sticky = state.boards[0].stickies[0];
  assert.deepEqual(sticky.tags, ['work']);
  assert.equal(sticky.priority, 'high');
  assert.equal(sticky.status, 'doing');
  assert.equal(sticky.due, '2026-10-01');
  assert.equal(sticky.locked, false);
});

test('normalizeState drops retired fields, migrates urgent priority, keeps subtasks, clears image fields', () => {
  const state = normalizeState({boards: [{id: 'b', stickies: [{id: 's', priority: 'urgent', recurrence: 'weekly', recurringCreatedFor: '2026-09-13', reminder: '12:30', dependencies: ['x'], subtasks: [{title: 'Ship', status: 'done'}], src: 'data:image/png;base64,x', crop: {x: 20, y: 80, scale: 1.5}, annotation: '<note>'}]}]});
  const sticky = state.boards[0].stickies[0];
  assert.equal(sticky.priority, 'high'); // urgent 已并入 high
  assert.equal(sticky.recurrence, undefined);
  assert.equal(sticky.recurringCreatedFor, undefined);
  assert.equal(sticky.reminder, undefined);
  assert.equal(sticky.dependencies, undefined);
  assert.equal(sticky.subtasks[0].status, 'done');
  // 图片类字段全部静默清除
  const saved = Object.keys(JSON.parse(JSON.stringify(sticky))).filter(k => /^(src|crop|annotation|w)$/.test(k));
  assert.deepEqual(saved, []);
});

test('normalizeState preserves drawable board elements', () => {
  const state = normalizeState({boards: [{id: 'b', elements: [{type: 'shape', shape: 'rect', x: 4, y: 5, w: 0}]}]});
  assert.equal(state.boards[0].elements[0].type, 'shape');
  assert.equal(state.boards[0].elements[0].w, 120);
  assert.equal(state.boards[0].elements[0].x, 4);
});

test('normalizeState clamps imported cards and elements to the fixed board', () => {
  const state = normalizeState({boards: [{id: 'b', stickies: [{id: 's', x: 9999, y: -2}], elements: [{id: 'e', type: 'shape', x: 9999, y: 9999, w: 400, h: 300}]}]});
  assert.equal(state.boards[0].stickies[0].x, BOARD.width - 40);
  assert.equal(state.boards[0].stickies[0].y, 0);
  assert.equal(state.boards[0].elements[0].x, BOARD.width - 400);
  assert.equal(state.boards[0].elements[0].y, BOARD.height - 300);
});

test('normalizeState downgrades retired img-kind stickies and clears their image data', () => {
  // 图片类型已移除：kind=img 应降级为 note，src/crop/annotation/w 等图片字段一并清掉
  const state = normalizeState({boards: [{id: 'b', stickies: [{id: 's', kind: 'img', src: 'data:image/png;base64,x', crop: {x: 0, y: 0, scale: 2}, annotation: 'note', w: 500}]}]});
  const sticky = state.boards[0].stickies[0];
  assert.equal(sticky.kind, 'note'); // img → note
  const saved = Object.keys(JSON.parse(JSON.stringify(sticky))).filter(k => /^(src|crop|annotation|w)$/.test(k));
  assert.deepEqual(saved, []);
});

test('normalizeState defaults view to the clamped origin 0,0', () => {
  const state = normalizeState({boards: [{id: 'b'}]});
  assert.deepEqual(plain(state.boards[0].view), {x: 0, y: 0, k: 1});
  const zeroKept = normalizeState({boards: [{id: 'b', view: {x: 0, y: 0, k: 1}}]});
  assert.equal(zeroKept.boards[0].view.x, 0);
});

/* ---------- 富文本渲染 ---------- */

test('escapeRich escapes every HTML-sensitive character', () => {
  assert.equal(escapeRich('<b>a & "c" \'d\'</b>'), '&lt;b&gt;a &amp; &quot;c&quot; &#39;d&#39;&lt;/b&gt;');
  assert.equal(escapeRich(null), '');
  assert.equal(escapeRich(undefined), '');
  assert.equal(escapeRich(42), '42');
  // 注入串不会原样带出尖括号
  assert.equal(escapeRich('<img src=x onerror=alert(1)>').includes('<'), false);
});

test('inlineRich renders emphasis, code and links', () => {
  assert.equal(inlineRich('**粗** 与 `code`'), '<strong>粗</strong> 与 <code>code</code>');
  assert.equal(inlineRich('*斜*'), '<em>斜</em>');
  assert.match(inlineRich('见 https://example.com/a?b=1 这里'), /<a href="https:\/\/example\.com\/a\?b=1" target="_blank" rel="noopener">/);
  // 先转义再渲染，标签不会被注入
  assert.equal(inlineRich('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');
});

test('highlightCode marks keywords, strings, numbers, and comments', () => {
  const html = highlightCode('const answer = 42; // ready');
  assert.match(html, /tok-keyword/);
  assert.match(html, /tok-number/);
  assert.match(html, /tok-comment/);
  assert.match(highlightCode('const s = "hi";'), /tok-string/);
  // 真实实现只接受 src 一个参数（没有 language）
  assert.equal(highlightCode.length, 1);
});

test('highlightCode escapes code and tolerates empty input', () => {
  assert.equal(highlightCode('<a & 1').includes('<a'), false);
  assert.match(highlightCode('<a & 1'), /&amp;/);
  assert.equal(highlightCode(''), '');
  assert.equal(highlightCode(null), '');
  assert.equal(highlightCode(), '');
});

test('richText turns paragraphs and list markers into semantic HTML', () => {
  const html = richText('项目计划\n\n- 先调研\n- 再实现\n\n1. 发布\n2. 复盘');
  assert.match(html, /<ul>[\s\S]*<li>先调研<\/li>[\s\S]*<li>再实现<\/li>[\s\S]*<\/ul>/);
  assert.match(html, /<ol>[\s\S]*<li>发布<\/li>[\s\S]*<li>复盘<\/li>[\s\S]*<\/ol>/);
  assert.match(html, /<p>项目计划<\/p>/);
});

test('richText highlights an un-fenced code-heavy note', () => {
  const html = richText('const answer = 42;\nreturn answer;');
  assert.match(html, /<pre><code>/);
  assert.match(html, /tok-keyword/);
});

test('richText renders fenced code blocks with highlighting', () => {
  const html = richText('说明文字\n\n```\nconst x = 1;\n```\n\n结尾');
  assert.match(html, /<p>说明文字<\/p>/);
  assert.match(html, /<pre><code>[\s\S]*tok-keyword[\s\S]*<\/code><\/pre>/);
  assert.match(html, /<p>结尾<\/p>/);
  assert.equal(html.includes('```'), false);
});

test('richText renders headings and quotes and escapes raw HTML', () => {
  assert.equal(richText('# 标题'), '<h4>标题</h4>');
  assert.equal(richText('> 引用'), '<blockquote>引用</blockquote>');
  assert.equal(richText(''), '');
  assert.equal(richText(null), '');
  assert.match(richText('<script>alert(1)</script>'), /&lt;script&gt;/);
});

/* ---------- dateKey ---------- */

test('dateKey formats a date as zero-padded YYYY-MM-DD', () => {
  assert.equal(dateKey(new Date(2026, 8, 5)), '2026-09-05');
  assert.equal(dateKey(new Date(2026, 0, 1)), '2026-01-01');
  assert.equal(dateKey(new Date(2026, 11, 31)), '2026-12-31');
});

test('dateKey defaults to today in the same shape', () => {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  assert.equal(dateKey(now), `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  assert.match(dateKey(), /^\d{4}-\d{2}-\d{2}$/);
});

/* ---------- normalize 的非法输入兜底 ---------- */

test('normalizeSticky returns null for non-objects instead of throwing', () => {
  // 调用点是 filter(Boolean).map(normalizeSticky)，这里必须返回 null 而不是抛 TypeError，
  // 否则整批存档导入会炸在 load() 的 try 里、静默退回 seed() 丢数据。
  assert.equal(normalizeSticky(null), null);
  assert.equal(normalizeSticky(undefined), null);
  assert.equal(normalizeSticky('nope'), null);
  assert.equal(normalizeSticky(42), null);
});

test('normalizeElement returns null for non-objects and unknown types', () => {
  assert.equal(normalizeElement(null), null);
  assert.equal(normalizeElement(undefined), null);
  assert.equal(normalizeElement('nope'), null);
  assert.equal(normalizeElement({type: 'nope'}).type, 'shape'); // 未知类型回退 shape，不是丢弃
});

test('normalizeState survives a board list containing null entries', () => {
  const state = normalizeState({boards: [{id: 'b', stickies: [null, {id: 's', title: 'ok'}], elements: [null, {id: 'e', type: 'shape'}]}]});
  assert.equal(state.boards[0].stickies.length, 1);
  assert.equal(state.boards[0].stickies[0].title, 'ok');
  assert.equal(state.boards[0].elements.length, 1);
  assert.equal(state.boards[0].elements[0].type, 'shape');
});
