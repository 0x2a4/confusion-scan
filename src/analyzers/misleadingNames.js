const traverse = require('@babel/traverse').default;

const READ_SIGNALS = ['get', 'fetch', 'load', 'read', 'find', 'search', 'check', 'is', 'has', 'can', 'should'];
const WRITE_SIGNALS = ['set', 'save', 'write', 'delete', 'remove', 'update', 'create', 'add', 'send', 'post', 'put', 'clear', 'reset', 'destroy', 'mutate', 'dispatch', 'emit', 'push', 'pop'];

function extractNameSignal(name) {
  const lower = name.toLowerCase();
  for (const word of READ_SIGNALS) {
    if (lower.startsWith(word)) return 'read';
  }
  for (const word of WRITE_SIGNALS) {
    if (lower.startsWith(word)) return 'write';
  }
  return null;
}

function detectBodySignals(node, ast) {
  const signals = { reads: [], writes: [] };

  function visitNode(n) {
    if (!n || typeof n !== 'object') return;

    if (n.type === 'CallExpression') {
      const callee = n.callee;
      let callName = '';
      if (callee.type === 'Identifier') callName = callee.name;
      else if (callee.type === 'MemberExpression' && callee.property?.name) callName = callee.property.name;

      if (callName) {
        const sig = extractNameSignal(callName);
        if (sig === 'write') signals.writes.push(callName);
        if (sig === 'read') signals.reads.push(callName);
      }
    }

    if (n.type === 'AssignmentExpression') {
      const left = n.left;
      if (left.type === 'MemberExpression') {
        const obj = left.object?.name || '';
        const prop = left.property?.name || '';
        const combined = (obj + prop).toLowerCase();
        if (['localstorage', 'sessionstorage', 'cookie', 'cache', 'db', 'store', 'state'].some(k => combined.includes(k))) {
          signals.writes.push(`${obj}.${prop}`);
        }
      }
    }

    for (const key of Object.keys(n)) {
      if (key === 'type') continue;
      const child = n[key];
      if (Array.isArray(child)) {
        child.forEach(c => { if (c && typeof c === 'object' && c.type) visitNode(c); });
      } else if (child && typeof child === 'object' && child.type) {
        visitNode(child);
      }
    }
  }

  if (node.body) visitNode(node.body);
  return signals;
}

function getFunctionName(path) {
  const node = path.node;
  if (node.id?.name) return node.id.name;
  if (path.parent?.type === 'VariableDeclarator' && path.parent.id?.name) return path.parent.id.name;
  if (path.parent?.type === 'AssignmentExpression' && path.parent.left?.name) return path.parent.left.name;
  if (path.parent?.type === 'Property' && path.parent.key?.name) return path.parent.key.name;
  if (path.parent?.type === 'MethodDefinition' && path.parent.key?.name) return path.parent.key.name;
  return null;
}

function analyze(ast, filePath) {
  const issues = [];

  traverse(ast, {
    'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression'(path) {
      const name = getFunctionName(path);
      if (!name || name.length < 3) return;

      const nameSignal = extractNameSignal(name);
      if (!nameSignal) return;

      const bodySignals = detectBodySignals(path.node, ast);

      if (nameSignal === 'read' && bodySignals.writes.length > 0) {
        issues.push({
          type: 'misleading-name',
          file: filePath,
          line: path.node.loc?.start?.line,
          message: `\`${name}()\` implies a read but also calls: ${[...new Set(bodySignals.writes)].slice(0, 3).join(', ')}`,
        });
      }
    },
  });

  return issues;
}

module.exports = { analyze };
