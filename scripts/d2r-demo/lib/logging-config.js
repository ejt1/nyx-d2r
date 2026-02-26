'use strict';

import { existsSync, mkdirSync, readFileSync } from 'fs';

function pathJoin(base, leaf) {
  if (!base || base.length === 0) return leaf;
  const last = base[base.length - 1];
  if (last === '\\' || last === '/') return `${base}${leaf}`;
  return `${base}\\${leaf}`;
}

function resolveRoots(processBinding) {
  const roots = [];
  try {
    const scriptsRoot = processBinding.scriptsRoot?.();
    if (scriptsRoot) roots.push(scriptsRoot);
  } catch {}
  try {
    const cwd = processBinding.cwd?.();
    if (cwd) roots.push(cwd);
  } catch {}
  return roots;
}

function isAbsolutePath(path) {
  if (!path || path.length < 1) return false;
  if (path.startsWith('\\\\')) return true;
  if (path.length >= 3 && /[A-Za-z]/.test(path[0]) && path[1] === ':' && (path[2] === '\\' || path[2] === '/')) {
    return true;
  }
  return false;
}

function toBooleanOrDefault(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function toStringOrDefault(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function toObjectOrDefault(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function pathExists(path) {
  try {
    return existsSync(path);
  } catch {}
  return false;
}

function tryReadJson(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {}
  return null;
}

function readLoggingConfig(roots) {
  const candidates = [
    'd2r-demo.logging.json',
    'd2r-demo\\logging.json',
  ];
  for (const root of roots) {
    for (const candidate of candidates) {
      const fullPath = pathJoin(root, candidate);
      if (!pathExists(fullPath)) continue;
      const parsed = tryReadJson(fullPath);
      if (parsed) {
        return { config: parsed, path: fullPath };
      }
    }
  }
  return { config: {}, path: null };
}

function resolvePrimaryRoot(processBinding) {
  try {
    const scriptsRoot = processBinding.scriptsRoot?.();
    if (scriptsRoot) return scriptsRoot;
  } catch {}
  try {
    const cwd = processBinding.cwd?.();
    if (cwd) return cwd;
  } catch {}
  return '';
}

function resolveLogsDir(processBinding, config) {
  const root = resolvePrimaryRoot(processBinding);
  const logsDirSetting = toStringOrDefault(config.logsDir, 'logs');
  if (isAbsolutePath(logsDirSetting)) return logsDirSetting;
  if (!root) return logsDirSetting;
  return pathJoin(root, logsDirSetting);
}

function ensureDirectory(path) {
  if (!path || path.length === 0) return;
  try {
    mkdirSync(path, { recursive: true });
  } catch {}
}

function resolveLogFilePath(logsDir, fallbackName, configuredPathOrName) {
  const fileValue = toStringOrDefault(configuredPathOrName, fallbackName);
  if (isAbsolutePath(fileValue)) return fileValue;
  if (logsDir && logsDir.length > 0) return pathJoin(logsDir, fileValue);
  return fileValue;
}

function resolveCategoryLogging(config, defaults, logsDir) {
  const enabled = toBooleanOrDefault(config.enabled, defaults.enabled);
  const minLevel = toStringOrDefault(config.minLevel, defaults.minLevel);
  const toConsole = enabled && toBooleanOrDefault(config.toConsole, defaults.toConsole);
  const toFile = enabled && toBooleanOrDefault(config.toFile, defaults.toFile);
  const filePath = resolveLogFilePath(logsDir, defaults.fileName, config.filePath || config.fileName);

  return {
    enabled,
    minLevel,
    toConsole,
    toFile,
    filePath,
  };
}

export function resolveLoggingConfig({ processBinding } = {}) {
  const roots = resolveRoots(processBinding);
  const loaded = readLoggingConfig(roots);
  const fileConfig = loaded.config;

  const debugLog = toBooleanOrDefault(fileConfig.debugLog, false);
  const logsDir = resolveLogsDir(processBinding, fileConfig);

  const scriptConfig = toObjectOrDefault(fileConfig.script);
  const unitExplorerConfig = toObjectOrDefault(fileConfig.unitExplorer);
  const exitMarkersConfig = toObjectOrDefault(fileConfig.exitMarkers);
  const objectManagerConfig = toObjectOrDefault(fileConfig.objectManager);

  const script = resolveCategoryLogging(
    {
      ...scriptConfig,
      enabled: toBooleanOrDefault(scriptConfig.enabled, debugLog),
    },
    {
      enabled: false,
      minLevel: 'debug',
      toConsole: true,
      toFile: false,
      fileName: 'script.log',
    },
    logsDir,
  );

  const unitExplorer = resolveCategoryLogging(
    {
      ...unitExplorerConfig,
      enabled: toBooleanOrDefault(unitExplorerConfig.enabled, toBooleanOrDefault(unitExplorerConfig.perfEnabled, debugLog)),
    },
    {
      enabled: false,
      minLevel: 'info',
      toConsole: true,
      toFile: true,
      fileName: 'unit-explorer-perf.log',
    },
    logsDir,
  );

  const exitMarkersBase = resolveCategoryLogging(
    {
      ...exitMarkersConfig,
      enabled: toBooleanOrDefault(exitMarkersConfig.enabled, toBooleanOrDefault(exitMarkersConfig.perfEnabled, debugLog)),
    },
    {
      enabled: false,
      minLevel: 'info',
      toConsole: true,
      toFile: true,
      fileName: 'exit-markers-perf.log',
    },
    logsDir,
  );

  const objectManagerEnabled = toBooleanOrDefault(objectManagerConfig.enabled, debugLog);
  const objectManagerChainWarnings = toBooleanOrDefault(objectManagerConfig.chainWarnings, objectManagerEnabled);
  const objectManagerRiskCircuit = toBooleanOrDefault(objectManagerConfig.riskCircuit, objectManagerEnabled);
  const objectManager = resolveCategoryLogging(
    {
      ...objectManagerConfig,
      enabled: objectManagerChainWarnings || objectManagerRiskCircuit,
    },
    {
      enabled: false,
      minLevel: 'info',
      toConsole: true,
      toFile: false,
      fileName: 'object-manager.log',
    },
    logsDir,
  );

  const exitOverlay = (exitMarkersBase.enabled && toBooleanOrDefault(exitMarkersConfig.overlay, exitMarkersBase.enabled));

  if ((script.enabled && script.toFile) ||
      (unitExplorer.enabled && unitExplorer.toFile) ||
      (exitMarkersBase.enabled && exitMarkersBase.toFile) ||
      (objectManager.enabled && objectManager.toFile)) {
    ensureDirectory(logsDir);
  }

  return {
    sourcePath: loaded.path,
    debugLog,
    logsDir,
    script,
    unitExplorer: {
      perfEnabled: unitExplorer.enabled,
      minLevel: unitExplorer.minLevel,
      toConsole: unitExplorer.toConsole,
      toFile: unitExplorer.toFile,
      filePath: unitExplorer.filePath,
    },
    exitMarkers: {
      perfEnabled: exitMarkersBase.enabled,
      overlay: exitOverlay,
      minLevel: exitMarkersBase.minLevel,
      toConsole: exitMarkersBase.toConsole,
      toFile: exitMarkersBase.toFile,
      filePath: exitMarkersBase.filePath,
    },
    objectManager: {
      enabled: objectManager.enabled,
      chainWarnings: objectManagerChainWarnings,
      riskCircuit: objectManagerRiskCircuit,
      minLevel: objectManager.minLevel,
      toConsole: objectManager.toConsole,
      toFile: objectManager.toFile,
      filePath: objectManager.filePath,
    },
  };
}
