const parser = require('@babel/parser');

const PARSE_OPTIONS = {
  sourceType: 'unambiguous',
  errorRecovery: true,
  plugins: [
    'jsx',
    'typescript',
    'decorators-legacy',
    'classProperties',
    'optionalChaining',
    'nullishCoalescingOperator',
    'dynamicImport',
  ],
};

function parseFile(code) {
  try {
    return parser.parse(code, PARSE_OPTIONS);
  } catch {
    try {
      return parser.parse(code, { ...PARSE_OPTIONS, sourceType: 'script' });
    } catch {
      return null;
    }
  }
}

module.exports = { parseFile };
