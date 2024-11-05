// ecosystem.config.js
module.exports = {
    apps: [{
        name: 'safe-api',
        script: 'src/server.js',
        interpreter: '/usr/bin/xvfb-run',
        interpreter_args: '-a',
        watch: false,
        instances: 1,
        exec_mode: 'fork',
        env: {
            NODE_ENV: 'development'
        },
        env_production: {
            NODE_ENV: 'production'
        }
    }]
};
