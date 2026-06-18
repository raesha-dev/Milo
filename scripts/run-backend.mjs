import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const backendDir = join(root, 'backend');
const defaultCredentialsPath = join(homedir(), '.secrets', 'milo-backend-sa.json');

function findPython() {
  const candidates = [
    process.env.PYTHON,
    join(root, 'venv', 'bin', 'python'),
    join(backendDir, 'venv', 'bin', 'python'),
    'python3',
    'python',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes('/') && !existsSync(candidate)) {
      continue;
    }
    return candidate;
  }

  return null;
}

const python = findPython();
if (!python) {
  console.error('No Python runtime found. Install Python or set PYTHON=/path/to/python.');
  process.exit(1);
}

const env = { ...process.env };
if (!env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(defaultCredentialsPath)) {
  env.GOOGLE_APPLICATION_CREDENTIALS = defaultCredentialsPath;
}

const child = spawn(python, ['app.py'], {
  cwd: backendDir,
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
