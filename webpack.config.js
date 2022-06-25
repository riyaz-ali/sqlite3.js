//- Webpack bundler configuration

const path = require('path');
const webpack = require('webpack');

module.exports = {
  // entrypoint for the javascript interface
  entry: path.resolve(__dirname, './lib/index.js'),

  // output configuration for the library
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: 'sqlite3.js',
    library: {
      name: 'sqlite3',
      type: 'umd',
    }
  },
  resolve: {
    alias: {
      'lodash': 'lodash-es'
    }
  },

  plugins: [
    new webpack.DefinePlugin({
      process: {
        env: {
          WASM_URL: JSON.stringify(process.env.WASM_URL)
        }
      }
    })
  ]
};