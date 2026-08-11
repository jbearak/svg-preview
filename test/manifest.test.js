'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const manifest = require('../package.json');
const { loadExtension } = require('./load-extension');

const { SUPPORTED_FORMATS } = loadExtension({});
const editor = manifest.contributes.customEditors[0];

test('uses the image-preview marketplace and command identity', () => {
    assert.equal(manifest.publisher, 'jbearak');
    assert.equal(manifest.name, 'image-preview');
    assert.equal(manifest.displayName, 'SVG & PNG Preview');
    assert.equal(editor.viewType, 'jbearak.imagePreview');
    assert.equal(editor.displayName, 'SVG & PNG Preview');
    assert.equal(editor.priority, 'default');
    assert.deepEqual(
        editor.selector.map(selector => selector.filenamePattern),
        SUPPORTED_FORMATS.map(format => format.filenamePattern)
    );
    const commandIds = manifest.contributes.commands.map(({ command }) => command);
    const paletteItems = manifest.contributes.menus.commandPalette;

    assert.deepEqual(
        commandIds,
        ['imagePreview.selectZoom', 'imagePreview.zoomIn', 'imagePreview.zoomOut']
    );
    assert.deepEqual(
        paletteItems.map(({ command }) => command),
        commandIds
    );
    assert.ok(
        paletteItems.every(
            ({ when }) => when === `activeCustomEditorId == '${editor.viewType}'`
        )
    );
});
