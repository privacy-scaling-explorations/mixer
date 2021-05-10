const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')
const process = require('process')
const TerserPlugin = require('terser-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production'

module.exports = {
  mode: isProduction ? 'production' : 'development',
  entry: {
    index: './build/index.js',
  },
  devtool: "source-map",
  devServer: {
    historyApiFallback: true,
    contentBase: path.join(__dirname, "dist"),
    port: 1232,
  },
  output: {
    filename: '[name].[contenthash].js',
    publicPath: '/'
  },
	optimization: {
		minimize: isProduction,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: true,
          mangle: false,
        },
      }),
    ],
	},
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    }),
    new HtmlWebpackPlugin({
      title: 'MicroMix',
      template: 'template/index.html',
    })

  ],
  externals: /^(worker_threads)$/,
  module: {
    rules: [
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: ['file-loader'],
      },
      {
        test: /\.less$/,
				include: [
					path.resolve(__dirname, "less/")
				],
        use: [
          'style-loader',
          'css-loader',
          'less-loader',
        ]
      }
    ],
  },
  resolve: {
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "assert": require.resolve("assert/"),
      "stream": require.resolve("stream-browserify"),
    },
  },
};
