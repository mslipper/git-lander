#!/usr/bin/env node

var program = require('commander'),
    pkg = require('./package.json');

program.version(pkg.version)
    .command('configure', 'Re-run the configuration tool')
    .command('land [prNumber]', 'Pull request number in GitHub to be landed', { isDefault: true })
    .parse(process.argv);

if (!process.argv.slice(2).length) {
    program.help();
}