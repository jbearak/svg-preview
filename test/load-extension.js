'use strict';

const Module = require('node:module');

function loadExtension(vscode) {
    const extensionPath = require.resolve('../extension');
    delete require.cache[extensionPath];
    const originalLoad = Module._load;
    Module._load = function load(request, parent, isMain) {
        if (request === 'vscode') {
            return vscode;
        }
        return originalLoad(request, parent, isMain);
    };

    try {
        return require('../extension');
    } finally {
        Module._load = originalLoad;
    }
}

module.exports = { loadExtension };
