# Sticky Board 便利贴白板

一个 FigJam 风格的 Mac 桌面备忘应用：无限纸面画布上贴彩色便利贴，支持多画板、清单、图片、旋转缩放，所有数据只存本地。

## 下载安装

1. 打开本仓库右侧 **Releases**，下载 `TheJourney-mac.zip`
2. 解压得到 `TheJourney.app`，拖进 `/Applications` 或双击打开
3. 首次打开如被拦截（应用无付费签名）：**右键 → 打开 → 打开**，确认一次即可，之后双击正常启动
4. 需要 macOS 12 及以上，Intel / Apple Silicon 通用

## 自己构建

```bash
bash desktop/build.sh
```

需要 Xcode 命令行工具。产物在 `desktop/TheJourney.app`。

## 说明

- 网页层是零依赖单文件 `index.html`（浏览器直接打开也能用）
- 桌面壳是 Swift + 系统 WKWebView（`desktop/main.swift`），约 680K
- 数据存在本机 localStorage，不联网（除加载在线手写字体）
