import { getOwnerWithFallback } from "discourse/lib/get-owner";

export function warpStoreFor(klass) {
  const owner = klass?.__owner ?? getOwnerWithFallback();
  return owner.lookup("service:warp-store");
}

// Pure WarpDrive integration base. Knows about schemas, the WarpDrive
// request/cache pipeline, and the lifecycle of a single wrapped resource.
// Does NOT know about Ember's EmberObject API (`get`/`set`/`setProperties`)
// or the legacy `Klass.create(attrs)`-returns-draft contract — those live in
// `rest-compat.js` for callers that still need them.
//
// Subclass contract:
//   static type             — schema type, e.g. "badge"
//   static normalize        — function: rooted JSON → JSON:API document
//   static builders         — { list(opts), one(id), save(record, data), delete(id) }
export default class WarpRestModel {
  static type = null;
  static normalize = null;
  static builders = null;

  static findAll(opts) {
    return requestMany(this, this.builders.list(opts));
  }

  static findById(id) {
    return requestOne(this, this.builders.one(id));
  }

  // Synchronously ingest already-loaded JSON into the cache. Used by callers
  // that have a preloaded payload (PreloadStore, embedded sub-payloads) and
  // want wrappers around the resulting cache records.
  static createFromJson(json) {
    const store = warpStoreFor(this);
    const document = this.normalize(json);

    if (Array.isArray(document.data)) {
      const records = store.push(document);
      return attachMeta(
        records.map((r) => new this(r)),
        document.meta
      );
    }
    return new this(store.push(document));
  }

  #resource;

  constructor(resource) {
    this.#resource = resource;
  }

  get __resource() {
    return this.#resource;
  }

  // Internal: try to swap `__resource` to the cached record for `id`. Called
  // after `save` / `updateFromJson` / `_adoptCacheRecord`. Subclasses can
  // define `_didReplaceResource` to react to the swap (e.g. clear draft
  // state in the compat layer).
  _adoptResource(id) {
    if (id == null) {
      return;
    }
    const Klass = this.constructor;
    const cached = warpStoreFor(Klass).peekRecord({
      type: Klass.type,
      id: String(id),
    });
    if (cached && cached !== this.#resource) {
      this.#resource = cached;
      this._didReplaceResource?.();
    }
  }

  updateFromJson(json) {
    if (json == null) {
      return this;
    }
    const Klass = this.constructor;
    const document = Klass.normalize(json);
    if (!document || Array.isArray(document.data)) {
      return this;
    }
    warpStoreFor(Klass).push(document);
    this._adoptResource(document.data?.id);
    return this;
  }

  async save(data) {
    const Klass = this.constructor;
    const store = warpStoreFor(Klass);
    const result = await store.request(Klass.builders.save(this, data));
    this._adoptResource(result.content?.data?.id);
    return this;
  }

  async destroy() {
    const Klass = this.constructor;
    const id = this.id;
    if (id == null) {
      return;
    }
    await warpStoreFor(Klass).request(Klass.builders.delete(id));
  }

  // Used after `store.push` for an optimistic update so the wrapper reflects
  // the pushed attributes (matters when the wrapper started as a draft).
  _adoptCacheRecord() {
    this._adoptResource(this.id);
  }
}

// Surface document-level `meta` keys (grant_count, username, ...) as
// properties on the returned array so legacy callers can read them directly.
export function attachMeta(records, meta) {
  if (meta) {
    Object.assign(records, meta);
  }
  return records;
}

// Issue a request through the warp-store and wrap each resource in `content.data`
// (assumed to be an array) with `new Klass(...)`. Surfaces `content.meta` keys on
// the returned array so legacy callers can read them directly.
export async function requestMany(Klass, request) {
  const { content } = await warpStoreFor(Klass).request(request);
  return attachMeta(
    (content?.data ?? []).map((r) => new Klass(r)),
    content?.meta
  );
}

// Issue a request through the warp-store and wrap `content.data` (a single
// resource) with `new Klass(...)`.
export async function requestOne(Klass, request) {
  const { content } = await warpStoreFor(Klass).request(request);
  return new Klass(content?.data);
}

// Define accessors on Klass.prototype for each schema field (and the identity
// key). Each reads/writes through `this.__resource`:
//   - For LegacyMode cache records the underlying field is mutable, so a
//     write lands as a normal property assignment.
//   - For drafts (rest-compat) the attrs bag is a plain object — same
//     property assignment works.
// Explicit getters declared in the subclass body are preserved (they show up
// as own props on the prototype before this runs).
export function defineFieldForwarders(Klass, schema) {
  const proto = Klass.prototype;
  const fieldKinds = new Map();
  if (schema.identity?.name) {
    fieldKinds.set(schema.identity.name, "@id");
  }
  for (const field of schema.fields ?? []) {
    if (field.name && !fieldKinds.has(field.name)) {
      fieldKinds.set(field.name, field.kind);
    }
  }
  for (const [name, kind] of fieldKinds) {
    // Skip if already defined anywhere on the prototype chain — catches the
    // subclass's own getters (image, url, ...) and base-class methods (save,
    // destroy, get, set, ...) that would otherwise be shadowed by
    // legacy-derived schema fields with the same name.
    if (name in proto) {
      continue;
    }
    const descriptor = {
      configurable: true,
      get() {
        return this.__resource?.[name];
      },
    };
    // Identity getter: JSON:API stringifies ids in the cache, but the rest of
    // the Discourse codebase compares them to numeric route params, etc.
    // Coerce numeric strings back to numbers so `badge.id === 1126` keeps
    // working at call sites.
    if (kind === "@id") {
      descriptor.get = function () {
        const raw = this.__resource?.[name];
        if (typeof raw !== "string") {
          return raw;
        }
        const num = Number(raw);
        return Number.isFinite(num) && String(num) === raw ? num : raw;
      };
    }
    // Relationships are read-only through the wrapper — assigning them
    // through the prototype setter wouldn't have meaningful semantics.
    // Scalars get a passthrough setter.
    if (kind === "attribute") {
      descriptor.set = function (value) {
        if (this.__resource) {
          this.__resource[name] = value;
        }
      };
    }
    Object.defineProperty(proto, name, descriptor);
  }
}
