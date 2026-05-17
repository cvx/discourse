// Small construction helpers for WarpDrive schema definitions. They collapse
// the boilerplate of `{ kind: "attribute", name: "..." }` and the verbose
// `belongsTo` object form. Compose into the `fields` array passed to
// `withDefaults(...)` in each `data/schemas/*.js` file.
//
// `withDefaults` is re-exported so each schema file has a single import for
// schema construction. Schemas annotate their export with `@type {LegacyResourceSchema}`
// to anchor the emitted `.d.ts` (TS2883 otherwise — TS resolves the inferred
// return type through pnpm's internal `.pnpm/...` path).

export { withDefaults } from "@warp-drive/legacy/model/migration-support";

export function attrs(...names) {
  return names.map((name) => ({ kind: "attribute", name }));
}

export function belongsTo(name, type) {
  return {
    kind: "belongsTo",
    name,
    type,
    options: { async: false, inverse: null },
  };
}
