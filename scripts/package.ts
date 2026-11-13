import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const files = ['manifest.json', 'main.js', 'styles.css', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES'];
const entries: Record<string, Uint8Array> = {};
for (const file of files) entries[`iconario/${file}`] = strToU8(readFileSync(join(root, file), 'utf8'));
const output = join(root, 'dist', 'iconario-0.1.0.zip');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, zipSync(entries, { level: 9 }));
console.log(`Created ${output}`);
