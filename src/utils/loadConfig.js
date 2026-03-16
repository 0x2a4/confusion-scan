const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  maxFileLines: 300,
  maxFunctionLines: 60,
  maxComplexity: 10,
  ignore: [],
};

function loadConfig(rootDir) {
  const configPath = path.join(rootDir, '.confusionscanrc');
  let userConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      userConfig = {};
    }
  }

  return {
    maxFileLines:      userConfig.maxFileLines      ?? DEFAULTS.maxFileLines,
    maxFunctionLines:  userConfig.maxFunctionLines  ?? DEFAULTS.maxFunctionLines,
    maxComplexity:     userConfig.maxComplexity     ?? DEFAULTS.maxComplexity,
    ignore:            userConfig.ignore             ?? DEFAULTS.ignore,
  };
}

module.exports = { loadConfig, DEFAULTS };
