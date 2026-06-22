#!/usr/bin/env node
// Launches Electron without ELECTRON_RUN_AS_NODE (which VS Code terminal sets)
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const electronExe = path.join(__dirname, 'launcher', 'node_modules', 'electron', 'dist', 'electron.exe');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const proc = spawn(electronExe, ['.'], {
  cwd:   __dirname,
  env,
  stdio: 'inherit',
});

proc.on('exit', (code) => process.exit(code ?? 0));
