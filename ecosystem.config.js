module.exports = {
  apps: [
    {
      name: 'pos-api',
      script: 'server/index.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster', // Enable clustering
      watch: false, // Don't watch in production
      max_memory_restart: '500M', // Restart if memory exceeds 500MB
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      // Logging
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_file: 'logs/combined.log',
      time: true, // Add timestamps to logs
      // Graceful shutdown
      kill_timeout: 5000, // Wait 5s for graceful shutdown
      wait_ready: true, // Wait for process.send('ready')
      listen_timeout: 10000, // Time to wait for app to listen
      // Auto-restart settings
      autorestart: true,
      max_restarts: 10, // Max restarts within min_uptime
      min_uptime: '10s', // Min uptime to consider app started
      restart_delay: 4000, // Delay between restarts
      // Crash recovery
      exp_backoff_restart_delay: 100 // Exponential backoff on crashes
    }
  ],

  // Deployment configuration (optional - for pm2 deploy)
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server-ip',
      ref: 'origin/master',
      repo: 'git@github.com:your-repo/MgtSys.git',
      path: '/var/www/pos',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npx prisma migrate deploy && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
