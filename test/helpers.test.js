'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadExtension } = require('./load-extension');

const { formatFileSize, zoomLabel } = loadExtension({});

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
