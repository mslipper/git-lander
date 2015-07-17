var program = require('commander'),
    prompt = require('prompt'),
    utils = require('./utils'),
    fs = require('fs');

program.parse(process.argv);

var prompts = [{
    description: 'Please enter your GitHub access token',
    name: 'token',
    required: true
}, {
    description: 'Please enter a GitHub repo name',
    name: 'repoName',
    required: true
}, {
    description: 'Please enter a GitHub organization name (optional)',
    name: 'organization',
    required: false,
    default: ''
}, {
    description: 'Please enter your GitHub origin name',
    name: 'remote',
    required: true,
    default: 'origin'
}, {
    description: 'Would you like to add the config file to your .gitignore?',
    name: 'writeGitIgnore',
    required: false,
    pattern: utils.YESNO_REGEX,
    default: 'y'
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

    function done() {
        delete res.writeGitIgnore;

        writeConfig(res);
    }

    if (res.writeGitIgnore.match(utils.YES_REGEX)) {
        fs.appendFile(utils.getCurrentDir()+ '/.gitignore', '.git-lander-config.json\n', done);
    } else {
        done();
    }
});
