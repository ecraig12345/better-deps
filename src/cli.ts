import { InvalidArgumentError, Option, program } from 'commander';
import { hoistDevDeps } from './commands/hoistDevDeps';
import { starLocalDevDeps } from './commands/starLocalDevDeps';

program
  .name('better-deps')
  .description('CLI for cleaning up issues with JavaScript dependencies in monorepos/workspaces')
  .version(require('../package.json').version);

program
  .command('hoist-dev-deps')
  .description('Hoist devDependencies from individual packages to the workspace root')
  .option('--exclude <deps...>', "Don't hoist these devDependencies")
  .addOption(
    new Option(
      '--only <deps...>',
      'Only hoist these devDependencies (mutually exclusive with other options)',
    ).conflicts(['always', 'exclude', 'threshold']),
  )
  .addOption(
    new Option('--threshold <percent>', 'Only hoist devDependencies used in >= this % of packages')
      .default(0, '0, hoist everything')
      .conflicts(['only'])
      .argParser((value) => {
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 0 || numValue > 100)
          throw new InvalidArgumentError('Must be a number between 0 and 100 (inclusive).');
        // interpret threshold <= 1 as a percentage
        return numValue <= 1 ? numValue : numValue / 100;
      }),
  )
  .option(
    '--always <deps...>',
    'Always hoist these devDependencies (only relevant with --threshold)',
  )
  .action((options) => {
    hoistDevDeps(options);
  });

program
  .command('star-local-dev-deps')
  .description('Change version specs of devDependencies on local packages to "*"')
  .action(() => {
    starLocalDevDeps();
  });

program.parse();
