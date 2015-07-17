var program = require('commander'),
    pkg = require('./package.json');

program.version(pkg.version)
    .command('configure', 'Re-run the configuration tool')
    .command('land [prNumber]', 'Pull request number in GitHub to be landed', { isDefault: true })
    .option('-f', '--force', 'Whether or not to force push to the remote branch before rebasing')
    .parse(process.argv);

if (!process.argv.slice(2).length) {
    program.help();
}