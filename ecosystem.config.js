module.exports = {
  apps: [
    {
      name: 'hr-miniapp',
      script: 'npm',
      args: 'run start',
      cwd: './',
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
