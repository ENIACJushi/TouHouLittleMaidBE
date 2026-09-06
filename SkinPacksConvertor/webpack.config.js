const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    SkinConvertor: './src/SkinConvertor.ts',
    PacksBrowser: './packs-browser/index.ts'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  resolve: { extensions: ['.ts', '.js'] },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: { loader: 'ts-loader', options: { onlyCompileBundledFiles: true } },
        exclude: /node_modules/
      },
      { test: /\.css$/, type: 'asset/source' }
    ]
  },
  optimization: { minimize: false }
};
