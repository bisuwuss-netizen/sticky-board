import Cocoa
import ImageIO
import UniformTypeIdentifiers
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!

    // MARK: - Launch

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "The Journey"
        window.minSize = NSSize(width: 900, height: 640)
        window.setFrameAutosaveName("MainWindow")

        let cfg = WKWebViewConfiguration()
        cfg.userContentController.add(self, name: "pickImage")
        cfg.userContentController.add(self, name: "backup")
        webView = WKWebView(frame: window.contentView!.bounds, configuration: cfg)
        webView.autoresizingMask = [.width, .height]
        webView.uiDelegate = self
        webView.navigationDelegate = self

        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            webView.loadHTMLString("<h1>index.html missing in Resources</h1>", baseURL: nil)
        }

        window.contentView?.addSubview(webView)
        window.makeKeyAndOrderFront(nil)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            window.makeKeyAndOrderFront(nil)
        }
        return true
    }

    // MARK: - Menu

    // Standard items keep target == nil so actions travel the responder
    // chain (NSApp / key window / web view). A fixed target that doesn't
    // implement the action silently disables the item AND its shortcut.
    private func stdItem(_ title: String, _ action: Selector, _ key: String,
                         _ mask: NSEvent.ModifierFlags = .command) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.keyEquivalentModifierMask = mask
        return item
    }

    private func ownItem(_ title: String, _ action: Selector, _ key: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        return item
    }

    private func buildMenu() {
        let main = NSMenu()

        let appMenu = NSMenu()
        appMenu.addItem(stdItem("About The Journey", #selector(NSApplication.orderFrontStandardAboutPanel(_:)), ""))
        appMenu.addItem(.separator())
        appMenu.addItem(stdItem("Hide The Journey", #selector(NSApplication.hide(_:)), "h"))
        appMenu.addItem(stdItem("Hide Others", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]))
        appMenu.addItem(stdItem("Show All", #selector(NSApplication.unhideAllApplications(_:)), ""))
        appMenu.addItem(.separator())
        appMenu.addItem(stdItem("Quit The Journey", #selector(NSApplication.terminate(_:)), "q"))
        let appEntry = NSMenuItem(); appEntry.submenu = appMenu; main.addItem(appEntry)

        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(stdItem("Undo", #selector(UndoManager.undo), "z"))
        editMenu.addItem(stdItem("Redo", #selector(UndoManager.redo), "z", [.command, .shift]))
        editMenu.addItem(.separator())
        editMenu.addItem(stdItem("Cut", #selector(NSText.cut(_:)), "x"))
        editMenu.addItem(stdItem("Copy", #selector(NSText.copy(_:)), "c"))
        editMenu.addItem(stdItem("Paste", #selector(NSText.paste(_:)), "v"))
        editMenu.addItem(stdItem("Select All", #selector(NSText.selectAll(_:)), "a"))
        let editEntry = NSMenuItem(); editEntry.submenu = editMenu; main.addItem(editEntry)

        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(ownItem("Reload Page", #selector(reloadPage), "r"))
        viewMenu.addItem(.separator())
        viewMenu.addItem(ownItem("Zoom In", #selector(zoomIn), "+"))
        viewMenu.addItem(ownItem("Zoom Out", #selector(zoomOut), "-"))
        viewMenu.addItem(ownItem("Actual Size", #selector(zoomReset), "0"))
        let viewEntry = NSMenuItem(); viewEntry.submenu = viewMenu; main.addItem(viewEntry)

        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(stdItem("Minimize", #selector(NSWindow.miniaturize(_:)), "m"))
        windowMenu.addItem(stdItem("Close Window", #selector(NSWindow.performClose(_:)), "w"))
        windowMenu.addItem(stdItem("Bring All to Front", #selector(NSApplication.arrangeInFront(_:)), ""))
        let windowEntry = NSMenuItem(); windowEntry.submenu = windowMenu; main.addItem(windowEntry)

        NSApp.mainMenu = main
    }

    // MARK: - View actions

    @objc private func reloadPage() {
        webView.reload()
    }

    @objc private func zoomIn() {
        webView.magnification = min(webView.magnification + 0.1, 2.0)
    }

    @objc private func zoomOut() {
        webView.magnification = max(webView.magnification - 0.1, 0.5)
    }

    @objc private func zoomReset() {
        webView.magnification = 1.0
    }

    // MARK: - Web policy: keep the board in-app, send web links to the browser

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        // 只把 http(s) 交给浏览器；about:blank / 自定义协议一律忽略，避免打开无意义的外链
        if let url = navigationAction.request.url, isWebURL(url) {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    private func isWebURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        return scheme == "http" || scheme == "https"
    }

    // MARK: - JavaScript dialogs: WKWebView drops these silently without a bridge

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert()
        a.messageText = message
        a.addButton(withTitle: "好")
        a.runModal()
        completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert()
        a.messageText = message
        a.addButton(withTitle: "确定")
        a.addButton(withTitle: "取消")
        completionHandler(a.runModal() == .alertFirstButtonReturn)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let a = NSAlert()
        a.messageText = prompt
        a.addButton(withTitle: "确定")
        a.addButton(withTitle: "取消")
        let tf = NSTextField(frame: NSRect(x: 0, y: 0, width: 280, height: 24))
        tf.stringValue = defaultText ?? ""
        a.accessoryView = tf
        a.window.initialFirstResponder = tf
        let ok = a.runModal() == .alertFirstButtonReturn
        completionHandler(ok ? tf.stringValue : nil)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        if url.isFileURL {
            decisionHandler(.allow)
        } else if !isWebURL(url) {
            decisionHandler(.cancel) // 白名单之外的一律不放行（file 与 http(s) 之外的协议都不需要）
        } else if navigationAction.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow) // 字体等子资源仍走这里
        }
    }

    // MARK: - Native image picker (JS file inputs can't pop panels reliably)

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        if message.name == "backup" {
            if let json = message.body as? String { writeBackup(json) }
            return
        }
        guard message.name == "pickImage" else { return }
        let panel = NSOpenPanel()
        panel.message = "选择一张图片放到画板上"
        panel.allowedContentTypes = [.image]
        panel.allowsMultipleSelection = false
        panel.begin { [weak self] resp in
            guard resp == .OK, let url = panel.url else { return }
            self?.deliverImage(url)
        }
    }

    // MARK: - File backups

    /// 时间戳只用得到一次格式，没必要每次备份都重建 formatter
    private static let stampFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    /// 把网页层发来的完整状态 JSON 写到 Application Support，保留最近 10 份
    private func writeBackup(_ json: String) {
        DispatchQueue.global(qos: .utility).async {
            let fm = FileManager.default
            guard let support = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return }
            let dir = support.appendingPathComponent("TheJourney/backups", isDirectory: true)
            do {
                try fm.createDirectory(at: dir, withIntermediateDirectories: true)
                let stamp = Self.stampFormatter.string(from: Date()).replacingOccurrences(of: ":", with: "-")
                try json.write(to: dir.appendingPathComponent("backup-\(stamp).json"), atomically: true, encoding: .utf8)
                let files = try fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.creationDateKey], options: [.skipsHiddenFiles])
                    .filter { $0.lastPathComponent.hasPrefix("backup-") }
                    .sorted { ($0.pathComponents.last ?? "") > ($1.pathComponents.last ?? "") }
                for old in files.dropFirst(10) { try? fm.removeItem(at: old) }
            } catch {
                NSLog("TheJourney backup failed: \(error.localizedDescription)")
            }
        }
    }

    private func deliverImage(_ url: URL) {
        guard let data = downsizedImage(url), !data.isEmpty else { return }
        let mime = url.pathExtension.lowercased() == "png" ? "image/png" : "image/jpeg"
        let js = "window.__nativeImage&&window.__nativeImage(\"data:\(mime);base64,\(data.base64EncodedString())\")"
        DispatchQueue.main.async { [weak self] in
            self?.webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private func downsizedImage(_ url: URL, maxDim: CGFloat = 1000) -> Data? {
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let thumbOpts = [kCGImageSourceThumbnailMaxPixelSize: maxDim,
                         kCGImageSourceCreateThumbnailFromImageAlways: true] as CFDictionary
        guard let thumb = CGImageSourceCreateThumbnailAtIndex(src, 0, thumbOpts) else { return nil }
        let out = NSMutableData()
        let isPNG = url.pathExtension.lowercased() == "png"
        let type = (isPNG ? UTType.png.identifier : UTType.jpeg.identifier) as CFString
        guard let dest = CGImageDestinationCreateWithData(out, type, 1, nil) else { return nil }
        if isPNG {
            CGImageDestinationAddImage(dest, thumb, nil)
        } else {
            CGImageDestinationAddImage(dest, thumb, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
        }
        guard CGImageDestinationFinalize(dest) else { return nil }
        return out as Data
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.activate(ignoringOtherApps: true)
app.run()
