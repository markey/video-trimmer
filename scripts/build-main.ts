import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';

const outDir = path.resolve('out');
fs.mkdirSync(outDir, { recursive: true });

async function run() {
  await build({
    entryPoints: ['src/main/main.ts', 'src/main/preload.ts'],
    outdir: 'out',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    sourcemap: true,
    target: 'node18',
    external: ['electron']
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

