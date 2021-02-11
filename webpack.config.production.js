const path = require('path')
const webpack = require('webpack')
const CleanWebpackPlugin = require("clean-webpack-plugin").CleanWebpackPlugin,
    CopyWebpackPlugin = require("copy-webpack-plugin"),
    HtmlWebpackPlugin = require("html-webpack-plugin"),
    WriteFilePlugin = require("write-file-webpack-plugin");
module.exports = {
    mode: 'production',
    entry: {
        inject: path.resolve(__dirname, 'src', 'inject.ts'),
        background: path.resolve(__dirname, 'src', 'background.ts')
    },
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: '[name].js'
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                loader: 'ts-loader'
            }
        ]
    },
    resolve: {
        modules: [
            path.resolve(__dirname, 'src'),
            path.resolve(__dirname, 'node_modules')

        ],
        extensions: ['.js', '.ts']
    },
   /* plugins: [
       
        ,new webpack.optimize.AggressiveMergingPlugin()
    ]*/
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production')
        }),
        new CleanWebpackPlugin(),
        new CopyWebpackPlugin([{
          from: "manifest.json",
          transform: function (content, path) {
            return Buffer.from(JSON.stringify({
              description: process.env.npm_package_description,
              version: process.env.npm_package_version,
              ...JSON.parse(content.toString())
            }))
          }
        },
        {
          from: "images",
          to: "images"
        },
        {
          from: "src/popup.js",
          to: "popup.js"
        }
      
      ]),
        new HtmlWebpackPlugin({
          template: path.join(__dirname, "src", "popup.html"),
          filename: "popup.html",
          chunks: ["popup"]
        }),
        new WriteFilePlugin()
      ]
}