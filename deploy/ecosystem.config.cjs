// PM2 process file:  pm2 start deploy/ecosystem.config.cjs
const path = require("node:path");
const root = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "assetpro",
      cwd: root,
      script: "dist/index.cjs",
      node_args: `--enable-source-maps --env-file=${path.join(root, ".env")}`,
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      time: true,
    },
  ],
};
