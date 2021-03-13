const path = require("path");
const Dotenv = require("dotenv-webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const WebpackMd5Hash = require("webpack-md5-hash");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const WebpackPwaManifest = require("webpack-pwa-manifest");
const WorkboxPlugin = require("workbox-webpack-plugin");

module.exports = {
    entry: {
        main: "./src/ts/index.ts",
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
    output: {
        path:     path.resolve(__dirname, "dist"),
        filename: "[name].[chunkhash].js",
        publicPath: "",
    },
    // devtool: "source-map",
    module: {
        rules: [
            {
                test: /\.html$/,
                use:  [
                    {
                        loader: "./node_modules/html-webpack-plugin/lib/loader.js",
                        options: {
                            force: true,
                        }
                    },
                    {
                        loader: "string-replace-loader",
                        options: {
                            search:  "=\"(..\/assets\/[^\"]*)\"",
                            replace: "=\"<%= require('$1').default %>\"",
                            flags:   "g",
                        }
                    },
                ]
            }, {
                test:    /\.tsx?$/,
                use:     "babel-loader",
                exclude: /node_modules/,
            }, {
                test: /\.(sass|scss|css)$/,
                use:  [
                    {
                        loader: MiniCssExtractPlugin.loader,
                    },
                    {
                        loader: "css-loader",
                    },
                    {
                        loader: "postcss-loader",
                    },
                    {
                        loader: "sass-loader",
                    },
                ],
            }, {
                test: /\.(png|svg|jpg|gif|ico|xml)$/,
                use:  [
                    {
                        loader: "file-loader",
                        options: {
                            name: "[name].[contenthash].[ext]",
                        },
                    },
                ],
            },
        ],
    },
    plugins: [
        new Dotenv(),
        new CleanWebpackPlugin(),
        new MiniCssExtractPlugin({
            filename: "style.[contenthash].css",
        }),
        new HtmlWebpackPlugin({
            scriptLoading: "defer",
            inject:        false,
            hash:          false,
            template:      "./src/html/index.html",
        }),
        new WebpackPwaManifest(require("./web_manifest")),
        new WorkboxPlugin.GenerateSW(),
    ],
};
