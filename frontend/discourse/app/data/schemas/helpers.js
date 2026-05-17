// Small construction helpers for WarpDrive schema definitions. They collapse
// the boilerplate of `{ kind: "attribute", name: "..." }` and the verbose
// `belongsTo` object form. Compose into the `fields` array passed to
// `withDefaults(...)` in each `data/schemas/*.js` file.

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
