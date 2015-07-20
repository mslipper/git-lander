var program = require('commander'),
    prompt = require('prompt'),
    spawn = require('child_process').spawn,
    Github = require('github-api'),
    utils = require('./utils'),
    config,
    head,
    base;

program
    .option('-f, --force', 'Force push to the remote branch before rebasing')
    .option('-a, --amend', 'Amend the commit with the pull request number')
    .option('-d, --delete', 'Delete the pull request branch when done')
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

function fetchAll(done) {
    utils.log('Fetching all branches.');

    var fetch = spawn('git', [ 'fetch', '--all' ], {
        stdio: 'inherit'
    });

    fetch.on('close', callNextCommand.bind(null, done));
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

function rebase(branch, interactive, done) {
    var args = [ 'rebase', branch ];

    if (interactive) {
        args.splice(1, 0, '-i');
    }

    var rebase = spawn('git', args, {
        stdio: 'inherit'
    });

    rebase.on('close', callNextCommand.bind(null, done));
}

function deleteBranch(branch, done) {
    var del = spawn('git', [ 'branch', '-d', branch ], {
        stdio: 'inherit'
    });

    del.on('close', callNextCommand.bind(null, done));
}

function countCommitsAhead(base, head, done) {
    var log = spawn('git', [ 'log', base + '..' + head, '--pretty=%H'], {
        stdio: 'pipe'
    });

    var commitsAhead = 0;

    log.stdout.on('data', function(commits) {
        if (commits) {
            /**
             * Remove empty lines.
             */
            commitsAhead += commits.toString().split('\n').reduce(function(prev, curr) {
                if (curr.length === 40) {
                    return prev + 1;
                } else {
                    return prev;
                }
            }, 0);
        }
    });

    function doneWrap(code) {
        done(commitsAhead, code);
    }

    log.on('close', callNextCommand.bind(null, doneWrap));
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
        pull(config.remote, head, maybeStartRebase);
    }

    function maybeStartRebase() {
        countCommitsAhead(base, head, function(ahead) {
            if (ahead === 1) {
                promptRebase();
            } else {
                startInteractiveRebase();
            }
        });
    }

    function promptRebase() {
        prompt.start();

        prompt.get([{
            name: 'shouldRebase',
            description: 'This pull request is only 1 commit ahead of ' +
                base + '. You don\'t need to rebase this branch. Do you want ' +
                'to do so anyway?',
            pattern: utils.YESNO_REGEX,
            defaut: 'no'
        }], didPromptRebase);

        function didPromptRebase(err, res) {
            if (err) {
                utils.err(err.message);
                promptRebase();
                return;
            }

            if (res.shouldRebase.match(utils.YES_REGEX)) {
                startInteractiveRebase();
            } else {
                startNormalRebase();
            }
        }
    }

    function startNormalRebase() {
        rebase(base, false, maybeAmend);
    }

    function startInteractiveRebase() {
        rebase(base, true, maybeAmend);
    }

    function maybeAmend() {
        if (program.amend) {
            performAmend();
        } else {
            maybeForcePush();
        }
    }

    function performAmend() {
        getLastCommitMessage(function(message) {
            message += '\n[close #' + program.args[0] + ']';

            amendLastCommitMessage(message, maybeForcePush);
        });
    }

    function maybeForcePush() {
        push(config.remote, head, program.force, ffMerge)
    }

    function ffMerge() {
        checkout(base, merge.bind(null, head, pushBase));
    }

    function pushBase() {
        push(config.remote, base, false, maybeDelete);
    }

    function maybeDelete() {
        if (program.delete) {
            deleteBranch(head, pushDeleted);
        } else {
            success();
        }
    }

    function pushDeleted() {
        push(config.remote, ':' + head, false, success);
    }

    function success() {
        utils.log('Successfully merged PR #' + program.args[0] + '.');
    }

    fetchAll(checkoutBase);
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
