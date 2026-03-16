const traverse = require('@babel/traverse').default;
const crypto = require('crypto');

function normalizeNode(node) {
  if (!node || typeof node !== 'object') return String(node);

  const parts = [node.type];

  switch (node.type) {
    case 'BinaryExpression':
    case 'LogicalExpression':
      parts.push(node.operator, normalizeNode(node.left), normalizeNode(node.right));
      break;
    case 'CallExpression':
      parts.push(normalizeNode(node.callee));
      if (node.arguments) parts.push(...node.arguments.map(normalizeNode));
      break;
    case 'MemberExpression':
      parts.push(normalizeNode(node.object), normalizeNode(node.property));
      break;
    case 'IfStatement':
      parts.push(normalizeNode(node.test), normalizeNode(node.consequent), normalizeNode(node.alternate));
      break;
    case 'ReturnStatement':
      parts.push(normalizeNode(node.argument));
      break;
    case 'ExpressionStatement':
      parts.push(normalizeNode(node.expression));
      break;
    case 'AssignmentExpression':
      parts.push(node.operator, normalizeNode(node.left), normalizeNode(node.right));
      break;
    case 'BlockStatement':
      if (node.body) parts.push(...node.body.map(normalizeNode));
      break;
    case 'Identifier':
      parts.push('ID');
      break;
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      parts.push('LIT');
      break;
    default:
      if (node.body) {
        const body = Array.isArray(node.body) ? node.body : [node.body];
        parts.push(...body.map(normalizeNode));
      }
  }

  return parts.join('|');
}

function hashBlock(normalized) {
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 12);
}

function getFunctionInfo(path) {
  const node = path.node;
  let name = 'anonymous';
  if (node.id?.name) name = node.id.name;
  else if (path.parent?.type === 'VariableDeclarator') name = path.parent.id?.name || 'anonymous';
  else if (path.parent?.type === 'Property') name = path.parent.key?.name || 'anonymous';
  else if (path.parent?.type === 'MethodDefinition') name = path.parent.key?.name || 'anonymous';
  return { name, line: node.loc?.start?.line };
}

function analyze(ast, filePath, allFunctionBlocks) {
  const issues = [];

  traverse(ast, {
    'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression'(path) {
      const body = path.node.body;
      if (!body || body.type !== 'BlockStatement') return;
      if (!body.body || body.body.length < 3) return;

      const normalized = normalizeNode(body);
      const hash = hashBlock(normalized);
      const info = getFunctionInfo(path);

      if (!allFunctionBlocks.has(hash)) {
        allFunctionBlocks.set(hash, []);
      }
      allFunctionBlocks.get(hash).push({ file: filePath, ...info });
    },
  });

  return issues;
}

function findDuplicates(allFunctionBlocks) {
  const issues = [];

  for (const [hash, occurrences] of allFunctionBlocks) {
    if (occurrences.length < 2) continue;

    const byFile = new Map();
    for (const occ of occurrences) {
      if (!byFile.has(occ.file)) byFile.set(occ.file, []);
      byFile.get(occ.file).push(occ);
    }
    if (byFile.size < 2) continue;

    const locations = occurrences.map(o => `${o.file}:${o.line} (${o.name})`);
    issues.push({
      type: 'duplicate-logic',
      message: `Identical function body appears in ${occurrences.length} files`,
      locations,
    });
  }

  return issues;
}

module.exports = { analyze, findDuplicates };
