'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const manifest = require('../package.json');
const { loadExtension } = require('./load-extension');

function createVscodeStub(name, calls) {
    const disposable = {
        dispose() {},
        hide() {},
        show() {}
    };
    return {
        StatusBarAlignment: { Right: 1 },
        commands: {
            registerCommand(command) {
                calls.push(`${name}:${command}`);
                return disposable;
            }
        },
        window: {
            createStatusBarItem() {
                return { ...disposable };
            },
            registerCustomEditorProvider(viewType) {
                calls.push(`${name}:${viewType}`);
                return disposable;
            }
        },
        workspace: {
            createFileSystemWatcher() {
                return {
                    ...disposable,
                    onDidChange() {},
                    onDidCreate() {}
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
