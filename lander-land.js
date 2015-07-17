var program = require('commander'),
    prompt = require('prompt'),
    spawn = require('child_process').spawn,
    Github = require('github-api'),
    utils = require('./utils'),
    config;

program
    .option('-f', '--force', 'Whether or not to force push to the remote branch before rebasing')
    .parse(process.argv);

if (!program.args.length) {
    utils.exitLog('A pull request ID is required.', 1);
}

function tryConfig(hasConfigCb) {
    try {
        config = require(utils.getConfigDir() + '/.git-lander-config.json');
    } catch(e) {
        promptConfig();
    }

    hasConfigCb();
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

function checkoutHead(head, base) {
    utils.log('Checking out head branch ' + head + '.');

    var checkout = spawn('git', [ 'checkout', head ], {
        stdio: 'inherit'
    });

    checkout.on('close', pullHead.bind(null, head, base));
}

function pullHead(head, base, code) {
    if (code !== 0) {
        utils.exitLog('Git died.', 1);
    }

    var pull = spawn('git', [ 'pull', config.origin, head ], {
        stdio: 'inherit'
    });
}

function getGithubData() {
    var github = new Github({
        token: config.token,
        auth: 'oauth'
    });

    var user = github.getUser(),
        id = program.args[0];

    function didGetUser(err, res) {
        utils.handleCbErrors(err);

        var repo = github.getRepo(res.login, config.repoName);
        repo.getPull(id, didGetPull);
    }

    function didGetPull(err, res) {
        utils.handleCbErrors(err);

        checkoutHead(res.head.ref, res.base.ref);
    }

    user.show(null, didGetUser);
}

tryConfig(getGithubData);
