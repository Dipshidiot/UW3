#!/usr/bin/env node

const fs = require('fs');
const { spawnSync } = require('child_process');

const [, , requiredPath, command, ...rest] = process.argv;

const separatorIndex = rest.indexOf('--');
const messageParts = separatorIndex >= 0 ? rest.slice(0, separatorIndex) : rest;
const passthroughArgs = separatorIndex >= 0 ? rest.slice(separatorIndex + 1) : [];

if (!requiredPath || !command) {
  console.error('Usage: node scripts/optional-run.js <requiredPath> <command> [skipMessage]');
  process.exit(2);
}

if (!fs.existsSync(requiredPath)) {
  const message = messageParts.join(' ').trim() || `skip: ${requiredPath} not found`;
  console.log(message);
  process.exit(0);
}

const fullCommand = passthroughArgs.length
  ? `${command} ${passthroughArgs.map((arg) => `"${arg}"`).join(' ')}`
  : command;

const result = spawnSync(fullCommand, {
  shell: true,
  stdio: 'inherit',
  windowsHide: true,
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
