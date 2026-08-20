import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function checkJavaScript(source, filename) {
  try {
    new vm.Script(source, { filename });
  } catch (error) {
    errors.push(`${filename}: ${error.message}`);
  }
}

const productionFiles = fs.readdirSync(projectRoot, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.gs'))
  .map(entry => entry.name)
  .sort();

if (productionFiles.length === 0) {
  errors.push('No production .gs files found in the project root.');
}

for (const filename of productionFiles) {
  const source = fs.readFileSync(path.join(projectRoot, filename), 'utf8');
  checkJavaScript(source, filename);
}

const indexFilename = 'Index.html';
const indexPath = path.join(projectRoot, indexFilename);
if (!fs.existsSync(indexPath)) {
  errors.push(`${indexFilename}: file not found`);
} else {
  const html = fs.readFileSync(indexPath, 'utf8');
  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts = [...html.matchAll(scriptPattern)];
  if (scripts.length === 0) {
    errors.push(`${indexFilename}: no inline <script> blocks found`);
  }
  scripts.forEach((match, index) => {
    checkJavaScript(match[1], `${indexFilename}#script-${index + 1}`);
  });
}

if (errors.length > 0) {
  console.error('Syntax check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Syntax check passed: ${productionFiles.length} .gs files and Index.html scripts.`);
}
