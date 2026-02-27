'use strict';

import { appendFileSync } from 'fs';

const LEVEL_WEIGHT = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function normalizeLevel(level) {
  const value = typeof level === 'string' ? level.toLowerCase() : '';
  return LEVEL_WEIGHT[value] ? value : 'info';
}

function stringifyPart(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value === null || value === undefined) return String(value);
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function formatMessage(args) {
  return args.map(stringifyPart).join(' ');
}

function pickConsoleMethod(level) {
  if (level === 'error') return console.error;
  if (level === 'warn') return console.warn;
  return console.log;
}

export function createDiagnosticLogger(options = {}) {
  const name = typeof options.name === 'string' && options.name.length > 0 ? options.name : 'Log';
  const enabled = !!options.enabled;
  const minLevel = normalizeLevel(options.minLevel);
  const minWeight = LEVEL_WEIGHT[minLevel];
  const toConsole = !!options.toConsole;
  let toFile = !!options.toFile;
  const filePath = typeof options.filePath === 'string' ? options.filePath : '';
  if (!filePath) toFile = false;

  function emit(level, args) {
    if (!enabled) return;
    const normalizedLevel = normalizeLevel(level);
    if (LEVEL_WEIGHT[normalizedLevel] < minWeight) return;

    const message = formatMessage(args);
    const line = `[${new Date().toISOString()}] [${name}] [${normalizedLevel.toUpperCase()}] ${message}`;

    if (toConsole) {
      try {
        pickConsoleMethod(normalizedLevel)(line);
      } catch (_) {}
    }

    if (toFile) {
      try {
        appendFileSync(filePath, `${line}\n`);
      } catch (_) {
        toFile = false;
      }
    }
  }

  return {
    debug(...args) { emit('debug', args); },
    info(...args) { emit('info', args); },
    warn(...args) { emit('warn', args); },
    error(...args) { emit('error', args); },
    isEnabled() { return enabled; },
    filePath,
  };
}
