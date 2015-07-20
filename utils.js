var log = console.log.bind(console),
    err = console.error.bind(console);

module.exports = {
    log: log,
    err: err,

    getConfigDir: function() {
        return process.cwd();
    },

    getCurrentDir: function() {
        return process.cwd();
    },

    exitLog: function(message, code) {
        if (code === 0) {
            log(message);
            process.exit(0);
        } else {
            throw new Error(message);
        }
    },

    handleCbErrors: function(err) {
        if (err) {
            module.exports.exitLog(err, 1);
        }
    },

    YESNO_REGEX: /y[es]*|n[o]?/i,
    YES_REGEX: /y[es]*/i
};