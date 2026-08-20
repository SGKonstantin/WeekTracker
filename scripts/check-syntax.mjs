import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'src');
const errors = [];

function checkJavaScript(source, filename) {
  try {
    new vm.Script(source, { filename });
  } catch (error) {
    errors.push(`${filename}: ${error.message}`);
  }
}

const productionFiles = fs.readdirSync(sourceRoot, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.gs'))
  .map(entry => entry.name)
  .sort();

if (productionFiles.length === 0) {
  errors.push('No production .gs files found in src/.');
}

for (const filename of productionFiles) {
  const source = fs.readFileSync(path.join(sourceRoot, filename), 'utf8');
  checkJavaScript(source, `src/${filename}`);
}

const indexFilename = 'Index.html';
const indexPath = path.join(sourceRoot, indexFilename);
if (!fs.existsSync(indexPath)) {
  errors.push(`src/${indexFilename}: file not found`);
} else {
  const html = fs.readFileSync(indexPath, 'utf8');
  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts = [...html.matchAll(scriptPattern)];
  if (scripts.length === 0) {
    errors.push(`${indexFilename}: no inline <script> blocks found`);
  }
  scripts.forEach((match, index) => {
    checkJavaScript(match[1], `src/${indexFilename}#script-${index + 1}`);
  });
}

if (errors.length > 0) {
  console.error('Syntax check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Syntax check passed: ${productionFiles.length} src/*.gs files and src/Index.html scripts.`);
}
