var program = require('commander'),
    prompt = require('prompt'),
    utils = require('./utils'),
    makeConfig = require('./makeConfig'),
    pkg = require('./package.json'),
    config;

program.version(pkg.version)
    .option('-c', '--configure', 'Re-run the configuration tool')
    .option('-p', '--pull-request', 'Pull request number in GitHub')
    .option('-f', '--force', 'Whether or not to force push to the remote branch before rebasing');

if (program.configure) {
    makeConfig();
    return;
}

try {
    config = require(getUserHome() + '/.git-lander-config.json');
} catch(e) {
    promptConfig();
    return;
}


function exit() {
    process.exit(1);
}

function getUserHome() {
    return process.env.HOME || process.env.USERPROFILE;
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
        makeConfig();
    } else {
        utils.exitLog('Cannot continue without a configuration file.', 1);
    }
}