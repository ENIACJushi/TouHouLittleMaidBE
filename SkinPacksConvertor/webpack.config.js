const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/SkinConvertor.js',
  output: {
    filename: 'SkinConvertor.bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  optimization: {
    minimize: false
  }
};
