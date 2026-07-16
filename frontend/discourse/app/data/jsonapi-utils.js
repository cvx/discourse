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

export function indexIncluded(included) {
  return new Set(included.map((r) => `${r.type}:${r.id}`));
}

// Add a relationship pointer only when the related resource is in
// `includedIds` — referencing a missing identity logs a cache-validator
// warning and leaves a dangling pointer on cold loads.
export function maybeRelate(relationships, name, includedIds, type, id) {
  if (id == null || !includedIds.has(`${type}:${id}`)) {
    return;
  }
  relationships[name] = { data: { type, id: String(id) } };
}
