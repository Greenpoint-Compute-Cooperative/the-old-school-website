import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'index.html');
const index = await readFile(indexPath, 'utf8');
const vercel = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
const failures = [];

const digest = (source) => `sha256-${createHash('sha256').update(source).digest('base64')}`;
const blockPattern = /<(style|script)(?:\s+type="([^"]+)")?>([\s\S]*?)<\/\1>/g;
const blocks = [...index.matchAll(blockPattern)].map((match) => ({
  kind: match[2] || match[1],
  hash: digest(match[3]),
}));

const metaCsp = index.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)" \/>/)?.[1];
if (!metaCsp) failures.push('index.html is missing its Content-Security-Policy meta element.');

const headerSet = vercel.headers?.flatMap((rule) => rule.headers || []) || [];
const headerCsp = headerSet.find((header) => header.key === 'Content-Security-Policy')?.value;
if (!headerCsp) failures.push('vercel.json is missing its Content-Security-Policy header.');

for (const { kind, hash } of blocks) {
  if (!metaCsp?.includes(`'${hash}'`)) failures.push(`CSP meta element is missing the current ${kind} hash: ${hash}`);
  if (!headerCsp?.includes(`'${hash}'`)) failures.push(`Vercel CSP header is missing the current ${kind} hash: ${hash}`);
}

if (/https?:\/\//.test(index.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1] || '')) {
  failures.push('The import map still executes a third-party network dependency.');
}

const vendorRoot = path.join(root, 'public/vendor/three');
for (const required of ['LICENSE', 'README.md', 'three.module.min.js']) {
  try {
    await access(path.join(vendorRoot, required));
  } catch {
    failures.push(`Missing vendored Three.js file: public/vendor/three/${required}`);
  }
}

const visit = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(fullPath);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;
    const source = await readFile(fullPath, 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      if (!match[1].startsWith('.')) continue;
      const imported = path.resolve(path.dirname(fullPath), match[1]);
      try {
        await access(imported);
      } catch {
        failures.push(`Missing vendored import: ${path.relative(root, imported)} (from ${path.relative(root, fullPath)})`);
      }
    }
  }
};

await visit(path.join(vendorRoot, 'addons'));

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

const placeholders = [...index.matchAll(/href="#"/g)].length;
console.log(`Release mechanics pass: ${blocks.length} CSP hashes match and vendored imports resolve.`);
if (placeholders) console.log(`Intentional inactive destinations: ${placeholders} cards currently point to this page.`);
