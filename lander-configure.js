var prompt = require('prompt'),
    utils = require('./utils'),
    fs = require('fs');

var prompts = [{
    description: 'Please enter your GitHub access token',
    name: 'token',
    required: true
}];

function writeConfig(res) {
    var content = JSON.stringify(res);

    fs.writeFile(utils.getHomeDir() + '/.git-lander-config.json', content,
        utils.exitLog.bind(utils, 'Successfully wrote config file to ' +
            '~/.git-lander-config. Please re-run this command.', 0));
}

prompt.start();

prompt.get(prompts, function(err, res) {
    if (err) {
        utils.exitLog(err.message, 1);
    }

    writeConfig(res);
});