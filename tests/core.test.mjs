import assert from 'node:assert/strict';
import test from 'node:test';
import { BOARD_SIZE, alignItems, clampPoint, clampView, distributeItems, formatRichText, highlightCode, nextOccurrence, normalizeState, progressTree, selectInRect, snapConnector, streakFromDates } from '../core.mjs';

test('selection and alignment operate on overlapping cards', () => {
  const items = [{id:'a',x:10,y:10,w:50,h:50},{id:'b',x:90,y:30,w:40,h:40},{id:'c',x:180,y:80,w:20,h:20}];
  assert.equal(selectInRect(items, {x:0,y:0,w:120,h:100}).length, 2);
  assert.deepEqual(alignItems(items.slice(0,2), 'top').map(x => x.y), [10, 10]);
  assert.deepEqual(distributeItems(items, 'x').map(x => x.x), [10, 100, 180]);
});

test('connectors snap endpoints to nearby cards and recurrence advances dates', () => {
  const snapped = snapConnector({id:'l',x:20,y:20,x2:190,y2:90,w:170,h:70}, [{id:'a',x:0,y:0,w:40,h:40},{id:'b',x:180,y:80,w:40,h:40}]);
  assert.equal(snapped.fromId, 'a'); assert.equal(snapped.toId, 'b');
  assert.equal(nextOccurrence('2026-09-13', 'weekly'), '2026-09-20');
});

test('hierarchy progress and habit streak are derived from task state', () => {
  const tree = progressTree([{id:'goal',status:'doing'},{id:'task',parentId:'goal',status:'done'},{id:'task2',parentId:'goal',status:'doing'}]);
  assert.equal(tree.find(x => x.id === 'goal').progress, 50);
  assert.equal(streakFromDates(['2026-09-13','2026-09-12'], new Date('2026-09-13T12:00:00Z')), 2);
});

test('highlightCode marks keywords, strings, numbers, and comments', () => {
  const html = highlightCode('const answer = 42; // ready', 'js');
  assert.match(html, /tok-keyword/);
  assert.match(html, /tok-number/);
  assert.match(html, /tok-comment/);
});

test('normalizeState preserves plans, goals, and activity data', () => {
  const state = normalizeState({boards: [], plans: {daily: 'focus', habitDates: ['2026-09-13']}, goals: [{id: 'g', title: 'Ship', type: 'goal'}], activity: [{date: '2026-09-13', done: 2}]});
  assert.equal(state.plans.daily, 'focus');
  assert.equal(state.goals[0].title, 'Ship');
  assert.equal(state.activity[0].done, 2);
});

test('clampPoint keeps new sticky positions inside the fixed board', () => {
  assert.deepEqual(clampPoint({x: -20, y: 2000}), {x: 0, y: BOARD_SIZE.height - 40});
});

test('clampView keeps panning inside the fixed board bounds', () => {
  const view = clampView({x: 900, y: -3000, k: 1}, {width: 1200, height: 800});
  assert.deepEqual(view, {x: 0, y: -800, k: 1});
});

test('formatRichText turns paragraphs and list markers into semantic HTML', () => {
  const html = formatRichText('项目计划\n\n- 先调研\n- 再实现\n\n1. 发布\n2. 复盘');
  assert.match(html, /<ul>[\s\S]*<li>先调研<\/li>[\s\S]*<li>再实现<\/li>[\s\S]*<\/ul>/);
  assert.match(html, /<ol>[\s\S]*<li>发布<\/li>[\s\S]*<li>复盘<\/li>[\s\S]*<\/ol>/);
  assert.match(html, /<p>项目计划<\/p>/);
});

test('formatRichText highlights an un-fenced code-heavy note', () => {
  const html = formatRichText('const answer = 42;\nreturn answer;');
  assert.match(html, /<pre><code>/);
  assert.match(html, /tok-keyword/);
});

test('normalizeState repairs missing boards and invalid active board', () => {
  const state = normalizeState({ version: 1, activeId: 'missing', boards: [] });
  assert.equal(state.boards.length, 1);
  assert.equal(state.activeId, state.boards[0].id);
  assert.ok(Array.isArray(state.boards[0].stickies));
});

test('normalizeState migrates task metadata with safe defaults', () => {
  const state = normalizeState({ boards: [{ id: 'b', stickies: [{ id: 's', title: 'Task', tags: [' work '], priority: 'high', status: 'doing', due: '2026-10-01' }] }] });
  const sticky = state.boards[0].stickies[0];
  assert.deepEqual(sticky.tags, ['work']);
  assert.equal(sticky.priority, 'high');
  assert.equal(sticky.status, 'doing');
  assert.equal(sticky.due, '2026-10-01');
  assert.equal(sticky.locked, false);
});

test('normalizeState keeps recurrence, subtasks, image crop, and annotation', () => {
  const state = normalizeState({boards: [{id: 'b', stickies: [{id: 's', recurrence: 'weekly', recurringCreatedFor: '2026-09-13', subtasks: [{title: 'Ship', status: 'done'}], crop: {x: 20, y: 80, scale: 1.5}, annotation: '<note>'}]}]});
  const sticky = state.boards[0].stickies[0];
  assert.equal(sticky.recurrence, 'weekly');
  assert.equal(sticky.recurringCreatedFor, '2026-09-13');
  assert.equal(sticky.subtasks[0].status, 'done');
  assert.deepEqual(sticky.crop, {x: 20, y: 80, scale: 1.5});
  assert.equal(sticky.annotation, '<note>');
});

test('normalizeState preserves drawable board elements', () => {
  const state = normalizeState({ boards: [{ id: 'b', elements: [{ type: 'shape', shape: 'rect', x: 4, y: 5, w: 0 }] }] });
  assert.equal(state.boards[0].elements[0].type, 'shape');
  assert.equal(state.boards[0].elements[0].w, 120);
});

test('normalizeState clamps imported cards and elements to the fixed board', () => {
  const state = normalizeState({boards: [{id: 'b', stickies: [{id: 's', x: 9999, y: -2}], elements: [{id: 'e', type: 'shape', x: 9999, y: 9999, w: 400, h: 300}]}]});
  assert.equal(state.boards[0].stickies[0].x, BOARD_SIZE.width - 40);
  assert.equal(state.boards[0].stickies[0].y, 0);
  assert.equal(state.boards[0].elements[0].x, BOARD_SIZE.width - 400);
  assert.equal(state.boards[0].elements[0].y, BOARD_SIZE.height - 300);
});
