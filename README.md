# confusion-scan

Find confusing parts of a codebase before someone else has to debug them.

Most linters focus on syntax, formatting, and style rules.  
confusion-scan looks for patterns that are technically valid code but still confusing for humans — misleading names, duplicated logic, dead files, and functions that have grown too large.

---

## Why this exists

A lot of bugs don’t come from syntax errors. They come from code that technically works but is difficult to understand or trust.

Common examples:

- a function called `getUser()` that secretly writes to storage
- the same logic copy-pasted across multiple files
- `userId`, `user_id`, and `userid` all used in the same file
- old helper files nobody imports anymore
- functions that slowly turn into 100-line monsters

confusion-scan scans a project and highlights these patterns so they’re easier to notice and fix.

---

## Install

Install globally or run directly with npx:

npm install -g confusion-scan  
npx confusion-scan ./src

---

## Usage

confusion-scan <directory> [options]

### Options

| Flag | Description |
|---|---|
| --json | output results as JSON (useful for CI, scripts, or editor integrations) |
| --ignore <dirs> | comma-separated directories to skip |
| --version, -v | print version |
| --help, -h | show help |

---

## Examples

Scan a project:

confusion-scan ./src

Skip generated directories:

confusion-scan . --ignore generated,__snapshots__,migrations

Generate JSON output:

confusion-scan ./src --json > report.json

Exit code is **1 if issues are found** and **0 if clean**, so it works naturally in CI pipelines.

---

## Example output

confusion-scan scanning /your/project
────────────────────────────────────

⚠ Misleading function name  
auth.js:12  
`getUserData()` sounds read-only but also calls: setItem, delete

⚠ Duplicate logic  
Identical function body found in 2 places  
→ auth.js:12 (getUserData)  
→ middleware/auth.js:8 (getUserData)

⚠ Function too large  
server.js:204  
`handleRequest()` is 94 lines long

⚠ High complexity  
server.js:204  
`handleRequest()` has cyclomatic complexity 18

⚠ Naming inconsistency  
utils.js  
Mixed styles: userId, user_id, userid

⚠ Possible dead file  
helpers/legacyUtils.js  
File appears to never be imported

────────────────────────────────────
6 issues found across 12 files

· 1 misleading names  
· 1 duplicate logic blocks  
· 1 oversized functions  
· 1 high-complexity functions  
· 1 naming inconsistencies  
· 1 dead files

---

## JSON output

Use --json to get structured output:

{
  "version": "1.0.0",
  "scanned": 12,
  "total": 6,
  "issues": [
    {
      "type": "misleading-name",
      "file": "auth.js",
      "line": 12,
      "message": "`getUserData()` sounds read-only but also calls: setItem, delete",
      "locations": null
    },
    {
      "type": "duplicate-logic",
      "file": null,
      "line": null,
      "message": "Identical function body found in 2 places",
      "locations": [
        "auth.js:12 (getUserData)",
        "middleware/auth.js:8 (getUserData)"
      ]
    }
  ]
}

---

## What it detects

### Misleading function names

Functions whose names imply one behavior but whose bodies do something else.

Example:

function getUserData(userId) {
  const user = db.find(userId);
  localStorage.setItem('last_user', userId);
  cache.delete('user_' + userId);
  return user;
}

Names starting with words like `get`, `fetch`, `load`, `read`, `find`, `is`, or `has` are treated as read operations and flagged if they perform writes.

---

### Naming inconsistency

The same concept written multiple ways in the same file.

Example:

const userId = req.params.id  
const user_id = token.sub  
const userid = body.userId

---

### Duplicate logic

Identical function bodies across multiple files, usually a sign of copy-paste.

Detection is based on AST structure, so variable renames don’t hide duplicates.

---

### Oversized files

Files over **300 lines** are flagged. Large files are harder to navigate and review.

---

### Oversized functions

Functions over **60 lines** are flagged. These often do too many things.

---

### High complexity

Functions with cyclomatic complexity ≥ **10** are flagged.

Branches counted include:

if, for, while, catch, switch cases, logical operators (&&, ||, ??), and ternaries.

---

### Dead files

Files that are never imported anywhere in the scanned project.

Entry files and common config/test files are automatically ignored.

---

## Supported languages

JavaScript  
TypeScript  
JSX / TSX

Supported file extensions:

.js  
.mjs  
.cjs  
.ts  
.jsx  
.tsx

---

## Limitations

Misleading names detection currently focuses on read-style names performing writes.

Dead file detection relies on static import analysis, so dynamic requires may not be tracked.

Naming consistency is currently checked per-file.

Duplicate detection requires structural matches and won’t catch near-duplicates.

---

## Roadmap

- configurable thresholds for size and complexity
- `.confusionignore` support
- HTML or markdown reports
- near-duplicate detection
- CI annotations / PR comments
- optional tech debt score

---

## License

MIT