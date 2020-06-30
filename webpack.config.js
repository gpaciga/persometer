const path = require('path');

module.exports = {
    entry: './src/persometer.js',
    output: {
        filename: 'persometer.js',
        path: path.resolve(__dirname),
        libraryTarget: 'var',
        library: 'Persometer'
    },
};

