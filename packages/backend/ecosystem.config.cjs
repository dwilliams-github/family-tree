// PM2 process config for production.
// Start: pm2 start ecosystem.config.cjs
// Node 20 --env-file loads /opt/family-tree/packages/backend/.env before any module runs,
// which is what config.ts needs (it validates process.env at import time).
module.exports = {
  apps: [{
    name: 'family-tree',
    script: 'dist/server.js',
    cwd: '/opt/family-tree/packages/backend',
    node_args: '--env-file=/opt/family-tree/packages/backend/.env',
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '400M',
  }],
};
