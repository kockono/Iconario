import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
await build({
  entryPoints: [join(root, 'src/main.ts')],
  outfile: join(root, 'main.js'),
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  external: ['obsidian', 'electron', '@codemirror/state', '@codemirror/view', '@codemirror/language'],
  logLevel: 'info',
});
