const fs = require('fs');
const path = require('path');

const SUPPORTED_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];
const DEFAULT_IGNORE = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache', 'vendor',
  'test', 'tests', 'perf', 'examples', 'example', 'demo', 'demos',
  'benchmark', 'benchmarks', 'scripts',
]);

function walkDir(dir, { ignore = [] } = {}, files = []) {
  const ignoreDirs = new Set([...DEFAULT_IGNORE, ...ignore]);

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) {
        walkDir(path.join(dir, entry.name), { ignore }, files);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SUPPORTED_EXTENSIONS.includes(ext) && !entry.name.endsWith('.d.ts')) {
        files.push(path.join(dir, entry.name));
      }
    }
  }

  return files;
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

module.exports = { walkDir, readFile };
