import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const backendDir = join(root, 'backend');
const defaultCredentialsPath = join(homedir(), '.secrets', 'milo-backend-sa.json');

const checks = [];

function addCheck(ok, label, detail) {
  checks.push({ ok, label, detail });
}

function commandExists(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

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
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (result.status === 0) {
      return candidate;
    }
  }

  return null;
}

addCheck(
  existsSync(join(root, 'node_modules')),
  'Frontend dependencies',
  'Run `npm install` before `npm run dev` or `npm run build`.'
);

addCheck(
  existsSync(join(root, 'node_modules', '.bin', 'vite')),
  'Vite binary',
  'Run `npm install`; `npm run build` needs local dev dependencies.'
);

const python = findPython();
addCheck(
  Boolean(python),
  'Python runtime',
  'Install Python or set PYTHON=/path/to/python.'
);

if (python) {
  const importCheck = spawnSync(
    python,
    [
      '-c',
      [
        'import flask',
        'import flask_cors',
        'import dotenv',
        'import requests',
        'from google.cloud import language_v1, firestore, texttospeech, storage, speech_v1',
      ].join('; '),
    ],
    { cwd: backendDir, encoding: 'utf8' }
  );

  addCheck(
    importCheck.status === 0,
    'Backend Python dependencies',
    [
      'Create/install the backend environment:',
      '`python3 -m venv venv`',
      '`venv/bin/python -m pip install -r backend/requirements.txt`',
    ].join(' ')
  );
}

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultCredentialsPath;
addCheck(
  existsSync(resolve(credentialsPath)),
  'Google credentials',
  [
    `Expected service-account credentials at ${credentialsPath}.`,
    'Set GOOGLE_APPLICATION_CREDENTIALS to another key file, or configure Application Default Credentials for your shell.',
  ].join(' ')
);

if (!commandExists('npm')) {
  addCheck(false, 'npm', 'Install Node.js/npm before running frontend scripts.');
}

let failed = false;
for (const check of checks) {
  const marker = check.ok ? 'ok' : 'missing';
  console.log(`[${marker}] ${check.label}`);
  if (!check.ok) {
    failed = true;
    console.log(`  ${check.detail}`);
  }
}

if (failed) {
  console.error('\nDev environment is not ready yet. Fix the missing items above and rerun `npm run dev`.');
  process.exit(1);
}

console.log('\nDev environment looks ready.');
