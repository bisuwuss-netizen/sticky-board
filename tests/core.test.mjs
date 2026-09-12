import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRichText, normalizeState } from '../core.mjs';

test('formatRichText turns paragraphs and list markers into semantic HTML', () => {
  const html = formatRichText('项目计划\n\n- 先调研\n- 再实现\n\n1. 发布\n2. 复盘');
  assert.match(html, /<ul>[\s\S]*<li>先调研<\/li>[\s\S]*<li>再实现<\/li>[\s\S]*<\/ul>/);
  assert.match(html, /<ol>[\s\S]*<li>发布<\/li>[\s\S]*<li>复盘<\/li>[\s\S]*<\/ol>/);
  assert.match(html, /<p>项目计划<\/p>/);
});

test('normalizeState repairs missing boards and invalid active board', () => {
  const state = normalizeState({ version: 1, activeId: 'missing', boards: [] });
  assert.equal(state.boards.length, 1);
  assert.equal(state.activeId, state.boards[0].id);
  assert.ok(Array.isArray(state.boards[0].stickies));
});
