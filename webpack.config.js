const path = require('path')

module.exports = (env, argv) => {
  if (argv.mode === 'production') {
    return {
      context: path.resolve(__dirname, 'src'),
      entry: [
        './index.js'
      ],
      mode: 'production',
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
  } else {
    return {
      context: path.resolve(__dirname, 'src'),
      entry: [
        './index.js'
      ],
      mode: 'development',
      output: {
        filename: 'spambuster-dev.js',
        path: path.resolve(__dirname, 'build'),
        publicPath: '/'
      },
      module: {
        rules: []
      },
      plugins: []
    }
  }
}
