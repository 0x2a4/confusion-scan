const traverse = require('@babel/traverse').default;
const path = require('path');
const fs = require('fs');

function collectImports(ast, currentFile) {
  const imported = new Set();
  const dir = path.dirname(currentFile);

  traverse(ast, {
    ImportDeclaration(p) {
      const source = p.node.source?.value;
      if (source && (source.startsWith('.') || source.startsWith('/'))) {
        const resolved = tryResolve(source, dir);
        if (resolved) imported.add(resolved);
      }
    },
    CallExpression(p) {
      const { callee, arguments: args } = p.node;
      const isRequire = callee.type === 'Identifier' && callee.name === 'require';
      const isDynamicImport = callee.type === 'Import';
      if ((isRequire || isDynamicImport) && args[0]?.type === 'StringLiteral') {
        const source = args[0].value;
        if (source.startsWith('.') || source.startsWith('/')) {
          const resolved = tryResolve(source, dir);
          if (resolved) imported.add(resolved);
        }
      }
    },
  });

  return imported;
}

function tryResolve(source, dir) {
  const extensions = ['', '.js', '.ts', '.jsx', '.tsx', '.mjs', '/index.js', '/index.ts'];
  for (const ext of extensions) {
    const full = path.resolve(dir, source + ext);
    try {
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        return full;
      }
    } catch {
    }
  }
  return null;
}

function getPackageName(rootDir) {
  let dir = rootDir;
  for (let i = 0; i < 4; i++) {
    try {
      const pkgPath = path.join(dir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) return pkg.name.replace(/^@[^/]+\//, '');
    } catch {
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function findDeadFiles(allFiles, importedFiles, rootDir) {
  const issues = [];
  const pkgName = getPackageName(rootDir);

  const entryPatterns = new Set([
    'index.js', 'index.ts', 'main.js', 'main.ts',
    'app.js', 'app.ts', 'server.js', 'server.ts',
    'index.jsx', 'index.tsx',
  ]);
  if (pkgName) {
    entryPatterns.add(`${pkgName}.js`);
    entryPatterns.add(`${pkgName}.ts`);
  }

  for (const file of allFiles) {
    const basename = path.basename(file);
    const ext = path.extname(file);
    if (entryPatterns.has(basename)) continue;
    if (ext === '.d.ts' || basename.endsWith('.d.ts') || basename.endsWith('.test-d.ts')) continue;
    if (basename.includes('.test.') || basename.includes('.spec.') || basename.includes('.config.')) continue;
    if (basename.startsWith('_')) continue;

    if (!importedFiles.has(file)) {
      const rel = path.relative(rootDir, file);
      issues.push({
        type: 'dead-file',
        file: rel,
        message: `\`${rel}\` is never imported`,
      });
    }
  }

  return issues;
}

module.exports = { collectImports, findDeadFiles };
