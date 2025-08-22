import { spawn } from 'node:child_process';
import path from 'node:path';

const electronPath = require('electron');

const mainPath = path.resolve('out/main/main.cjs');

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));

