var prompt = require('prompt'),
    utils = require('./utils'),
    fs = require('fs');

var prompts = [{
    description: 'Please enter your GitHub access token',
    name: 'token',
    required: true
}, {
    description: 'Please enter a GitHub repo name',
    name: 'repoName',
    required: true
}, {
    description: 'Please enter your GitHub origin name',
    name: 'remote',
    required: true,
    default: 'origin'
}];

function writeConfig(res) {
    var content = JSON.stringify(res),
        dir = utils.getConfigDir();

    fs.writeFile(dir + '/.git-lander-config.json', content,
        utils.exitLog.bind(utils, 'Successfully wrote config file to ' + dir +
            '/.git-lander-config.json. Please re-run this command.', 0));
}

prompt.start();

prompt.get(prompts, function(err, res) {
    if (err) {
        utils.exitLog(err.message, 1);
    }

    writeConfig(res);
});
