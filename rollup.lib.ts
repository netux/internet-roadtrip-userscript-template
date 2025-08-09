import { isAbsolute, relative, resolve } from 'node:path';
import type { NormalizedPackageJson } from 'read-package-up';

export interface ExternalModule {
  module: string;
  exposeAs: string;
  requireUrl?: string;
}

export function defineExternal(externals: ExternalModule[]) {
  return (id: string) =>
    externals.some(({ module }) => {
      if (isAbsolute(module)) {
        return !relative(module, resolve(id)).startsWith('..');
      }

      return id === module || id.startsWith(module + '/');
    });
}

export function mapExternalGlobals(externals: ExternalModule[]) {
  return Object.fromEntries(
    externals.map(({ module, exposeAs }) => [module, exposeAs]),
  );
}

export function externalsToRequires(
  externals: ExternalModule[],
  packageJson: NormalizedPackageJson,
) {
  const jsDelivrExternals: ExternalModule[] = [];
  const directExternalUrls: string[] = [];

  for (const external of externals) {
    if (external.requireUrl) {
      directExternalUrls.push(external.requireUrl);
    } else {
      jsDelivrExternals.push(external);
    }
  }

  if (jsDelivrExternals.length === 0) {
    return directExternalUrls;
  }

  let jsDelivrExternalsCombinedUrl = 'https://cdn.jsdelivr.net/npm/';

  const jsDelivrModuleUrlPath = (module: string) => {
    /**
     * Allow versions like: 1.0.0, 1.0.0-beta
     * But not: ^1.0.0, ~1.0.0
     */
    const STRIP_NOT_LOCKED_REGEXP = /[^0-9.\-[a-z]]/g;

    // TODO(netux): we should really just be reading package-lock.json instead...
    const packageJsonVersion =
      packageJson.dependencies[module] || packageJson.devDependencies[module];
    if (!packageJsonVersion) {
      throw new Error(
        `Package '${module}', marked as external for the userscript, is not present in your package.json`,
      );
    }

    const lockedVersion = packageJsonVersion.replaceAll(
      STRIP_NOT_LOCKED_REGEXP,
      '',
    );

    if (STRIP_NOT_LOCKED_REGEXP.test(packageJsonVersion)) {
      console.warn(
        `Package '${module}', marked as external for the userscript, is not locked to a specific version. Will @require v${lockedVersion}`,
      );
    }

    return `${module}@${packageJsonVersion}`;
  };

  if (jsDelivrExternals.length === 1) {
    jsDelivrExternalsCombinedUrl += jsDelivrModuleUrlPath(
      jsDelivrExternals[0].module,
    );
  } else {
    jsDelivrExternalsCombinedUrl += `combine/${jsDelivrExternals.map(({ module }) => jsDelivrModuleUrlPath(module)).join(',')}`;
  }

  return [jsDelivrExternalsCombinedUrl, ...directExternalUrls];
}

export function metadataToJson(
  meta: string,
): Record<string, string | boolean | string[]> {
  const metaLines = meta.split('\n');

  let metaStartLineIdx = metaLines.indexOf('// ==UserScript==');
  if (metaStartLineIdx < 0) {
    metaStartLineIdx = 0;
  }

  let metaEndLineIdx = metaLines.indexOf('// ==/UserScript==');
  if (metaEndLineIdx < 0) {
    metaEndLineIdx = metaLines.length - 1;
  }

  const result = {};

  for (let i = metaStartLineIdx + 1; i < metaEndLineIdx; i++) {
    const line = metaLines[i];

    const match = /^\/\/ @(?<key>\w+)(?:\s+(?<value>.+)?)/.exec(line);
    if (match == null) {
      continue;
    }

    const { key, value } = match.groups!;

    if (value == null) {
      // boolean, i.e. @noframes

      if (key in result) {
        throw new Error(
          `Userscript metadata '${key}' was provided twice: once with a value, and once without`,
        );
      }

      result[key] = true;
    } else {
      if (Array.isArray(result[key])) {
        result[key].push(value);
      } else if (key in result) {
        result[key] = [result[key], value];
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

export function jsonToMetadata(object: Record<string, unknown>): string {
  const keyPadding =
    Math.max(...Object.keys(object).map((key) => key.length)) + 1;

  const entries = Object.entries(object).map(([key, value]) => {
    const toString = (key: string, singleValue: unknown) => {
      const paddedKey = key.padEnd(keyPadding, ' ');

      switch (typeof singleValue) {
        case 'number':
        case 'string': {
          return `// @${paddedKey} ${singleValue}`;
        }
        case 'boolean': {
          if (!value) return '';
          return `// @${paddedKey}`;
        }
        default: {
          throw new Error(
            `Unsupported value type ${typeof singleValue} '${new String(singleValue)}' (provided for userscript metadata '${key}')`,
          );
        }
      }
    };

    if (Array.isArray(value)) {
      return value.map((singleValue) => toString(key, singleValue)).join('\n');
    } else {
      return toString(key, value);
    }
  });

  return [`// ==UserScript==`, ...entries, `// ==/UserScript==`]
    .join('\n')
    .replaceAll(/^(?:\/\/ )?\s*$/gm, ''); // begone empty lines
}
