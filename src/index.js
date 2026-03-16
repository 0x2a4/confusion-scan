const path = require('path');
const { walkDir, readFile } = require('./utils/fileScanner');
const { parseFile } = require('./utils/astParser');
const misleadingNames = require('./analyzers/misleadingNames');
const namingConsistency = require('./analyzers/namingConsistency');
const duplicateLogic = require('./analyzers/duplicateLogic');
const fileSizeAnalyzer = require('./analyzers/fileSizeAnalyzer');
const deadFiles = require('./analyzers/deadFiles');

const SCORE_WEIGHTS = {
  'misleading-name': 5,
  'duplicate-logic': 4,
  'complex-function': 4,
  'large-file': 3,
  'large-function': 3,
  'naming-inconsistency': 2,
  'dead-file': 1,
};

function computeScore(issues) {
  const deductions = issues.reduce((sum, i) => sum + (SCORE_WEIGHTS[i.type] || 0), 0);
  return Math.max(0, 100 - deductions);
}

async function scan(targetDir, { ignore = [] } = {}) {
  const absTarget = path.resolve(targetDir);
  const files = walkDir(absTarget, { ignore });

  if (files.length === 0) {
    return { files: 0, issues: [], score: 100 };
  }

  const allIssues = [];
  const allFunctionBlocks = new Map();
  const importedFiles = new Set();

  for (const file of files) {
    const code = readFile(file);
    if (!code) continue;

    const lineCount = code.split('\n').length;
    const ast = parseFile(code);
    if (!ast) continue;

    const relFile = path.relative(absTarget, file);

    const fileImports = deadFiles.collectImports(ast, file);
    for (const imp of fileImports) importedFiles.add(imp);

    const fileIssues = [
      ...misleadingNames.analyze(ast, relFile),
      ...namingConsistency.analyze(ast, relFile),
      ...fileSizeAnalyzer.analyze(ast, relFile, lineCount),
    ];
    allIssues.push(...fileIssues);

    duplicateLogic.analyze(ast, relFile, allFunctionBlocks);
  }

  const dupIssues = duplicateLogic.findDuplicates(allFunctionBlocks);
  allIssues.push(...dupIssues);

  const deadFileIssues = deadFiles.findDeadFiles(files, importedFiles, absTarget);
  allIssues.push(...deadFileIssues);

  return { files: files.length, issues: allIssues, score: computeScore(allIssues) };
}

module.exports = { scan };
