const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/SkinConvertor.ts',
  output: {
    filename: 'SkinConvertor.bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  optimization: {
    minimize: false
  }
};
