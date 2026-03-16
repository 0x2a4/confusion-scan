const traverse = require('@babel/traverse').default;

const FILE_LINE_THRESHOLD = 300;
const FUNCTION_LINE_THRESHOLD = 60;
const FUNCTION_COMPLEXITY_THRESHOLD = 10;

function countComplexity(node) {
  let count = 1;

  function walk(n) {
    if (!n || typeof n !== 'object') return;
    switch (n.type) {
      case 'IfStatement':
      case 'ConditionalExpression':
      case 'WhileStatement':
      case 'DoWhileStatement':
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement':
      case 'CatchClause':
        count++;
        break;
      case 'LogicalExpression':
        if (n.operator === '&&' || n.operator === '||' || n.operator === '??') count++;
        break;
      case 'SwitchCase':
        if (n.test !== null) count++;
        break;
    }
    for (const key of Object.keys(n)) {
      if (key === 'type') continue;
      const child = n[key];
      if (Array.isArray(child)) child.forEach(c => { if (c && typeof c === 'object' && c.type) walk(c); });
      else if (child && typeof child === 'object' && child.type) walk(child);
    }
  }

  walk(node);
  return count;
}

function getFunctionName(path) {
  const node = path.node;
  if (node.id?.name) return node.id.name;
  if (path.parent?.type === 'VariableDeclarator') return path.parent.id?.name || null;
  if (path.parent?.type === 'Property') return path.parent.key?.name || null;
  if (path.parent?.type === 'MethodDefinition') return path.parent.key?.name || null;
  return null;
}

function analyze(ast, filePath, lineCount) {
  const issues = [];

  if (lineCount > FILE_LINE_THRESHOLD) {
    issues.push({
      type: 'large-file',
      file: filePath,
      message: `File is ${lineCount} lines long`,
    });
  }

  traverse(ast, {
    'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression'(path) {
      const node = path.node;
      const name = getFunctionName(path);
      if (!name) return;

      const start = node.loc?.start?.line;
      const end = node.loc?.end?.line;
      if (!start || !end) return;

      const lineCount = end - start;
      const complexity = countComplexity(node);

      if (lineCount > FUNCTION_LINE_THRESHOLD) {
        issues.push({
          type: 'large-function',
          file: filePath,
          line: start,
          message: `\`${name}()\` is ${lineCount} lines long`,
        });
      }
      if (complexity >= FUNCTION_COMPLEXITY_THRESHOLD) {
        issues.push({
          type: 'complex-function',
          file: filePath,
          line: start,
          message: `\`${name}()\` has cyclomatic complexity of ${complexity}`,
        });
      }
    },
  });

  return issues;
}

module.exports = { analyze };
