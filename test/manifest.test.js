'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const manifest = require('../package.json');
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
        ['*.[sS][vV][gG]', '*.[pP][nN][gG]']
    );
    assert.deepEqual(
        manifest.contributes.commands.map(command => command.command),
        ['imagePreview.selectZoom', 'imagePreview.zoomIn', 'imagePreview.zoomOut']
    );
    assert.deepEqual(
        manifest.contributes.menus.commandPalette.map(item => item.when),
        [
            "activeCustomEditorId == 'jbearak.imagePreview'",
            "activeCustomEditorId == 'jbearak.imagePreview'",
            "activeCustomEditorId == 'jbearak.imagePreview'"
        ]
    );
});
