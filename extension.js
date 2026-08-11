// @ts-check
'use strict';

const vscode = require('vscode');

const VIEW_TYPE = 'jmb.svgPreview';
const DEFAULT_ZOOM = 'fitWidth';
const ZOOM_LEVELS = [0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10];

class SvgPreviewProvider {
    /** @param {vscode.ExtensionContext} context */
    constructor(context) {
        this.context = context;
        this.previews = new Set();
        this.activePreview = undefined;

        this.zoomStatus = vscode.window.createStatusBarItem(
            'svgPreview.zoom',
            vscode.StatusBarAlignment.Right,
            102
        );
        this.zoomStatus.name = 'SVG Preview Zoom';
        this.zoomStatus.command = 'svgPreview.selectZoom';

        this.dimensionsStatus = vscode.window.createStatusBarItem(
            'svgPreview.dimensions',
            vscode.StatusBarAlignment.Right,
            101
        );
        this.dimensionsStatus.name = 'SVG Dimensions';

        this.fileSizeStatus = vscode.window.createStatusBarItem(
            'svgPreview.fileSize',
            vscode.StatusBarAlignment.Right,
            100
        );
        this.fileSizeStatus.name = 'SVG File Size';

        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.svg');
        this.watcher.onDidChange(uri => this.refresh(uri));
        this.watcher.onDidCreate(uri => this.refresh(uri));

        context.subscriptions.push(
            this.zoomStatus,
            this.dimensionsStatus,
            this.fileSizeStatus,
            this.watcher
        );
    }

    /** @param {vscode.Uri} uri */
    async openCustomDocument(uri) {
        return {
            uri,
            dispose() {}
        };
    }

    /**
     * @param {{ uri: vscode.Uri }} document
     * @param {vscode.WebviewPanel} panel
     */
    async resolveCustomEditor(document, panel) {
        panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(document.uri, '..')]
        };

        const preview = {
            document,
            panel,
            zoom: DEFAULT_ZOOM,
            dimensions: '',
            fileSize: ''
        };

        this.previews.add(preview);
        panel.webview.html = this.getHtml(preview);
        await this.updateFileSize(preview);

        panel.webview.onDidReceiveMessage(message => {
            if (message.type === 'ready') {
                preview.dimensions = message.dimensions;
                preview.zoom = message.zoom;
                this.updateStatus(preview);
            } else if (message.type === 'zoom') {
                preview.zoom = message.zoom;
                this.updateStatus(preview);
            } else if (message.type === 'dimensions') {
                preview.dimensions = message.dimensions;
                this.updateStatus(preview);
            }
        });

        panel.onDidChangeViewState(() => {
            if (panel.active) {
                this.setActivePreview(preview);
            } else if (this.activePreview === preview) {
                this.setActivePreview(undefined);
            }
        });

        panel.onDidDispose(() => {
            this.previews.delete(preview);
            if (this.activePreview === preview) {
                this.setActivePreview(undefined);
            }
        });

        if (panel.active) {
            this.setActivePreview(preview);
        }
    }

    /** @param {vscode.Uri} uri */
    async refresh(uri) {
        for (const preview of this.previews) {
            if (preview.document.uri.toString() !== uri.toString()) {
                continue;
            }

            await this.updateFileSize(preview);
            preview.panel.webview.postMessage({
                type: 'reload',
                src: this.getImageUri(preview, Date.now())
            });
        }
    }

    /** @param {any} preview */
    async updateFileSize(preview) {
        try {
            const stat = await vscode.workspace.fs.stat(preview.document.uri);
            preview.fileSize = formatFileSize(stat.size);
        } catch {
            preview.fileSize = '';
        }
        this.updateStatus(preview);
    }

    /** @param {any | undefined} preview */
    setActivePreview(preview) {
        this.activePreview = preview;
        if (preview) {
            this.updateStatus(preview);
        } else {
            this.zoomStatus.hide();
            this.dimensionsStatus.hide();
            this.fileSizeStatus.hide();
        }
    }

    /** @param {any} preview */
    updateStatus(preview) {
        if (this.activePreview !== preview || !preview.panel.active) {
            return;
        }

        this.zoomStatus.text = zoomLabel(preview.zoom);
        this.dimensionsStatus.text = preview.dimensions;
        this.fileSizeStatus.text = preview.fileSize;
        this.zoomStatus.show();
        this.dimensionsStatus.show();
        this.fileSizeStatus.show();
    }

    async selectZoom() {
        const preview = this.activePreview;
        if (!preview) {
            return;
        }

        const choices = [
            { label: 'Fit Width', zoom: 'fitWidth' },
            { label: 'Whole Image', zoom: 'fit' },
            { label: 'Actual Size', zoom: 1 },
            ...ZOOM_LEVELS
                .filter(level => level !== 1)
                .map(level => ({ label: `${Math.round(level * 100)}%`, zoom: level }))
        ];
        const choice = await vscode.window.showQuickPick(choices, {
            placeHolder: 'Select SVG zoom level'
        });
        if (choice) {
            this.setZoom(preview, choice.zoom);
        }
    }

    zoomIn() {
        if (this.activePreview) {
            this.activePreview.panel.webview.postMessage({ type: 'zoomIn' });
        }
    }

    zoomOut() {
        if (this.activePreview) {
            this.activePreview.panel.webview.postMessage({ type: 'zoomOut' });
        }
    }

    /** @param {any} preview @param {string | number} zoom */
    setZoom(preview, zoom) {
        preview.zoom = zoom;
        preview.panel.webview.postMessage({ type: 'setZoom', zoom });
        this.updateStatus(preview);
    }

    /** @param {any} preview @param {number} version */
    getImageUri(preview, version) {
        const resource = preview.panel.webview.asWebviewUri(preview.document.uri);
        const separator = resource.query ? '&' : '';
        return resource.with({ query: `${resource.query}${separator}v=${version}` }).toString();
    }

    /** @param {any} preview */
    getHtml(preview) {
        const nonce = createNonce();
        const src = this.getImageUri(preview, Date.now());
        const cspSource = preview.panel.webview.cspSource;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource}; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style nonce="${nonce}">
        html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            background: var(--vscode-editor-background);
            overflow: auto;
        }
        body {
            display: flex;
            box-sizing: border-box;
        }
        #canvas {
            min-width: 100%;
            min-height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            box-sizing: border-box;
        }
        #image {
            display: block;
            flex: none;
        }
        body.fit-width #canvas {
            align-items: flex-start;
        }
        body.fit-width #image {
            width: 100%;
            height: auto;
        }
        body.fit #image {
            width: auto;
            height: auto;
            max-width: 100vw;
            max-height: 100vh;
        }
        #error {
            display: none;
            margin: auto;
            color: var(--vscode-errorForeground);
            font-family: var(--vscode-font-family);
        }
        body.error #canvas {
            display: none;
        }
        body.error #error {
            display: block;
        }
    </style>
</head>
<body class="fit-width">
    <div id="canvas"><img id="image" src="${escapeHtml(src)}" alt=""></div>
    <div id="error">Unable to load the SVG.</div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const image = document.getElementById('image');
        const levels = ${JSON.stringify(ZOOM_LEVELS)};
        let zoom = vscode.getState()?.zoom ?? ${JSON.stringify(DEFAULT_ZOOM)};

        function labelDimensions() {
            return image.naturalWidth + 'x' + image.naturalHeight;
        }

        function numericZoom() {
            if (typeof zoom === 'number') {
                return zoom;
            }
            if (!image.naturalWidth) {
                return 1;
            }
            return image.clientWidth / image.naturalWidth;
        }

        function applyZoom(nextZoom, report = true) {
            zoom = nextZoom;
            document.body.classList.remove('fit-width', 'fit', 'error');
            image.style.width = '';
            image.style.height = '';
            image.style.maxWidth = '';
            image.style.maxHeight = '';

            if (zoom === 'fitWidth') {
                document.body.classList.add('fit-width');
            } else if (zoom === 'fit') {
                document.body.classList.add('fit');
            } else {
                const width = image.naturalWidth || image.clientWidth || 1;
                const height = image.naturalHeight || image.clientHeight || 1;
                image.style.width = Math.round(width * zoom) + 'px';
                image.style.height = Math.round(height * zoom) + 'px';
            }

            vscode.setState({ zoom });
            if (report) {
                vscode.postMessage({ type: 'zoom', zoom });
            }
        }

        function stepZoom(direction) {
            const current = numericZoom();
            const choices = direction > 0 ? levels : [...levels].reverse();
            const next = choices.find(level => direction > 0 ? level > current + 0.001 : level < current - 0.001);
            applyZoom(next ?? (direction > 0 ? levels.at(-1) : levels[0]));
        }

        image.addEventListener('load', () => {
            document.body.classList.remove('error');
            applyZoom(zoom, false);
            vscode.postMessage({
                type: 'ready',
                dimensions: labelDimensions(),
                zoom
            });
        });

        image.addEventListener('error', () => {
            document.body.classList.add('error');
        });

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'setZoom') {
                applyZoom(message.zoom);
            } else if (message.type === 'zoomIn') {
                stepZoom(1);
            } else if (message.type === 'zoomOut') {
                stepZoom(-1);
            } else if (message.type === 'reload') {
                image.src = message.src;
            }
        });
    </script>
</body>
</html>`;
    }
}

/** @param {number} bytes */
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes}B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)}KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

/** @param {string | number} zoom */
function zoomLabel(zoom) {
    if (zoom === 'fitWidth') {
        return 'Fit Width';
    }
    if (zoom === 'fit') {
        return 'Whole Image';
    }
    return `${Math.round(Number(zoom) * 100)}%`;
}

function createNonce() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let value = '';
    for (let index = 0; index < 32; index += 1) {
        value += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return value;
}

/** @param {string} value */
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

/** @param {vscode.ExtensionContext} context */
function activate(context) {
    const provider = new SvgPreviewProvider(context);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
            supportsMultipleEditorsPerDocument: true
        }),
        vscode.commands.registerCommand('svgPreview.selectZoom', () => provider.selectZoom()),
        vscode.commands.registerCommand('svgPreview.zoomIn', () => provider.zoomIn()),
        vscode.commands.registerCommand('svgPreview.zoomOut', () => provider.zoomOut())
    );
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
    formatFileSize,
    zoomLabel
};
