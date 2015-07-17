var program = require('commander'),
    prompt = require('prompt'),
    spawn = require('child_process').spawn,
    Github = require('github-api'),
    utils = require('./utils'),
    config;

program
    .option('-f, --force', 'Whether or not to force push to the remote branch before rebasing')
    .parse(process.argv);

if (!program.args.length) {
    utils.exitLog('A pull request ID is required.', 1);
}

function tryConfig(hasConfigCb) {
    try {
        config = require(utils.getConfigDir() + '/.git-lander-config.json');
    } catch(e) {
        promptConfig();
        return;
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
    utils.handleGitErrors(code);

    var pull = spawn('git', [ 'pull', config.remote, head ], {
        stdio: 'inherit'
    });

    pull.on('close', rebase.bind(null, head, base));
}

function rebase(head, base, code) {
    utils.handleGitErrors(code);

    var rebase = spawn('git', [ 'rebase', '-i', base ], {
        stdio: 'inherit'
    });

    rebase.on('close', getLastCommit.bind(null, head, base));
}

function getLastCommit(head, base, code) {
    utils.handleGitErrors(code);

    var log = spawn('git', [ 'log', '-1', '--pretty=%B' ], {
        stdio: 'pipe'
    });

    log.stdout.on('data', amendCommit.bind(null, head, base));
    log.on('close', utils.handleGitErrors);
}

function amendCommit(head, base, data) {
    if (!data) {
        utils.exitLog('No commit found.', 1);
    }

    var message = data + '\n[close #' + program.args[0] + ']';

    var amend = spawn('git', ['commit', '--amend', '-m', message ], {
        stdio: 'inherit'
    });

    amend.on('close', push.bind(null, head, base));
}

function push(head, base, code) {
    utils.handleGitErrors(code);

    var args = [ 'push', config.remote, head ];

    console.log(program);

    if (program.force) {
        utils.log('Force pushing to branch ' + head + '.');
        args.push('-f');
    }

    var push = spawn('git', args, {
        stdio: 'inherit'
    });

    push.on('close', merge.bind(null, head, base));
}

function merge(head, base, code) {
    utils.handleGitErrors(code);

    var checkout = spawn('git', [ 'checkout', base ], {
        stdio: 'inherit'
    });

    checkout.on('close', function(code) {
        utils.handleGitErrors(code);
        spawn('git', [ 'merge', head, '--ff-only' ], {
            stdio: 'inherit'
        }).on('close', pushBase.bind(null, head, base));
    });
}

function pushBase(head, base, code) {
    utils.handleGitErrors(code);

    spawn('git', [ 'push', config.remote, base ]).on('close', function(code) {
        utils.handleGitErrors(code);
        utils.log('Successfully landed pull request #' + program.args[0]);
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
