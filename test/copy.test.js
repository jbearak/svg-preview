'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const manifest = require('../package.json');
const { loadExtension } = require('./load-extension');

const { SvgPreviewProvider } = loadExtension({});

function getPreviewHtml() {
    const provider = Object.create(SvgPreviewProvider.prototype);
    provider.getImageUri = () => 'webview://preview/image.svg';
    return provider.getHtml({
        panel: {
            webview: {
                cspSource: 'webview-source'
            }
        }
    });
}

function createEventTarget(properties = {}) {
    const listeners = new Map();
    return Object.assign(properties, {
        addEventListener(type, listener) {
            const registered = listeners.get(type) ?? [];
            registered.push(listener);
            listeners.set(type, registered);
        },
        dispatch(type, event = {}) {
            for (const listener of listeners.get(type) ?? []) {
                listener(event);
            }
        }
    });
}

function createClassList() {
    const values = new Set();
    return {
        add(...names) {
            names.forEach(name => values.add(name));
        },
        remove(...names) {
            names.forEach(name => values.delete(name));
        },
        contains(name) {
            return values.has(name);
        },
        toggle(name, force) {
            if (force) {
                values.add(name);
            } else {
                values.delete(name);
            }
        }
    };
}

function runPreviewScript({ imageReady = true, storedState } = {}) {
    const html = getPreviewHtml();
    const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1];
    const messages = [];
    const clipboardWrites = [];
    const drawCalls = [];
    const body = { classList: createClassList() };
    const previewCanvas = { style: {} };
    const image = createEventTarget({
        complete: imageReady,
        naturalWidth: imageReady ? 100 : 0,
        naturalHeight: imageReady ? 50 : 0,
        clientWidth: 100,
        clientHeight: 50,
        style: {},
        focus() {},
        getBoundingClientRect() {
            return { left: 10, top: 20, width: 100, height: 50 };
        }
    });
    const copyButton = createEventTarget({ focus() {} });
    const contextMenu = createEventTarget({
        hidden: true,
        style: {},
        querySelector() {
            return copyButton;
        },
        contains(target) {
            return target === copyButton;
        },
        getBoundingClientRect() {
            return { width: 120, height: 24 };
        }
    });
    const document = createEventTarget({
        body,
        getElementById(id) {
            return { canvas: previewCanvas, image, 'context-menu': contextMenu }[id];
        },
        createElement(tag) {
            assert.equal(tag, 'canvas');
            return {
                width: 0,
                height: 0,
                getContext() {
                    return {
                        drawImage(...args) {
                            drawCalls.push(args);
                        }
                    };
                },
                toBlob(callback) {
                    callback({ type: 'image/png' });
                }
            };
        }
    });
    const window = createEventTarget({
        getSelection() {
            return { isCollapsed: true };
        }
    });

    class ClipboardItem {
        constructor(data) {
            this.data = data;
        }
    }

    vm.runInNewContext(script, {
        acquireVsCodeApi() {
            return {
                getState() {
                    return storedState;
                },
                setState() {},
                postMessage(message) {
                    messages.push(message);
                }
            };
        },
        ClipboardItem,
        console,
        devicePixelRatio: 2,
        document,
        innerHeight: 600,
        innerWidth: 800,
        navigator: {
            clipboard: {
                async write(items) {
                    clipboardWrites.push(items);
                }
            }
        },
        setTimeout,
        window
    });

    return {
        body,
        clipboardWrites,
        contextMenu,
        copyButton,
        document,
        drawCalls,
        image,
        messages,
        previewCanvas,
        window
    };
}

test('uses a single custom Copy item instead of native webview menu commands', () => {
    assert.equal(manifest.contributes.menus['webview/context'], undefined);
    const html = getPreviewHtml();

    assert.equal(html.match(/role="menuitem"/g)?.length, 1);
    assert.match(html, />Copy<\/button>/);
    assert.doesNotMatch(html, />Cut<|>Paste</);
});

test('provides separate Fit and width-only Fit Width layouts', () => {
    const html = getPreviewHtml();
    const pageRule = html.match(/html, body \{([\s\S]*?)\}/)[1];
    const imageRule = html.match(/\n        #image \{([\s\S]*?)\}/)[1];
    const fitRule = html.match(/body\.fit #image \{([\s\S]*?)\}/)[1];
    const fitWidthCanvasRule = html.match(/body\.fit-width #canvas \{([\s\S]*?)\}/)[1];
    const fitWidthRule = html.match(/body\.fit-width #image \{([\s\S]*?)\}/)[1];

    assert.match(pageRule, /padding: 0/);
    assert.match(imageRule, /max-width: none/);
    assert.match(imageRule, /max-height: none/);
    assert.match(fitRule, /max-width: 100vw/);
    assert.match(fitRule, /max-height: 100vh/);
    assert.match(fitWidthCanvasRule, /width: 100%/);
    assert.match(fitWidthRule, /width: 100%/);
    assert.doesNotMatch(fitWidthRule, /max-height/);
});

test('switches between Fit, Fit Width, and numeric zoom layouts', () => {
    const preview = runPreviewScript();

    preview.window.dispatch('message', { data: { type: 'setZoom', zoom: 2 } });
    assert.equal(preview.body.classList.contains('numeric-zoom'), true);
    assert.equal(preview.image.style.height, '100px');

    preview.window.dispatch('message', { data: { type: 'setZoom', zoom: 'fit' } });
    assert.equal(preview.body.classList.contains('fit'), true);
    assert.equal(preview.body.classList.contains('fit-width'), false);
    assert.equal(preview.body.classList.contains('numeric-zoom'), false);
    assert.equal(preview.image.style.height, '');

    preview.window.dispatch('message', { data: { type: 'setZoom', zoom: 'fitWidth' } });
    assert.equal(preview.body.classList.contains('fit'), false);
    assert.equal(preview.body.classList.contains('fit-width'), true);
    assert.equal(preview.body.classList.contains('numeric-zoom'), false);
    assert.equal(preview.previewCanvas.style.height, '');
    assert.equal(preview.image.style.height, '');
});

test('restores Fit as a persisted zoom mode', () => {
    const preview = runPreviewScript({ storedState: { zoom: 'fit' } });

    preview.image.dispatch('load');

    assert.equal(preview.body.classList.contains('fit'), true);
    assert.equal(preview.messages.at(-1).type, 'ready');
    assert.equal(preview.messages.at(-1).dimensions, '100x50');
    assert.equal(preview.messages.at(-1).zoom, 'fit');
});

test('suppresses native edit actions while the preview is unavailable', () => {
    const preview = runPreviewScript({ imageReady: false });
    let prevented = false;

    preview.document.dispatch('contextmenu', {
        preventDefault() {
            prevented = true;
        },
        target: preview.image
    });

    assert.equal(prevented, true);
    assert.equal(preview.contextMenu.hidden, true);
});

test('keeps keyboard navigation inside the single-item menu', () => {
    const preview = runPreviewScript();
    preview.document.dispatch('contextmenu', {
        clientX: 40,
        clientY: 50,
        preventDefault() {},
        target: preview.image
    });
    let prevented = false;

    preview.document.dispatch('keydown', {
        key: 'ArrowDown',
        preventDefault() {
            prevented = true;
        }
    });
    assert.equal(prevented, true);
    assert.equal(preview.contextMenu.hidden, false);

    preview.document.dispatch('keydown', { key: 'Tab' });
    assert.equal(preview.contextMenu.hidden, true);
});

test('copies the preview as PNG from the custom context menu', async () => {
    const preview = runPreviewScript();
    let prevented = false;

    preview.document.dispatch('contextmenu', {
        clientX: 40,
        clientY: 50,
        preventDefault() {
            prevented = true;
        },
        target: preview.image
    });
    assert.equal(prevented, true);
    assert.equal(preview.contextMenu.hidden, false);

    preview.copyButton.dispatch('click');
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(preview.clipboardWrites.length, 1);
    const item = preview.clipboardWrites[0][0];
    assert.equal((await item.data['image/png']).type, 'image/png');
    assert.equal(preview.drawCalls.length, 1);
    assert.deepEqual(preview.drawCalls[0].slice(1), [0, 0, 200, 100]);
});
