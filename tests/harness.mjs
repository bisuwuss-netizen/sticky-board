// 测试桥接层：直接从 index.html 里取出 PURE-CORE 标记的纯逻辑区，
// 放进 node:vm 沙箱执行，再用命名导出暴露给测试。
// 这样测的就是浏览器 / WKWebView 实际加载的那份代码，不再有影子模块。

import {readFileSync} from "node:fs";
import vm from "node:vm";

const HTML_URL = new URL("../index.html", import.meta.url);
const START_MARK = "PURE-CORE-START";
const END_MARK = "PURE-CORE-END";

// 需要暴露给测试的符号，顺序即报错时的提示顺序
const EXPORT_NAMES = [
  "BOARD",
  "uid", "rot",
  "mkSticky", "seed",
  "clampView",
  "normalizeSticky", "normalizeElement", "normalizeState",
  "escapeRich", "inlineRich", "highlightCode", "richText",
  "dateKey",
];

// 从 index.html 的 <script> 里切出 PURE-CORE-START / PURE-CORE-END 之间的代码
function readPureCore() {
  const html = readFileSync(HTML_URL, "utf8");
  const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  if (!script) throw new Error(`harness: ${HTML_URL.pathname} 里找不到 <script> 块`);
  const body = script[1];

  const start = body.indexOf(START_MARK);
  const end = body.indexOf(END_MARK);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`harness: ${HTML_URL.pathname} 缺少 ${START_MARK} / ${END_MARK} 标记，无法定位纯逻辑区`);
  }
  // 起点跳过 START 注释行的结尾 */，终点回退到 END 注释行的开头 /*
  return body.slice(body.indexOf("*/", start) + 2, body.lastIndexOf("/*", end));
}

// 尾缀：块内是 const / let 声明，不会自动挂到沙箱全局上，
// 所以在同一段脚本里显式收集一次（typeof 兜底，避免整个脚本因缺符号而崩）
function buildEpilogue(names) {
  const picks = names.map(n => `  if (typeof ${n} !== "undefined") out.${n} = ${n};`).join("\n");
  return `\n;globalThis.__PURE_CORE__ = (() => {\n  const out = {};\n${picks}\n  return out;\n})();\n`;
}

const sandbox = {
  Math, JSON, String, Number, Array, Object, Boolean, Set, Map, RegExp, Date,
  parseInt, parseFloat, isNaN, console,
};
const context = vm.createContext(sandbox);
vm.runInContext(readPureCore() + buildEpilogue(EXPORT_NAMES), context, {
  filename: "index.html#PURE-CORE",
});

const core = sandbox.__PURE_CORE__ || {};
const missing = EXPORT_NAMES.filter(n => typeof core[n] === "undefined");
if (missing.length) {
  throw new Error(`harness: index.html 纯逻辑区缺少符号 ${missing.join(", ")}（标记块或函数名是否改过？）`);
}

export const {
  BOARD,
  uid, rot,
  mkSticky, seed,
  clampView,
  normalizeSticky, normalizeElement, normalizeState,
  escapeRich, inlineRich, highlightCode, richText,
  dateKey,
} = core;
