const MAX_LIST = 10;
const MAX_NAMES = 5;
const MAX_STRING = 120;
const COMMENT_LIMIT = 60_000;

export const REPRODUCE =
  "node script/bundle_analysis/analyze.mjs --base-ref origin/main --head frontend/discourse/dist";

/** Whether a size change exceeds a `{ percent, kib, combine }` threshold. */
export function exceeds(base, head, { percent, kib: limitKib, combine }) {
  const change = head - base;
  if (change <= 0) {
    return false;
  }
  const overPercent = base === 0 || (change / base) * 100 > percent;
  const overBytes = change > limitKib * 1024;
  return combine === "or" ? overPercent || overBytes : overPercent && overBytes;
}

/**
 * The flagged findings of a report, each with a stable `key` so the comment
 * workflow can tell a new finding from one it already reported.
 */
export function findings(report, budget) {
  if (report.noJsChanges) {
    return [];
  }
  const result = [];

  for (const group of report.movedIntoInitialLoad) {
    if (group.bytes >= budget.movedIntoInitialLoad.kib * 1024) {
      result.push({ key: `moved:${group.bundle}`, type: "moved", group });
    }
  }

  const initial = report.initialLoad;
  if (exceeds(initial.base, initial.head, budget.initialLoad)) {
    result.push({ key: "initial", type: "initial" });
  }

  for (const bundle of report.bundles) {
    if (bundle.status === "new") {
      result.push({ key: `new:${bundle.key}`, type: "new", bundle });
    }
  }

  for (const bundle of report.bundles) {
    if (
      bundle.status === "same" &&
      !bundle.isMain &&
      exceeds(bundle.base.load, bundle.head.load, budget.bundles)
    ) {
      result.push({ key: `grew:${bundle.key}`, type: "grew", bundle });
    }
  }

  for (const edge of report.edges.added) {
    result.push({
      key: `edge:${edge.from}:${edge.to}:${edge.kind}`,
      type: "edge",
      edge,
    });
  }

  return result;
}

export function renderComment(report, budget, { runUrl } = {}) {
  const flagged = findings(report, budget);
  const sections = [];
  const byType = (type) => flagged.filter((f) => f.type === type);

  const moved = byType("moved");
  if (moved.length) {
    sections.push(
      section(
        "**Moved into the initial load**, so it now downloads on every first page view. If that is unintended, load it with `import()` instead of a static import.",
        moved.map(({ group }) => {
          const via = group.importers.length
            ? `: statically imported by ${names(group.importers)}`
            : "";
          return `- ${code(group.name)} (${kib(group.bytes)} minified)${via}`;
        })
      )
    );
  }

  if (byType("initial").length) {
    const initial = report.initialLoad;
    sections.push(
      section(
        `**Initial load grew** ${sizeChange(initial.base, initial.head)}. Largest additions, minified:`,
        initial.topModules.map(moduleLine)
      )
    );
  }

  const added = byType("new");
  if (added.length) {
    sections.push(
      section(
        "**New bundles.** Expected when adding an `import()`.",
        added.map(({ bundle }) => {
          const from = bundle.importedBy[0];
          const importedBy = from
            ? `, loaded by ${code(from.fromName)}${exampleText(from.examples)}`
            : "";
          return `- ${code(bundle.name)}: ${bundle.kind}, ${kib(bundle.head.load)}${importedBy}. Facade: ${code(bundle.facade)}`;
        })
      )
    );
  }

  const grew = byType("grew");
  if (grew.length) {
    sections.push(
      section(
        "**Bundles over the growth threshold.**",
        grew.map(({ bundle }) => {
          const top = bundle.topModules[0];
          const largest = top
            ? `. Largest addition: ${code(top.id)} ${signedKib(top.delta)} minified`
            : "";
          return `- ${code(bundle.name)} ${sizeChange(bundle.base.load, bundle.head.load)}${largest}`;
        })
      )
    );
  }

  const edges = byType("edge");
  if (edges.length) {
    sections.push(
      section(
        "**New connections.** `A → B` means loading A can now load B.",
        groupEdges(edges.map((f) => f.edge)).map(
          (group) =>
            `- ${group.from.map(code).join(", ")}${group.more ? ` and ${group.more} more` : ""} → ${code(group.toName)}: ${group.kind}${exampleText(group.examples)}`
        )
      )
    );
  }

  const keys = flagged.map((f) => f.key);
  if (sections.length === 0) {
    return { keys, body: null };
  }

  const footer = [
    `<sub>Sizes are brotli unless marked minified. Flagged: initial load growth over ${budget.initialLoad.percent}% ${budget.initialLoad.combine} ${budget.initialLoad.kib} KiB; other bundles over ${budget.bundles.percent}% ${budget.bundles.combine} ${budget.bundles.kib} KiB. Informational only.</sub>`,
    "",
    `<sub>Reproduce locally: \`${REPRODUCE}\`${runUrl ? ` · [Full report](${runUrl})` : ""}</sub>`,
  ];

  let body = ["### JS bundle changes", "", ...sections, ...footer].join("\n");
  if (body.length > COMMENT_LIMIT) {
    body = `${body.slice(0, COMMENT_LIMIT)}\n\n… truncated, see the full report.`;
  }
  return { keys, body };
}

export function renderSummary(report, budget) {
  if (report.noJsChanges) {
    return "### JS bundle analysis\n\nNo JS inputs changed, nothing to compare.\n";
  }
  const flaggedKeys = new Set(findings(report, budget).map((f) => f.key));
  const initial = report.initialLoad;
  const lines = [
    "### JS bundle analysis",
    "",
    "Sizes are brotli (quality 11) unless marked minified.",
    "",
    "| | Base | Head | Change |",
    "| --- | ---: | ---: | ---: |",
    `| Initial load (${initial.chunks.head} chunks) | ${kib(initial.base)} | ${kib(initial.head)} | ${delta(initial.base, initial.head)} |`,
    `| ${cell("discourse")} entry chunk | ${kib(initial.entryOwn.base)} | ${kib(initial.entryOwn.head)} | ${delta(initial.entryOwn.base, initial.entryOwn.head)} |`,
    `| All JS (${report.totals.chunks.head} chunks) | ${kib(report.totals.base)} | ${kib(report.totals.head)} | ${delta(report.totals.base, report.totals.head)} |`,
    "",
  ];

  if (initial.topModules.length) {
    lines.push("**Initial load, largest additions (minified)**", "");
    lines.push(...initial.topModules.map(moduleLine), "");
  }

  if (report.movedIntoInitialLoad.length) {
    lines.push("**Moved into the initial load**", "");
    for (const group of report.movedIntoInitialLoad) {
      lines.push(
        `- ${code(group.name)}: ${kib(group.bytes)} minified${group.importers.length ? `, statically imported by ${names(group.importers)}` : ""}`
      );
    }
    lines.push("");
  }

  lines.push(
    "**Bundles** (load cost: the bundle plus what it loads beyond the initial load)",
    "",
    "| Bundle | Kind | Status | Own size | Load cost base | Load cost head | Change |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: |"
  );
  for (const bundle of report.bundles) {
    const flag =
      flaggedKeys.has(`grew:${bundle.key}`) ||
      flaggedKeys.has(`new:${bundle.key}`)
        ? " ⚠️"
        : "";
    const status = bundle.movedToInitialLoad
      ? "moved into initial load"
      : bundle.status;
    lines.push(
      `| ${cell(bundle.name)}${flag} | ${bundle.kind} | ${status} | ${bundle.head ? kib(bundle.head.own) : "–"} | ${bundle.base ? kib(bundle.base.load) : "–"} | ${bundle.head ? kib(bundle.head.load) : "–"} | ${bundle.base && bundle.head ? delta(bundle.base.load, bundle.head.load) : "–"} |`
    );
  }
  lines.push("");

  for (const [title, list] of [
    ["New connections", report.edges.added],
    ["Removed connections", report.edges.removed],
  ]) {
    if (list.length) {
      lines.push(`**${title}**`, "");
      for (const edge of list) {
        lines.push(
          `- ${code(edge.fromName)} → ${code(edge.toName)}: ${edge.kind}${exampleText(edge.examples)}`
        );
      }
      lines.push("");
    }
  }

  const changedAssets = report.assets.filter((a) => a.base !== a.head);
  lines.push(
    `**Other assets** (wasm and worker files, ${report.assets.length} total, ${changedAssets.length} changed)`,
    ""
  );
  if (changedAssets.length) {
    lines.push("| Asset | Base | Head |", "| --- | ---: | ---: |");
    for (const asset of changedAssets) {
      lines.push(
        `| ${cell(asset.label)} | ${asset.base === null ? "–" : kib(asset.base)} | ${asset.head === null ? "–" : kib(asset.head)} |`
      );
    }
    lines.push("");
  }

  if (report.duplicatePackages.length) {
    lines.push("**Packages bundled in more than one version**", "");
    for (const pkg of report.duplicatePackages) {
      lines.push(
        `- ${code(pkg.name)}: ${pkg.versions.map(code).join(", ")}${pkg.new ? " (new)" : ""}`
      );
    }
    lines.push("");
  }

  lines.push(`Reproduce locally: \`${REPRODUCE}\``, "");
  return lines.join("\n");
}

function section(title, items) {
  const shown = items.slice(0, MAX_LIST);
  const hidden = items.length - shown.length;
  return [
    title,
    ...shown,
    ...(hidden > 0 ? [`- … and ${hidden} more in the full report`] : []),
    "",
  ].join("\n");
}

/** Groups edges that share a target and kind, e.g. from one shared chunk. */
function groupEdges(edges) {
  const groups = new Map();
  for (const edge of edges) {
    const key = `${edge.to}|${edge.kind}`;
    if (!groups.has(key)) {
      groups.set(key, {
        toName: edge.toName,
        kind: edge.kind,
        from: [],
        examples: edge.examples,
      });
    }
    groups.get(key).from.push(edge.fromName);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    from: group.from.slice(0, MAX_NAMES),
    more: Math.max(0, group.from.length - MAX_NAMES),
  }));
}

function exampleText(examples) {
  const example = examples?.[0];
  return example ? `, from ${code(example.from)}` : "";
}

function names(ids) {
  return ids.map(code).join(", ");
}

function moduleLine(module) {
  return `- ${code(module.id)} ${signedKib(module.delta)}${module.added ? " (new)" : ""}`;
}

function sizeChange(base, head) {
  return `${kib(base)} → ${kib(head)} (${delta(base, head)})`;
}

function delta(base, head) {
  const change = head - base;
  if (change === 0) {
    return "0";
  }
  const percent =
    base > 0
      ? `, ${change > 0 ? "+" : ""}${((change / base) * 100).toFixed(1)}%`
      : "";
  return `${signedKib(change)}${percent}`;
}

export function kib(bytes) {
  if (Math.abs(number(bytes)) < 1024) {
    return `${bytes} B`;
  }
  const value = bytes / 1024;
  const digits = Math.abs(value) < 10 ? 1 : 0;
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} KiB`;
}

function signedKib(bytes) {
  return `${number(bytes) > 0 ? "+" : ""}${kib(bytes)}`;
}

function number(value) {
  if (!Number.isFinite(value)) {
    throw new Error(`Expected a number, got ${typeof value}`);
  }
  return value;
}

/**
 * Inline code for strings that come from the build (module ids, bundle
 * names). Code spans keep them from rendering as markdown, links or
 * mentions; the fence is longer than any backtick run inside.
 */
export function code(value) {
  let text = String(value).replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ");
  if (text.length > MAX_STRING) {
    const half = Math.floor((MAX_STRING - 1) / 2);
    text = `${text.slice(0, half)}…${text.slice(-half)}`;
  }
  const longestRun = Math.max(
    0,
    ...(text.match(/`+/g) ?? []).map((run) => run.length)
  );
  const fence = "`".repeat(longestRun + 1);
  const pad =
    text.startsWith("`") || text.endsWith("`") || text.trim() !== text
      ? " "
      : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** `code()` for table cells, where a pipe would end the cell. */
function cell(value) {
  return code(value).replaceAll("|", "\\|");
}
