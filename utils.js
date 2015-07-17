var log = console.log.bind(console),
    err = console.error.bind(console);

module.exports = {
    log: log,
    err: err,

    getConfigDir: function() {
        return process.cwd();
    },

    exitLog: function(message, code) {
        if (code === 0) {
            log(message);
        } else {
            err(message);
        }

        process.exit(code);
    },

    handleCbErrors: function(err) {
        if (err) {
            module.exports.exitLog(err, 1);
        }
    },

    handleGitErrors: function(code) {
        if (code !== 0) {
            module.exports.exitLog('Git died.', 1);
        }
    }
};