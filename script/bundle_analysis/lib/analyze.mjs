import {
  describeBuild,
  loadGraph,
  MAIN_ENTRY,
  moduleBytes,
  packageOf,
  UNMAPPED,
} from "./graph.mjs";
import { brotliSizes } from "./sizes.mjs";

export const REPORT_SCHEMA = 1;
const TOP_MODULES = 5;
// Smaller module deltas are rebuild noise, e.g. a renumbered import.
const MIN_MODULE_DELTA = 100;

/**
 * Compares two production builds. Returns raw numbers only; thresholds are
 * applied when rendering, so the trusted comment workflow decides what is
 * flagged.
 */
export async function analyze({ baseDir, headDir, mainEntry = MAIN_ENTRY }) {
  const base = describeBuild(loadGraph(baseDir), { mainEntry });
  const head = describeBuild(loadGraph(headDir), { mainEntry });

  const baseSizes = await brotliSizes(baseDir, outputFiles(base.graph));
  const headSizes = await brotliSizes(headDir, outputFiles(head.graph), {
    reuse: baseSizes,
  });
  const sum = (files, sizes) =>
    [...files].reduce((total, file) => total + sizes.get(file).brotli, 0);

  const moved = movedIntoInitialLoad(base, head);
  const movedKeys = new Set(moved.map((group) => group.bundle));

  const bundles = [];
  for (const key of new Set([...base.bundles.keys(), ...head.bundles.keys()])) {
    const b = base.bundles.get(key);
    const h = head.bundles.get(key);
    const measure = (bundle, sizes) =>
      bundle
        ? {
            own: sizes.get(bundle.file).brotli,
            load: sum(bundle.costChunks, sizes),
          }
        : null;
    bundles.push({
      key,
      name: (h ?? b).name,
      kind: (h ?? b).kind,
      facade: (h ?? b).facade,
      isMain: (h ?? b).isMain,
      status: !b ? "new" : !h ? "removed" : "same",
      movedToInitialLoad: !h && movedKeys.has(key),
      base: measure(b, baseSizes),
      head: measure(h, headSizes),
      topModules:
        b && h
          ? moduleDeltas(base.graph, b.costChunks, head.graph, h.costChunks)
          : h
            ? moduleDeltas(base.graph, [], head.graph, h.costChunks)
            : [],
      importedBy: !b && h ? importersOf(key, head) : [],
    });
  }
  bundles.sort((x, y) => (y.head?.load ?? 0) - (x.head?.load ?? 0));

  const newKeys = new Set(
    bundles.filter((b) => b.status === "new").map((b) => b.key)
  );
  const removedKeys = new Set(
    bundles.filter((b) => b.status === "removed").map((b) => b.key)
  );
  const nameOf = new Map(bundles.map((b) => [b.key, b.name]));
  const edgeList = (edges, others, skip) =>
    [...edges.values()]
      .filter((edge) => !others.has(edgeKey(edge)))
      .filter((edge) => !skip.has(edge.from) && !skip.has(edge.to))
      .map((edge) => ({
        ...edge,
        fromName: nameOf.get(edge.from),
        toName: nameOf.get(edge.to),
      }))
      .sort((x, y) => edgeKey(x).localeCompare(edgeKey(y)));

  return {
    schema: REPORT_SCHEMA,
    noJsChanges: false,
    initialLoad: {
      base: sum(base.initial, baseSizes),
      head: sum(head.initial, headSizes),
      entryOwn: {
        base: baseSizes.get(base.bundles.get(base.mainKey).file).brotli,
        head: headSizes.get(head.bundles.get(head.mainKey).file).brotli,
      },
      chunks: { base: base.initial.size, head: head.initial.size },
      topModules: moduleDeltas(
        base.graph,
        base.initial,
        head.graph,
        head.initial
      ),
    },
    totals: {
      base: sum(chunkFiles(base.graph), baseSizes),
      head: sum(chunkFiles(head.graph), headSizes),
      chunks: {
        base: chunkFiles(base.graph).length,
        head: chunkFiles(head.graph).length,
      },
    },
    bundles,
    movedIntoInitialLoad: moved.map((group) => ({
      ...group,
      name: nameOf.get(group.bundle),
    })),
    edges: {
      added: edgeList(head.edges, new Set(base.edges.keys()), newKeys),
      removed: edgeList(base.edges, new Set(head.edges.keys()), removedKeys),
    },
    assets: compareAssets(base.graph, baseSizes, head.graph, headSizes),
    duplicatePackages: duplicatePackages(base.graph, head.graph),
  };
}

function edgeKey(edge) {
  return `${edge.from}|${edge.to}|${edge.kind}`;
}

function chunkFiles(graph) {
  return Object.keys(graph.chunks);
}

function outputFiles(graph) {
  return [...chunkFiles(graph), ...Object.keys(graph.assets)];
}

/** Modules whose minified bytes grew most between two sets of chunks. */
function moduleDeltas(baseGraph, baseFiles, headGraph, headFiles) {
  const before = moduleBytes(baseGraph, baseFiles);
  const after = moduleBytes(headGraph, headFiles);
  const deltas = [];
  for (const [id, size] of after) {
    const delta = size - (before.get(id) ?? 0);
    if (delta >= MIN_MODULE_DELTA && id !== UNMAPPED) {
      deltas.push({ id, delta, added: !before.has(id) });
    }
  }
  return deltas.sort((a, b) => b.delta - a.delta).slice(0, TOP_MODULES);
}

/** Who imports a new bundle, with the importing module. */
function importersOf(key, build) {
  return [...build.edges.values()]
    .filter((edge) => edge.to === key)
    .map((edge) => ({
      from: edge.from,
      fromName: build.bundles.get(edge.from).name,
      kind: edge.kind,
      examples: edge.examples,
    }));
}

/**
 * Modules that were only lazily loaded in base but are part of the initial
 * load in head, grouped by the base bundle they came from.
 */
function movedIntoInitialLoad(base, head) {
  const groups = new Map();
  for (const [id, headFile] of head.moduleChunk) {
    const baseFile = base.moduleChunk.get(id);
    if (
      !baseFile ||
      base.initial.has(baseFile) ||
      !head.initial.has(headFile)
    ) {
      continue;
    }
    const owner = ownerBundle(base, baseFile);
    if (!owner) {
      continue;
    }
    if (!groups.has(owner.key)) {
      groups.set(owner.key, {
        bundle: owner.key,
        facade: owner.facade,
        bytes: 0,
        modules: [],
      });
    }
    const group = groups.get(owner.key);
    const bytes = head.graph.chunks[headFile].modules[id];
    group.bytes += bytes;
    group.modules.push({ id, bytes });
  }

  return [...groups.values()]
    .map((group) => ({
      bundle: group.bundle,
      bytes: group.bytes,
      modules: group.modules
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, TOP_MODULES),
      importers: staticImportersInInitialLoad(head, [
        group.facade,
        ...group.modules.map((m) => m.id),
      ]),
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

/** The lazy bundle whose own chunk holds `file`, else the first whose closure does. */
function ownerBundle(build, file) {
  const direct = build.bundleOfChunk.get(file);
  if (direct) {
    return build.bundles.get(direct);
  }
  return [...build.bundles.values()]
    .filter((bundle) => bundle.kind === "lazy" && bundle.closure.has(file))
    .sort((a, b) => a.key.localeCompare(b.key))[0];
}

function staticImportersInInitialLoad(head, ids) {
  for (const id of ids) {
    const importers = (
      head.graph.lazyTargets[id]?.staticImporters ?? []
    ).filter((importer) => head.initial.has(head.moduleChunk.get(importer)));
    if (importers.length) {
      return importers.slice(0, 3);
    }
  }
  return [];
}

function compareAssets(baseGraph, baseSizes, headGraph, headSizes) {
  const byLabel = (graph, sizes) => {
    const assets = new Map();
    for (const file of Object.keys(graph.assets).sort()) {
      let label = graph.assets[file].label;
      for (let n = 2; assets.has(label); n++) {
        label = `${graph.assets[file].label} (${n})`;
      }
      assets.set(label, sizes.get(file).brotli);
    }
    return assets;
  };
  const before = byLabel(baseGraph, baseSizes);
  const after = byLabel(headGraph, headSizes);
  return [...new Set([...before.keys(), ...after.keys()])]
    .sort()
    .map((label) => ({
      label,
      base: before.get(label) ?? null,
      head: after.get(label) ?? null,
    }));
}

function duplicatePackages(baseGraph, headGraph) {
  const versions = (graph) => {
    const result = new Map();
    for (const chunk of Object.values(graph.chunks)) {
      for (const id of Object.keys(chunk.modules)) {
        const pkg = packageOf(id);
        if (pkg) {
          if (!result.has(pkg.name)) {
            result.set(pkg.name, new Set());
          }
          result.get(pkg.name).add(pkg.version);
        }
      }
    }
    return result;
  };
  const before = versions(baseGraph);
  return [...versions(headGraph)]
    .filter(([, set]) => set.size > 1)
    .map(([name, set]) => ({
      name,
      versions: [...set].sort(),
      new: (before.get(name)?.size ?? 0) < 2,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
