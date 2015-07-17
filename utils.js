var log = console.log.bind(console),
    err = console.error.bind(console);

module.exports = {
    log: log,
    err: err,

    getHomeDir: function() {
        return process.env.HOME || process.env.USERPROFILE;
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
    }
};