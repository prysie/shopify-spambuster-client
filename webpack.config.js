const webpack = require('webpack')
const path = require('path')

module.exports = {
  context: path.resolve(__dirname, 'src'),
  entry: [
    './index.js'
  ],
  mode: 'development',
  output: {
    filename: 'spambuster.js',
    path: path.resolve(__dirname, 'build'),
    publicPath: '/'
  },
  module: {
    rules: []
  },
  plugins: []
}
