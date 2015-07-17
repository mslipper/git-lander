var program = require('commander'),
    prompt = require('prompt'),
    spawn = require('child_process').spawn,
    Github = require('github-api'),
    utils = require('./utils'),
    config,
    head,
    base;

program
    .option('-f, --force', 'Whether or not to force push to the remote branch before rebasing')
    .option('-a, --amend', 'Whether or not to amend the commit with the pull request number')
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
        pattern: utils.YESNO_REGEX
    }, didPromptConfig);
}

function didPromptConfig(err, res) {
    if (err) {
        utils.err(err.message);
        promptConfig();
        return;
    }

    if (res.makeConfig.match(utils.YES_REGEX) || !res.makeConfig) {
        require('./lander-configure');
    } else {
        utils.exitLog('Cannot continue without a configuration file.', 1);
    }
}

function callNextCommand(next, code) {
    if (code !== 0) {
        utils.exitLog('A git error occurred.', code);
    }

    next();
}

function checkout(branch, done) {
    utils.log('Checking out branch ' + branch + '.');

    var checkout = spawn('git', [ 'checkout', branch ], {
        stdio: 'inherit'
    });

    checkout.on('close', callNextCommand.bind(null, done));
}

function pull(remote, branch, done) {
    utils.log('Pulling branch ' + remote + '/' + branch + '.');

    var pull = spawn('git', [ 'pull', remote, branch ], {
        stdio: 'inherit'
    });

    pull.on('close', callNextCommand.bind(null, done));
}

function getLastCommitMessage(done) {
    var log = spawn('git', [ 'log', '-1', '--pretty=%B' ], {
        stdio: 'pipe'
    });

    var out = '';

    log.stdout.on('data', function(data) {
        out += data;
    });

    function doneWrap(code) {
        done(out, code);
    }

    log.on('close', callNextCommand.bind(null, doneWrap));
}

function amendLastCommitMessage(message, done) {
    utils.log('Amending last commit.');

    var amend = spawn('git', ['commit', '--amend', '-m', message ], {
        stdio: 'inherit'
    });

    amend.on('close', callNextCommand.bind(null, done));
}

function push(remote, branch, force, done) {
    utils.log('Pushing latest to ' + remote + '/' + branch + '.');

    var args = [ 'push', remote, branch ];

    if (force) {
        args.push('-f');
    }

    var push = spawn('git', args, {
        stdio: 'inherit'
    });

    push.on('close', callNextCommand.bind(null, done));
}

function merge(branch, done) {
    utils.log('Merging branch ' + branch + '.');

    var merge = spawn('git', [ 'merge', head, '--ff-only' ], {
        stdio: 'inherit'
    });

    merge.on('close', callNextCommand.bind(null, done));
}

function rebase(branch, done) {
    var rebase = spawn('git', [ 'rebase', '-i', branch ], {
        stdio: 'inherit'
    });

    rebase.on('close', callNextCommand.bind(null, done));
}

function land(err, res) {
    utils.handleCbErrors(err);

    if (res.state !== 'open') {
        utils.exitLog('Pull request #' + program.args[0] + ' has already been closed.', 0);
    }

    head = res.head.ref;
    base = res.base.ref;

    function checkoutBase() {
        checkout(base, pullBase);
    }

    function pullBase() {
        pull(config.remote, base, checkoutHead);
    }

    function checkoutHead() {
        checkout(head, pullHead);
    }

    function pullHead() {
        pull(config.remote, head, startRebase);
    }

    function startRebase() {
        rebase(base, maybeAmend);
    }

    function maybeAmend() {
        if (program.amend) {
            performAmend();
        } else {
            push(config.remote, head, program.force, ffMerge);
        }
    }

    function performAmend() {
        getLastCommitMessage(function(message) {
            message += '\n[close #' + program.args[0] + ']';

            amendLastCommitMessage(message, ffMerge);
        });
    }

    function ffMerge() {
        checkout(base, merge.bind(null, head, pushBase));
    }

    function pushBase() {
        push(config.remote, base, false, success);
    }

    function success() {
        utils.log('Successfully merged PR #' + program.args[0] + '.');
    }

    checkoutBase();
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

        var repo = github.getRepo(config.organization || res.login, config.repoName);
        repo.getPull(id, land);
    }

    user.show(null, didGetUser);
}

tryConfig(getGithubData);
