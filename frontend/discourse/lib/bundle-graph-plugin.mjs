import { dirname, isAbsolute, relative, resolve } from "path";

const URL_IMPORT_PREFIX = "\0virtual:dynamic-chunk-url:";
const PNPM_PATH =
  /\/node_modules\/\.pnpm\/[^/]+\/node_modules\/((?:@[^/]+\/)?[^/]+)\/(.*)$/;
const NODE_MODULES_PATH = /\/node_modules\/((?:@[^/]+\/)?[^/]+)\/(.*)$/;
const EXAMPLES_PER_EDGE = 3;
const UNMAPPED = "(unmapped)";

const BASE64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_VALUES = new Map([...BASE64].map((char, i) => [char, i]));

/**
 * Writes `manifest/bundle-graph.json`: every chunk's modules (with minified
 * bytes), its static, dynamic and URL imports, example module-level imports
 * behind each cross-chunk edge, and the importers of every lazily imported
 * module. Static importers explain a lazy module merged into its importer's
 * chunk; rolldown's INEFFECTIVE_DYNAMIC_IMPORT warning arrives only after
 * generateBundle, so it cannot be recorded here. CI compares this file
 * between builds to report new bundles, growth and new connections.
 *
 * @param {{ root: string, packageVersions?: (packageDir: string) => string | undefined }} options
 *   `root` makes module ids relative. `packageVersions` is for tests.
 */
export default function bundleGraphPlugin({ root, packageVersions }) {
  const readVersion = packageVersions ?? readPackageVersion;
  const versionCache = new Map();

  function versionOf(packageDir) {
    if (!versionCache.has(packageDir)) {
      versionCache.set(packageDir, readVersion(packageDir));
    }
    return versionCache.get(packageDir);
  }

  function normalize(id) {
    return normalizeModuleId(id, root, versionOf);
  }

  return {
    name: "bundle-graph",

    generateBundle(outputOptions, bundle) {
      const outDir = outputOptions.dir ?? root;
      const chunkOfModule = new Map();
      const chunkOfFacade = new Map();
      const chunks = {};
      const assets = {};
      const entries = {};
      const lazyTargets = {};

      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type !== "chunk") {
          if (!fileName.endsWith(".map")) {
            assets[fileName] = { label: labelOf(fileName) };
          }
          continue;
        }
        for (const moduleId of output.moduleIds) {
          chunkOfModule.set(moduleId, fileName);
        }
        if (output.facadeModuleId) {
          chunkOfFacade.set(output.facadeModuleId, fileName);
        }
        if (output.isEntry) {
          entries[output.name] = fileName;
        }
      }

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "chunk") {
          continue;
        }

        const examples = {};
        const urlImports = new Set();

        const addExample = (kind, targetFile, from, to) => {
          const key = `${kind}:${targetFile}`;
          examples[key] ??= [];
          if (examples[key].length < EXAMPLES_PER_EDGE) {
            examples[key].push({ from: normalize(from), to: normalize(to) });
          }
        };

        for (const moduleId of chunk.moduleIds) {
          if (moduleId.startsWith(URL_IMPORT_PREFIX)) {
            const target = moduleId.slice(URL_IMPORT_PREFIX.length);
            const targetFile = chunkOfFacade.get(target);
            if (targetFile) {
              urlImports.add(targetFile);
            }
            continue;
          }

          const info = this.getModuleInfo(moduleId);
          if (!info) {
            continue;
          }

          for (const imported of info.importedIds) {
            if (imported.startsWith(URL_IMPORT_PREFIX)) {
              const target = imported.slice(URL_IMPORT_PREFIX.length);
              const targetFile = chunkOfFacade.get(target);
              if (targetFile && targetFile !== fileName) {
                addExample("url", targetFile, moduleId, target);
              }
              continue;
            }
            const targetFile = chunkOfModule.get(imported);
            if (targetFile && targetFile !== fileName) {
              addExample("static", targetFile, moduleId, imported);
            }
          }

          for (const imported of info.dynamicallyImportedIds) {
            const targetFile = chunkOfModule.get(imported);
            if (targetFile && targetFile !== fileName) {
              addExample("dynamic", targetFile, moduleId, imported);
            }
          }

          if (info.dynamicImporters.length > 0) {
            lazyTargets[normalize(moduleId)] = {
              staticImporters: [
                ...new Set(info.importers.map(normalize)),
              ].sort(),
              dynamicImporters: [
                ...new Set(info.dynamicImporters.map(normalize)),
              ].sort(),
            };
          }
        }

        chunks[fileName] = {
          label: labelOf(fileName),
          name: chunk.name,
          kind: chunk.isEntry
            ? "entry"
            : chunk.isDynamicEntry
              ? "lazy"
              : "shared",
          facade: chunk.facadeModuleId ? normalize(chunk.facadeModuleId) : null,
          imports: [...chunk.imports].sort(),
          dynamicImports: [...chunk.dynamicImports]
            .filter((file) => file !== fileName)
            .sort(),
          urlImports: [...urlImports].sort(),
          modules: moduleBytes(chunk, fileName, outDir, normalize),
          examples,
        };
      }

      this.emitFile({
        type: "asset",
        fileName: "manifest/bundle-graph.json",
        source: stableStringify({
          version: 1,
          entries,
          chunks,
          assets,
          lazyTargets,
        }),
      });
    },
  };
}

/**
 * The filename part before the content hash, e.g. `admin` for
 * `assets/js/admin-gwfrhsfc.digested.js`.
 */
export function labelOf(fileName) {
  const base = fileName.split("/").pop();
  return base.replace(/-[a-z0-9]+(\.digested)?\.[a-z0-9]+$/, "");
}

/**
 * Makes a module id stable across machines: relative to `root`, and
 * `<package>@<version>/<path>` for node_modules, without the pnpm store path.
 */
export function normalizeModuleId(id, root, versionOf = () => undefined) {
  let prefix = "";
  let path = id;
  if (path.startsWith("\0")) {
    path = path.slice(1);
    prefix = path.startsWith("virtual:") ? "" : "virtual:";
  }

  // Virtual ids like `virtual:dynamic-chunk-url:/abs/path.js` embed a path.
  const scheme = path.match(/^((?:[\w-]+:)+)(\/.*)$/);
  if (scheme) {
    return `${prefix}${scheme[1]}${normalizeModuleId(scheme[2], root, versionOf)}`;
  }

  const [file, query] = splitQuery(path);
  const posixFile = file.replaceAll("\\", "/");
  const packageMatch =
    posixFile.match(PNPM_PATH) ?? posixFile.match(NODE_MODULES_PATH);

  if (packageMatch) {
    const [, packageName, rest] = packageMatch;
    const version = versionOf(
      posixFile.slice(0, posixFile.length - rest.length - 1)
    );
    return `${prefix}${packageName}${version ? `@${version}` : ""}/${rest}${query}`;
  }

  if (isAbsolute(file)) {
    return `${prefix}${relative(root, file).replaceAll("\\", "/")}${query}`;
  }
  return `${prefix}${posixFile}${query}`;
}

function splitQuery(path) {
  const index = path.indexOf("?");
  return index === -1 ? [path, ""] : [path.slice(0, index), path.slice(index)];
}

function readPackageVersion(packageDir) {
  const match = packageDir.match(
    /\/node_modules\/\.pnpm\/((?:@[^+/]+\+)?[^@/]+)@([^_/]+)/
  );
  return match?.[2];
}

/**
 * Minified bytes per module, counted from the chunk's source map: every
 * generated column up to the next mapping belongs to the mapped source.
 */
function moduleBytes(chunk, fileName, outDir, normalize) {
  const bytes = {};
  for (const moduleId of chunk.moduleIds) {
    bytes[normalize(moduleId)] = 0;
  }

  const map = chunk.map;
  if (!map?.mappings) {
    bytes[UNMAPPED] = chunk.code.length;
    return bytes;
  }

  const mapDir = resolve(outDir, dirname(fileName), map.sourceRoot ?? "");
  const sources = map.sources.map((source) =>
    source ? normalize(resolve(mapDir, source)) : UNMAPPED
  );
  const lines = chunk.code.split("\n");
  const mappingLines = map.mappings.split(";");
  let sourceIndex = 0;

  for (let line = 0; line < lines.length; line++) {
    const lineLength = lines[line].length + (line < lines.length - 1 ? 1 : 0);
    const segments = decodeLine(mappingLines[line] ?? "");

    let covered = 0;
    let previousColumn = 0;
    let previousSource = UNMAPPED;
    for (const { column, sourceDelta } of segments) {
      const length = Math.min(column, lineLength) - previousColumn;
      if (length > 0) {
        add(bytes, previousSource, length);
        covered += length;
      }
      previousColumn = Math.min(column, lineLength);
      if (sourceDelta === undefined) {
        previousSource = UNMAPPED;
      } else {
        sourceIndex += sourceDelta;
        previousSource = sources[sourceIndex];
      }
    }
    add(bytes, previousSource, lineLength - covered);
  }

  if (bytes[UNMAPPED] === 0) {
    delete bytes[UNMAPPED];
  }
  return bytes;
}

function add(bytes, key, length) {
  if (length > 0) {
    bytes[key] = (bytes[key] ?? 0) + length;
  }
}

/**
 * Decodes one line of source map mappings into `{ column, sourceDelta }`
 * segments. Only the generated column and source index are needed; the source
 * index is relative across lines, so the caller keeps its running value.
 */
function decodeLine(line) {
  const segments = [];
  let column = 0;
  let index = 0;

  while (index < line.length) {
    const fields = [];
    while (index < line.length && line[index] !== ",") {
      let value = 0;
      let shift = 0;
      let digit;
      // Base64 VLQ, as defined by the source map spec.
      /* eslint-disable no-bitwise */
      do {
        digit = BASE64_VALUES.get(line[index++]);
        value += (digit & 31) << shift;
        shift += 5;
      } while (digit & 32);
      fields.push(value & 1 ? -(value >>> 1) : value >>> 1);
      /* eslint-enable no-bitwise */
    }
    index++;

    column += fields[0];
    segments.push({
      column,
      sourceDelta: fields.length >= 4 ? fields[1] : undefined,
    });
  }

  return segments;
}

/** JSON with object keys sorted, so the file is reproducible. */
export function stableStringify(value) {
  return JSON.stringify(sortKeys(value), null, 1);
}

function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])])
    );
  }
  return value;
}
