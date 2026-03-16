const traverse = require('@babel/traverse').default;

const JS_BUILTINS = new Set([
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'BigInt',
  'Error', 'TypeError', 'SyntaxError', 'RangeError', 'ReferenceError',
  'Buffer', 'JSON', 'Math', 'URL', 'URLSearchParams', 'Function',
  'Int8Array', 'Uint8Array', 'Uint16Array', 'Int16Array', 'Int32Array',
  'Uint32Array', 'Float32Array', 'Float64Array', 'ArrayBuffer', 'DataView',
  'Proxy', 'Reflect', 'Generator', 'AsyncFunction', 'Atomics', 'TypedArray',
  'Response', 'Request', 'Headers', 'Blob', 'File', 'FormData',
  'ReadableStream', 'WritableStream', 'TransformStream',
  'TextDecoder', 'TextEncoder', 'Crypto', 'SubtleCrypto',
  'Event', 'EventEmitter', 'AbortController', 'AbortSignal',
  'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
  'WebSocket', 'Worker', 'SharedArrayBuffer',
]);

function detectStyle(name) {
  if (!name || name.length < 2) return null;
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return 'camelCase';
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'PascalCase';
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) return 'snake_case';
  if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(name)) return 'SCREAMING_SNAKE';
  return null;
}

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/^(get|set|is|has|can|user|current|temp|tmp|new|old|my|the|a|an)/, '')
    .replace(/(id|ids|data|info|list|map|obj|object|item|items|val|value|num|count|str|string)$/, '')
    .replace(/[_-]/g, '');
}

function analyze(ast, filePath) {
  const issues = [];
  const nameGroups = new Map();

  function record(name) {
    if (!name || name.length < 3) return;
    if (JS_BUILTINS.has(name)) return;
    const style = detectStyle(name);
    if (!style) return;
    const base = normalize(name);
    if (base.length < 2) return;

    if (!nameGroups.has(base)) nameGroups.set(base, []);
    const group = nameGroups.get(base);
    if (!group.find(e => e.original === name)) {
      group.push({ original: name, style });
    }
  }

  traverse(ast, {
    VariableDeclarator(path) {
      const id = path.node.id;
      if (id.type === 'Identifier') record(id.name);
      if (id.type === 'ObjectPattern') {
        id.properties.forEach(prop => {
          if (prop.value?.type === 'Identifier') record(prop.value.name);
          if (prop.key?.type === 'Identifier') record(prop.key.name);
        });
      }
    },
    'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression'(path) {
      path.node.params.forEach(param => {
        if (param.type === 'Identifier') record(param.name);
        if (param.type === 'AssignmentPattern' && param.left?.type === 'Identifier') record(param.left.name);
        if (param.type === 'ObjectPattern') {
          param.properties.forEach(prop => {
            if (prop.value?.type === 'Identifier') record(prop.value.name);
          });
        }
      });
    },
    ObjectProperty(path) {
      if (path.node.shorthand && path.node.key?.type === 'Identifier') {
        record(path.node.key.name);
      }
    },
  });

  for (const [, variants] of nameGroups) {
    const styles = [...new Set(variants.map(v => v.style))];
    if (styles.length > 1) {
      const names = [...new Set(variants.map(v => v.original))];
      if (names.length >= 2) {
        issues.push({
          type: 'naming-inconsistency',
          file: filePath,
          message: `Mixed naming styles: ${names.slice(0, 4).join(', ')}`,
        });
      }
    }
  }

  return issues;
}

module.exports = { analyze };
