# SVG Preview

A deliberately small VS Code SVG preview that renders transparency against the
current editor background instead of a checkerboard.

## Features

- Uses `var(--vscode-editor-background)` behind the SVG.
- Opens at **Fit Width** by default.
- Offers Fit Width, Whole Image, Actual Size, and percentage zoom levels.
- Shows zoom, intrinsic dimensions, and file size in the status bar.
- Refreshes when an SVG changes on disk.

## Use

Build and install the extension into every supported editor found locally:

```sh
./scripts/setup.sh
```

The setup script supports VS Code, VS Code Insiders, VSCodium, Kiro,
Antigravity, Cursor, and Windsurf.

After installation, open an SVG. If VS Code asks which editor to
use, choose **SVG Preview**. To make the choice persistent, run
**View: Reopen Editor With...**, choose **Configure default editor for `*.svg`**,
and select **SVG Preview**.

Click **Fit Width** in the status bar to choose another zoom level. The command
palette also provides **SVG Preview: Zoom In** and **SVG Preview: Zoom Out**.

## Development

Press `F5` in VS Code to launch an Extension Development Host, then open an SVG.

```sh
npm test
```
