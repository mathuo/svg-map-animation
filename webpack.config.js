var path = require("path");

module.exports = {
  entry: path.resolve(__dirname, "src/demo/example.tsx"),
  devtool: "source-map",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist")
  },
  mode: "development",
  resolve: {
    // Add `.ts` and `.tsx` as a resolvable extension.
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader"
      }
    ]
  },
  devServer: {
    port: 9000,
    compress: true,
    contentBase: path.resolve(__dirname, "public"),
    publicPath: "/dist"
  }
};
