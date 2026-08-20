import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const requiredFiles = [
  'Code.gs',
  'Core.gs',
  'Repository.gs',
  'Setup.gs',
  'Menu.gs',
  'Index.html',
  'appsscript.json',
  '.gitignore',
  '.claspignore',
  'package.json',
  'package-lock.json',
  'README.md',
  'README.en.md',
  'LICENSE',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'SUPPORT.md',
  'docs/INSTALLATION.md',
  'docs/USER_GUIDE.md',
  'docs/DEVELOPMENT.md',
  'docs/DATA_AND_PRIVACY.md',
  'docs/TROUBLESHOOTING.md',
];

const forbiddenLanguageDuplicates = [
  'README.ru.md',
  'docs/INSTALLATION.ru.md',
  'docs/USER_GUIDE.ru.md',
  'docs/DEVELOPMENT.ru.md',
  'docs/DATA_AND_PRIVACY.ru.md',
  'docs/TROUBLESHOOTING.ru.md',
];

const requiredIgnorePatterns = [
  '.clasp.json',
  '.clasprc.json',
  '.env',
  '.env.*',
  'credentials.json',
  'credentials*.json',
  'client_secret*.json',
  'service-account*.json',
  '*.pem',
  '*.key',
  '.DS_Store',
  'node_modules/',
];

for (const filename of requiredFiles) {
  if (!fs.existsSync(path.join(projectRoot, filename))) {
    errors.push(`${filename}: required file is missing`);
  }
}

for (const filename of forbiddenLanguageDuplicates) {
  if (fs.existsSync(path.join(projectRoot, filename))) {
    errors.push(`${filename}: obsolete language duplicate must be removed`);
  }
}

const gitignorePath = path.join(projectRoot, '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const ignoreLines = fs.readFileSync(gitignorePath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  const ignored = new Set(ignoreLines);
  for (const pattern of requiredIgnorePatterns) {
    if (!ignored.has(pattern)) {
      errors.push(`.gitignore: missing security pattern ${pattern}`);
    }
  }
}

function walk(directory, relativeDirectory = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolutePath, relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

const projectFiles = walk(projectRoot);

function isForbiddenCredentialFile(relativePath) {
  const basename = path.basename(relativePath);
  if (basename === '.clasp.json' || basename === '.DS_Store' || basename === '.env.example') {
    return false;
  }
  return basename === '.clasprc.json' ||
    basename === '.env' ||
    basename.startsWith('.env.') ||
    /^credentials.*\.json$/i.test(basename) ||
    /^client_secret.*\.json$/i.test(basename) ||
    /^service-account.*\.json$/i.test(basename) ||
    /\.(pem|key)$/i.test(basename);
}

for (const relativePath of projectFiles) {
  if (isForbiddenCredentialFile(relativePath)) {
    errors.push(`${relativePath}: forbidden credential-like file`);
  }
}

const textExtensions = new Set(['.gs', '.html', '.js', '.mjs', '.json', '.md', '.txt', '.css']);
const scanFiles = projectFiles.filter(relativePath => {
  if (relativePath === '.clasp.json' || relativePath === 'package-lock.json') return false;
  if (relativePath.startsWith(`scripts${path.sep}`)) return false;
  return textExtensions.has(path.extname(relativePath).toLowerCase());
});

const secretPatterns = [
  ['hardcoded Google Spreadsheet URL', /https?:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+/i],
  ['hardcoded Apps Script deployment URL', /https?:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/(?:exec|dev)/i],
  ['OAuth refresh token', /["']?refresh_token["']?\s*[:=]\s*["'][^"'\r\n]+/i],
  ['private key field', /["']?private_key["']?\s*:\s*["'][^"'\r\n]+/i],
  ['client secret field', /["']?client_secret["']?\s*:\s*["'][^"'\r\n]+/i],
  ['PEM private key', /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/i],
  ['service-account credential JSON', /["']type["']\s*:\s*["']service_account["']/i],
];

for (const relativePath of scanFiles) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  for (const [problem, pattern] of secretPatterns) {
    if (pattern.test(source)) errors.push(`${relativePath}: ${problem}`);
  }
}

const publicFiles = projectFiles.filter(relativePath => {
  if (relativePath.startsWith(`tests${path.sep}`) || relativePath.startsWith(`scripts${path.sep}`)) return false;
  if (relativePath.startsWith('.')) return false;
  const extension = path.extname(relativePath).toLowerCase();
  return ['.gs', '.html', '.json', '.md'].includes(extension) && relativePath !== 'package-lock.json';
});

for (const relativePath of publicFiles) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  if (/WeekArc/i.test(source)) {
    errors.push(`${relativePath}: forbidden legacy project name WeekArc`);
  }
}

if (errors.length > 0) {
  console.error('Project safety check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Project safety check passed: ${requiredFiles.length} required files, no exposed secrets or legacy names.`);
}
