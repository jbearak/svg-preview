# SVG & PNG Preview

A deliberately small VS Code SVG and PNG preview that renders transparency against
the current editor background instead of a checkerboard.

## Features

- Uses `var(--vscode-editor-background)` behind SVG and PNG images.
- Opens at **Fit** by default, keeping the entire image visible.
- Offers Fit, Fit Width, Actual Size, and percentage zoom levels.
- Shows zoom, intrinsic dimensions, and file size in the status bar.
- Refreshes when an SVG or PNG changes on disk.
- Copies a rendered SVG as a transparent PNG.
- Copies a PNG using its original encoded payload without re-rasterizing it.

## Use

Build and install the extension into every supported editor found locally:

```sh
./scripts/setup.sh
```

The setup script supports VS Code, VS Code Insiders, VSCodium, Kiro,
Antigravity, Cursor, and Windsurf.

After installation, open an SVG or PNG. If VS Code asks which editor to use,
choose **SVG & PNG Preview**. VS Code's built-in image viewer remains available
for PNG files. To make this extension the persistent choice, run
**View: Reopen Editor With...**, choose **Configure default editor for `*.svg`**
or **Configure default editor for `*.png`**, and select **SVG & PNG Preview**.

Click **Fit** in the status bar to choose another zoom level. **Fit Width** fills
the available width and allows vertical scrolling for tall images. The command
palette also provides **SVG & PNG Preview: Zoom In** and
**SVG & PNG Preview: Zoom Out**.

## Development

Press `F5` in VS Code to launch an Extension Development Host, then open an SVG
or PNG.

```sh
npm test
```
