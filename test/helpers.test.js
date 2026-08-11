'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadExtension } = require('./load-extension');

const { formatFileSize, numericZoomLayout, rasterLayout, zoomLabel } = loadExtension({});

test('formats file sizes like the built-in preview', () => {
    assert.equal(formatFileSize(500), '500B');
    assert.equal(formatFileSize(205732), '200.91KB');
    assert.equal(formatFileSize(2 * 1024 * 1024), '2.00MB');
});

test('formats zoom labels', () => {
    assert.equal(zoomLabel('fit'), 'Fit');
    assert.equal(zoomLabel('fitWidth'), 'Fit Width');
    assert.equal(zoomLabel(1), '100%');
    assert.equal(zoomLabel(1.5), '150%');
});

test('sizes the canvas to contain numeric zoom levels', () => {
    assert.deepEqual(numericZoomLayout(800, 600, 2), {
        imageWidth: '1600px',
        imageHeight: '1200px',
        canvasWidth: 'max(100%, 1600px)',
        canvasHeight: 'max(100%, 1200px)'
    });
});

test('uses rendered resolution and reports raster downscaling', () => {
    assert.deepEqual(rasterLayout(100, 50, 100, 50, 2), {
        width: 200,
        height: 100,
        downscaled: false
    });
    assert.deepEqual(rasterLayout(20000, 20000, 20000, 20000, 1), {
        width: 4096,
        height: 4096,
        downscaled: true
    });
});
