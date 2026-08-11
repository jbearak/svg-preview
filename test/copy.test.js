'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const manifest = require('../package.json');
const { loadExtension } = require('./load-extension');

const errors = [];
const { SvgPreviewProvider } = loadExtension({
    window: {
        showErrorMessage(message) {
            errors.push(message);
        }
    }
});

test.beforeEach(() => {
    errors.length = 0;
});

test('contributes only Copy to the SVG preview context menu', () => {
    const copyCommand = manifest.contributes.commands.find(
        contribution => contribution.command === 'svgPreview.copyImage'
    );
    assert.deepEqual(copyCommand, {
        command: 'svgPreview.copyImage',
        title: 'Copy',
        category: 'SVG Preview'
    });

    const viewType = manifest.contributes.customEditors[0].viewType;
    assert.deepEqual(manifest.contributes.menus['webview/context'], [{
        command: 'svgPreview.copyImage',
        when: `webviewId == '${viewType}'`
    }]);
    assert.deepEqual(
        manifest.contributes.menus.commandPalette.find(
            contribution => contribution.command === 'svgPreview.copyImage'
        ),
        { command: 'svgPreview.copyImage', when: 'false' }
    );
});

test('copy command reveals the active preview and requests an image copy', async () => {
    const messages = [];
    let revealCount = 0;
    const provider = Object.create(SvgPreviewProvider.prototype);
    provider.activePreview = {
        panel: {
            reveal() {
                revealCount += 1;
            },
            webview: {
                async postMessage(message) {
                    messages.push(message);
                    return true;
                }
            }
        }
    };

    await provider.copyImage();

    assert.equal(revealCount, 1);
    assert.deepEqual(messages, [{ type: 'copyImage' }]);
    assert.deepEqual(errors, []);
});

test('copy command is a no-op without an active preview', async () => {
    const provider = Object.create(SvgPreviewProvider.prototype);
    provider.activePreview = undefined;

    await provider.copyImage();

    assert.deepEqual(errors, []);
});

test('copy command reports when its message cannot be delivered', async () => {
    const provider = Object.create(SvgPreviewProvider.prototype);
    provider.activePreview = {
        panel: {
            reveal() {},
            webview: {
                async postMessage() {
                    return false;
                }
            }
        }
    };

    await provider.copyImage();

    assert.deepEqual(errors, ['Unable to copy the SVG preview to the clipboard.']);
});

test('generated preview HTML suppresses defaults and wires image copying', () => {
    const provider = Object.create(SvgPreviewProvider.prototype);
    provider.getImageUri = () => 'webview://preview/image.svg';
    const html = provider.getHtml({
        panel: {
            webview: {
                cspSource: 'webview-source'
            }
        }
    });

    assert.match(html, /preventDefaultContextMenuItems/);
    assert.match(html, /message\.type === 'copyImage'/);
});
