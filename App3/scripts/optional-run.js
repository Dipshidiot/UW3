#!/usr/bin/env node

const fs = require('fs');
const { spawnSync } = require('child_process');

const [, , requiredPath, command, ...messageParts] = process.argv;

if (!requiredPath || !command) {
  console.error('Usage: node scripts/optional-run.js <requiredPath> <command> [skipMessage]');
  process.exit(2);
}

if (!fs.existsSync(requiredPath)) {
  const message = messageParts.join(' ').trim() || `skip: ${requiredPath} not found`;
  console.log(message);
  process.exit(0);
}

const result = spawnSync(command, {
  shell: true,
  stdio: 'inherit',
  windowsHide: true,
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
