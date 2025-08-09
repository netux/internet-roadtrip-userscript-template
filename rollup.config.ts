import babelPlugin from '@rollup/plugin-babel';
import commonjsPlugin from '@rollup/plugin-commonjs';
import jsonPlugin from '@rollup/plugin-json';
import resolvePlugin from '@rollup/plugin-node-resolve';
import replacePlugin from '@rollup/plugin-replace';
import { basename } from 'node:path';
import {
  type NormalizedReadResult as NormalizedPackageReadResult,
  readPackageUp,
} from 'read-package-up';
import { defineConfig } from 'rollup';
import tlaPlugin from 'rollup-plugin-tla';
import postcssPlugin from 'rollup-plugin-postcss';
import userscript from 'rollup-plugin-userscript';
import {
  type ExternalModule,
  defineExternal,
  mapExternalGlobals,
  externalsToRequires,
  jsonToMetadata,
  metadataToJson,
} from './rollup.lib';
import { MOD_DOM_SAFE_PREFIX, MOD_NAME } from './src/constants';

const { packageJson } =
  /** @type {import('read-package-up').NormalizedReadResult} */ (await readPackageUp()) as NormalizedPackageReadResult;
const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];

const externals: ExternalModule[] = [
  {
    module: 'internet-roadtrip-framework',
    exposeAs: 'IRF',
  },
  {
    module: '@violentmonkey/dom',
    exposeAs: 'VM',
  },
  {
    module: '@violentmonkey/ui',
    exposeAs: 'VM',
  },
];

export default defineConfig({
  input: 'src/index.ts',
  plugins: [
    postcssPlugin({
      inject: false,
      minimize: false,
      modules: {
        generateScopedName: (className: string, fileName: string) => {
          const fileStem = basename(fileName, '.module.css');
          return `userscript-${fileStem}-${className}`;
        },
      },
    }),
    babelPlugin({
      // import helpers from '@babel/runtime'
      babelHelpers: 'runtime',
      plugins: [
        [
          import.meta.resolve('@babel/plugin-transform-runtime'),
          {
            useESModules: true,
            version: '^7.5.0', // see https://github.com/babel/babel/issues/10261#issuecomment-514687857
          },
        ],
      ],
      exclude: 'node_modules/**',
      extensions,
    }),
    replacePlugin({
      values: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      },
      preventAssignment: true,
    }),
    resolvePlugin({ browser: false, extensions }),
    commonjsPlugin(),
    jsonPlugin(),
    tlaPlugin(),
    userscript((meta) => {
      const metaJson = metadataToJson(meta);

      metaJson.name = `Internet Roadtrip - ${MOD_NAME}`;
      metaJson.namespace = `me.netux.site/user-scripts/internet-roadtrip/${MOD_DOM_SAFE_PREFIX}`;
      if (metaJson.description) {
        metaJson.description = packageJson.description;
      }
      metaJson.version = packageJson.version;
      metaJson.author = packageJson.author!.name;
      if (packageJson.contributors && packageJson.contributors.length > 0) {
        metaJson.author += ` (${packageJson.contributors
          .map((contributor) => {
            if (typeof contributor === 'string') {
              return contributor;
            }

            return contributor.name;
          })
          .map((contributorName) => `+${contributorName}`)
          .join(', ')})`;
      }
      if (packageJson.license) {
        metaJson.license ??= packageJson.license;
      }

      const require =
        (metaJson.require &&
          (Array.isArray(metaJson.require)
            ? metaJson.require
            : [metaJson.require as string])) ??
        [];
      require.push(...externalsToRequires(externals, packageJson));
      metaJson.require = require;

      return jsonToMetadata(metaJson);
    }),
  ],
  external: defineExternal(externals),
  output: {
    format: 'iife',
    file: `dist/${MOD_DOM_SAFE_PREFIX}.user.js`,
    globals: {
      ...mapExternalGlobals(externals),
    },
    indent: false,
  },
});
