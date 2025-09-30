const baseConfig = require("./webpack.config");
const merge = require("webpack-merge");
const serve = require("../server/server.js");
const backendPort = process.env.DEV_BACKEND_PORT
  ? parseInt(process.env.DEV_BACKEND_PORT, 10)
  : 18888;

module.exports = merge(baseConfig, {
  devtool: "#eval-source-map",
  devServer: {
    hot: true,
    compress: true,
    port: 9000,
    open: true,
    proxy: {
      "*": `http://localhost:${backendPort}`
    },
    before() {
      serve.run(backendPort, "n");
    }
  }
});
