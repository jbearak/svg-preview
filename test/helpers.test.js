'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
    if (request === 'vscode') {
        return {};
    }
    return originalLoad(request, parent, isMain);
};

const { formatFileSize, zoomLabel } = require('../extension');

test('formats file sizes like the built-in preview', () => {
    assert.equal(formatFileSize(500), '500B');
    assert.equal(formatFileSize(205732), '200.91KB');
    assert.equal(formatFileSize(2 * 1024 * 1024), '2.00MB');
});

test('formats zoom labels', () => {
    assert.equal(zoomLabel('fitWidth'), 'Fit Width');
    assert.equal(zoomLabel('fit'), 'Whole Image');
    assert.equal(zoomLabel(1.5), '150%');
});
