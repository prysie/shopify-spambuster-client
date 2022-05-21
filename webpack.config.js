const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')

module.exports = (env, argv) => {
  if (argv.mode === 'production') {
    return {
      resolve: {
        fallback: {
          crypto: require.resolve('crypto-browserify'),
          buffer: require.resolve('buffer/'),
          stream: require.resolve('stream-browserify')
        }
      },
      context: path.resolve(__dirname, 'src'),
      entry: [
        './index.js'
      ],
      mode: 'production',
      output: {
        filename: 'app-spambuster.js',
        path: path.resolve(__dirname, 'build'),
        publicPath: '/'
      },
      module: {
        rules: []
      },
      optimization: {
        minimizer: [new TerserPlugin({
          extractComments: false
        })]
      }
    }
  } else {
    return {
      resolve: {
        fallback: {
          crypto: require.resolve('crypto-browserify'),
          buffer: require.resolve('buffer/'),
          stream: require.resolve('stream-browserify')
        }
      },
      context: path.resolve(__dirname, 'src'),
      entry: [
        './index.js'
      ],
      mode: 'development',
      output: {
        filename: 'app-spambuster-dev.js',
        path: path.resolve(__dirname, 'build'),
        publicPath: '/'
      },
      module: {
        rules: []
      },
      optimization: {
        minimizer: [new TerserPlugin({
          extractComments: false
        })]
      }
    }
  }
}
