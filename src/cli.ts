import { InvalidArgumentError, Option, program } from 'commander';
import { PackageInfo } from 'workspace-tools';
import { hoistDevDeps } from './commands/hoistDevDeps';
import { starLocalDevDeps } from './commands/starLocalDevDeps';
import { unpinDevDeps } from './commands/unpinDevDeps';

program
  .name('better-deps')
  .description('CLI for cleaning up issues with JavaScript dependencies in monorepos/workspaces')
  .version(require('../package.json').version);

const checkOption = new Option(
  '--check',
  'Check for issues without making any changes, and exit non-zero if issues are found',
);

function handleResult(res: PackageInfo[], check: boolean) {
  console.log();
  if (!check) {
    console.log(`✅ Updated ${res.length} packages\n`);
  } else if (res.length) {
    console.error(`Found ${res.length} packages with new issues!`);
    const command = process.argv
      .slice(2)
      .filter((arg) => arg !== '--check')
      .join(' ');
    console.error(`Run this command to fix them:\n\n  npx better-deps ${command}\n`);
    process.exit(1);
  } else {
    console.log('✅ No issues found!\n');
  }
}

program
  .command('hoist-dev-deps')
  .description('Hoist devDependencies from individual packages to the workspace root')
  .addOption(checkOption)
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
  .action(({ check, ...options }) => {
    const res = hoistDevDeps({ ...options, write: !check });
    handleResult(res, !!check);
  });

program
  .command('star-local-dev-deps')
  .description('Change version specs of devDependencies on local packages to "*"')
  .addOption(checkOption)
  .action(({ check }) => {
    const res = starLocalDevDeps(!check);
    handleResult(res, !!check);
  });

program
  .command('unpin-dev-deps')
  .description('Change exact versions of external devDependencies to use ranges')
  .addOption(checkOption)
  .option('--exclude <deps...>', "Don't modify these devDependencies")
  .addOption(
    new Option('--range <type>', 'Use this range type by default ("minor" or "patch")')
      .choices(['minor', 'patch'])
      .default('minor'),
  )
  .option('--patch <deps...>', 'Use patch ranges (~) for these devDependencies')
  .option('--minor <deps...>', 'Use minor ranges (^) for these devDependencies')
  .action(({ check, ...options }) => {
    const res = unpinDevDeps({ ...options, write: !check });
    handleResult(res, !!check);
  });

program.parse();
