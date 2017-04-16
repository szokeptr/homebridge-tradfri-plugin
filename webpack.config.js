var path = require('path');
var webpack = require('webpack');

module.exports = {
  entry: ['babel-polyfill', './src/plugin.js'],
  output: {
    path: __dirname,
    filename: 'index.js',
    libraryTarget: "commonjs2",
  },
  externals: [
    {
      child_process: true,
    }
  ],
  target: 'node',
  module: {
    loaders: [
      {
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          presets: ['env'],
          plugins: ['add-module-exports']
        }
      }
    ]
  },
};
