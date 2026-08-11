'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const manifest = require('../package.json');
const { loadExtension } = require('./load-extension');

function createVscodeStub(name, calls, records = {}) {
    const disposable = {
        dispose() {},
        hide() {},
        show() {}
    };
    records.statusItems ??= [];
    records.watchers ??= [];

    class RelativePattern {
        constructor(base, pattern) {
            this.baseUri = base;
            this.pattern = pattern;
        }
    }

    return {
        RelativePattern,
        StatusBarAlignment: { Right: 1 },
        Uri: {
            joinPath(uri, segment) {
                assert.equal(segment, '..');
                const parent = uri.path.slice(0, uri.path.lastIndexOf('/')) || '/';
                return { path: parent };
            }
        },
        commands: {
            registerCommand(command) {
                calls.push(`${name}:${command}`);
                return disposable;
            }
        },
        window: {
            createStatusBarItem(id) {
                records.statusItems.push(id);
                return { ...disposable };
            },
            registerCustomEditorProvider(viewType) {
                calls.push(`${name}:${viewType}`);
                return disposable;
            }
        },
        workspace: {
            createFileSystemWatcher(pattern) {
                const watcher = {
                    disposed: false,
                    events: [],
                    handlers: {},
                    pattern
                };
                records.watchers.push(watcher);
                return {
                    onDidChange(handler) {
                        watcher.events.push('change');
                        watcher.handlers.change = handler;
                    },
                    onDidCreate(handler) {
                        watcher.events.push('create');
                        watcher.handlers.create = handler;
                    },
                    onDidDelete(handler) {
                        watcher.events.push('delete');
                        watcher.handlers.delete = handler;
                    },
                    dispose() {
                        watcher.disposed = true;
                    }
                };
            }
        }
    };
}

test('reloads the extension with each supplied VS Code stub', () => {
    const calls = [];
    const first = loadExtension(createVscodeStub('first', calls));
    const second = loadExtension(createVscodeStub('second', calls));
    const context = { subscriptions: { push() {} } };

    first.activate(context);
    second.activate(context);

    const registrations = [
        ...manifest.contributes.customEditors.map(editor => editor.viewType),
        ...manifest.contributes.commands.map(command => command.command)
    ];
    assert.deepEqual(calls, [
        ...registrations.map(id => `first:${id}`),
        ...registrations.map(id => `second:${id}`)
    ]);
});

test('watches standalone documents and keeps status IDs stable', async () => {
    const calls = [];
    const records = {};
    const extension = loadExtension(createVscodeStub('preview', calls, records));
    const context = { subscriptions: { push() {} } };
    const provider = new extension.ImagePreviewProvider(context);
    const refreshed = [];
    provider.refresh = uri => refreshed.push(uri);
    const uri = {
        path: '/outside/photo.PNG',
        toString() {
            return 'file:///outside/photo.PNG';
        }
    };

    const document = await provider.openCustomDocument(uri);
    const watcher = records.watchers[0];

    assert.equal(document.format.extension, 'png');
    assert.equal(document.format.copyStrategy, 'source');
    assert.equal(watcher.pattern.baseUri.path, '/outside');
    assert.equal(watcher.pattern.pattern, '*');
    assert.deepEqual(watcher.events, ['change', 'create', 'delete']);
    watcher.handlers.change(uri);
    watcher.handlers.delete(uri);
    assert.deepEqual(refreshed, [uri, uri]);

    document.dispose();
    assert.equal(watcher.disposed, true);
    assert.deepEqual(records.statusItems, [
        'imagePreview.zoom',
        'imagePreview.dimensions',
        'imagePreview.fileSize'
    ]);
});

test('carries the document format descriptor into editor resolution', async () => {
    const extension = loadExtension(createVscodeStub('preview', [], {}));
    const provider = new extension.ImagePreviewProvider({ subscriptions: { push() {} } });
    const uri = {
        path: '/outside/photo.PnG',
        toString() {
            return 'file:///outside/photo.PnG';
        }
    };
    const document = await provider.openCustomDocument(uri);
    let resolvedPreview;
    provider.getHtml = preview => {
        resolvedPreview = preview;
        return '<html></html>';
    };
    const panel = {
        active: false,
        webview: {
            onDidReceiveMessage() {},
            postMessage() {}
        },
        onDidChangeViewState() {},
        onDidDispose() {}
    };

    await provider.resolveCustomEditor(document, panel);

    assert.equal(resolvedPreview.document.format, document.format);
    assert.equal(resolvedPreview.document.format.extension, 'png');
    assert.equal(Object.hasOwn(resolvedPreview, 'format'), false);
});
