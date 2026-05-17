// Generic JSON:API helpers shared by `normalize.js` and any future per-model
// normalizer. Pure functions — no Discourse-specific knowledge.

// Copy every scalar (`kind: "attribute"`) field out of `raw` into a JSON:API
// `attributes` object. Relationship fields are emitted separately by the
// per-resource builders.
export function pickSchemaAttributes(raw, schema) {
  const out = {};
  for (const field of schema.fields ?? []) {
    if (field.kind !== "attribute") {
      continue;
    }
    if (field.name in raw) {
      out[field.name] = raw[field.name];
    }
  }
  return out;
}

// Build a `Set` of `${type}:${id}` strings from a JSON:API `included` array.
// Used to gate per-record relationship pointers (see `maybeRelate`).
export function indexIncluded(included) {
  return new Set(included.map((r) => `${r.type}:${r.id}`));
}

// Add a JSON:API relationship pointer to `relationships[name]` only when the
// related resource is present in `includedIds` for this payload. Referencing
// a missing identity would log a "No ResourceObject matching..." warning
// from the cache validator and the pointer would dangle on cold loads.
// Omitting the pointer lets the cache fall back to any existing entry for
// that identity (e.g. when an earlier payload loaded the related resource).
export function maybeRelate(relationships, name, includedIds, type, id) {
  if (id == null || !includedIds.has(`${type}:${id}`)) {
    return;
  }
  relationships[name] = { data: { type, id: String(id) } };
}
