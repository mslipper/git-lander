var prompt = require('prompt'),
    utils = require('./utils'),
    config;

function tryConfig() {
    try {
        config = require(utils.getHomeDir() + '/.git-lander-config.json');
    } catch(e) {
        promptConfig();
    }
}

function promptConfig() {
    prompt.start();

    prompt.get({
        name: 'makeConfig',
        description: 'No configuration file found. Would you like to create one [Y/n]',
        pattern: /y[es]*|n[o]?/i
    }, didPromptConfig);
}

function didPromptConfig(err, res) {
    if (err) {
        utils.err(err.message);
        promptConfig();
        return;
    }

    if (res.makeConfig.match(/y[es]*/i) || !res.makeConfig) {
        require('./lander-configure');
    } else {
        utils.exitLog('Cannot continue without a configuration file.', 1);
    }
}

tryConfig();