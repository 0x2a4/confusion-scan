#!/usr/bin/env node

const chalk = require('chalk');
const path = require('path');
const { scan } = require('../src/index');
const { version } = require('../package.json');

const ISSUE_ORDER = [
  'misleading-name',
  'duplicate-logic',
  'large-file',
  'large-function',
  'complex-function',
  'naming-inconsistency',
  'dead-file',
];

const LABELS = {
  'misleading-name':      chalk.yellow('Misleading function name'),
  'naming-inconsistency': chalk.yellow('Naming inconsistency'),
  'duplicate-logic':      chalk.magenta('Duplicate logic'),
  'large-file':           chalk.red('File too large'),
  'large-function':       chalk.red('Function too large'),
  'complex-function':     chalk.red('High complexity'),
  'dead-file':            chalk.gray('Possible dead file'),
};

const SUMMARY_LABELS = {
  'misleading-name':      'misleading names',
  'naming-inconsistency': 'naming inconsistencies',
  'duplicate-logic':      'duplicate logic blocks',
  'large-file':           'oversized files',
  'large-function':       'oversized functions',
  'complex-function':     'high-complexity functions',
  'dead-file':            'dead files',
};

function groupByType(issues) {
  const groups = new Map();
  for (const issue of issues) {
    if (!groups.has(issue.type)) groups.set(issue.type, []);
    groups.get(issue.type).push(issue);
  }
  return groups;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { json: false, ignore: [], help: false, version: false, dir: null };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') { opts.json = true; continue; }
    if (arg === '--help' || arg === '-h') { opts.help = true; continue; }
    if (arg === '--version' || arg === '-v') { opts.version = true; continue; }
    if (arg === '--ignore' || arg === '-i') {
      const val = args[++i];
      if (val) opts.ignore.push(...val.split(',').map(s => s.trim()).filter(Boolean));
      continue;
    }
    if (arg.startsWith('--ignore=')) {
      const val = arg.slice('--ignore='.length);
      opts.ignore.push(...val.split(',').map(s => s.trim()).filter(Boolean));
      continue;
    }
    if (!arg.startsWith('-')) opts.dir = arg;
  }

  return opts;
}

function printIssue(issue) {
  const label = LABELS[issue.type] || issue.type;

  process.stdout.write('\n');
  process.stdout.write(`⚠ ${label}\n`);

  if (issue.file && issue.line) {
    process.stdout.write(`  ${chalk.dim(issue.file + ':' + issue.line)}\n`);
  } else if (issue.file) {
    process.stdout.write(`  ${chalk.dim(issue.file)}\n`);
  }

  process.stdout.write(`  ${issue.message}\n`);

  if (issue.locations) {
    for (const loc of issue.locations.slice(0, 5)) {
      process.stdout.write(`  ${chalk.dim('→')} ${chalk.dim(loc)}\n`);
    }
    if (issue.locations.length > 5) {
      process.stdout.write(`  ${chalk.dim(`  ...and ${issue.locations.length - 5} more`)}\n`);
    }
  }
}

function printSummary(issues, fileCount, score) {
  const groups = groupByType(issues);
  process.stdout.write('\n');
  process.stdout.write(chalk.dim('─'.repeat(60)) + '\n');

  if (issues.length === 0) {
    process.stdout.write(
      chalk.green(`✓ No issues found across ${fileCount} file${fileCount === 1 ? '' : 's'}.`) +
      chalk.dim(` Confusion score: 100/100`) + '\n'
    );
    return;
  }

  process.stdout.write(
    chalk.bold(`${issues.length} issue${issues.length === 1 ? '' : 's'} found`) +
    chalk.dim(` across ${fileCount} file${fileCount === 1 ? '' : 's'}`) +
    chalk.dim(` · Confusion score: ${score}/100`) + '\n'
  );
  process.stdout.write('\n');

  for (const type of ISSUE_ORDER) {
    const group = groups.get(type);
    if (!group) continue;
    const label = SUMMARY_LABELS[type] || type;
    process.stdout.write(`  ${chalk.dim('·')} ${group.length} ${label}\n`);
  }
  process.stdout.write('\n');
}

function printHelp() {
  process.stdout.write(`
${chalk.bold('confusion-scan')} v${version}
Scan a project for confusing code patterns.

${chalk.bold('Usage:')}
  confusion-scan <directory> [options]

${chalk.bold('Options:')}
  --json              Output results as JSON (for CI / scripts)
  --ignore <dirs>, -i Comma-separated list of directories to skip
  --version, -v       Print version
  --help, -h          Print this help

${chalk.bold('Examples:')}
  confusion-scan ./src
  confusion-scan . --ignore generated,__snapshots__
  confusion-scan ./src --json > report.json

${chalk.bold('Detects:')}
  • Misleading function names (reads that secretly write)
  • Naming inconsistencies (userId vs user_id vs userid)
  • Duplicate logic across files
  • Oversized files and functions
  • High cyclomatic complexity
  • Dead files (never imported)
`);
}

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.version) {
    process.stdout.write(`confusion-scan v${version}\n`);
    process.exit(0);
  }

  if (opts.help || !opts.dir) {
    printHelp();
    process.exit(opts.help ? 0 : 1);
  }

  let result;
  try {
    if (!opts.json) {
      process.stdout.write('\n');
      process.stdout.write(chalk.bold('confusion-scan') + chalk.dim(` scanning ${path.resolve(opts.dir)}`));
      if (opts.ignore.length > 0) {
        process.stdout.write(chalk.dim(` (ignoring: ${opts.ignore.join(', ')})`));
      }
      process.stdout.write('\n');
      process.stdout.write(chalk.dim('─'.repeat(60)) + '\n');
    }

    result = await scan(opts.dir, { ignore: opts.ignore });
  } catch (err) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
    } else {
      process.stderr.write(chalk.red(`\nError: ${err.message}\n`));
    }
    process.exit(1);
  }

  const { files, issues, score } = result;

  if (opts.json) {
    const output = {
      version,
      scanned: files,
      total: issues.length,
      score,
      issues: issues.map(issue => ({
        type: issue.type,
        file: issue.file || null,
        line: issue.line || null,
        message: issue.message,
        locations: issue.locations || null,
      })),
    };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    process.exit(issues.length > 0 ? 1 : 0);
  }

  if (issues.length === 0) {
    printSummary(issues, files, score);
    process.exit(0);
  }

  const groups = groupByType(issues);
  for (const type of ISSUE_ORDER) {
    const group = groups.get(type);
    if (!group) continue;
    for (const issue of group) {
      printIssue(issue);
    }
  }

  printSummary(issues, files, score);
  process.exit(1);
}

main();
