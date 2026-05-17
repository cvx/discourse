import { getOwnerWithFallback } from "discourse/lib/get-owner";

export function warpStoreFor(klass) {
  const owner = klass?.__owner ?? getOwnerWithFallback();
  return owner.lookup("service:warp-store");
}

export default class WarpRestModel {
  // Subclass must set:
  //   static type             — schema type, e.g. "badge"
  //   static normalize        — function: rooted JSON → JSON:API document
  //   static builders         — { list(opts), one(id), save(badge, data), delete(id) }
  static type = null;
  static normalize = null;
  static builders = null;

  // ---- Static shims (preserve `Klass.findAll` / `findById` / `createFromJson` / `create` API)

  static async findAll(opts) {
    const store = warpStoreFor(this);
    const { content } = await store.request(this.builders.list(opts));
    return attachMeta(
      (content?.data ?? []).map((resource) => new this(resource)),
      content?.meta
    );
  }

  static async findById(id) {
    const store = warpStoreFor(this);
    const { content } = await store.request(this.builders.one(id));
    return new this(content?.data);
  }

  // Used by callers like User.create / Post#badgesGranted / preloaded route models.
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

  // Used by the old store's `createRecord("badge", { ... })` factory path —
  // returns a draft wrapper whose `__resource` is a plain attrs bag (not a
  // cached LegacyMode record). `save()` swaps in the cached record after the
  // server response arrives.
  static create(attrs = {}) {
    const wrapper = new this({ ...attrs });
    wrapper.__isLocalDraft = true;
    return wrapper;
  }

  #resource;

  // Drafts (returned from `Klass.create(attrs)`) hold a plain attrs bag as
  // `__resource` until `save()` swaps in the cached LegacyMode record. The
  // marker lives on the wrapper rather than on `__resource` because cached
  // records reject any field not declared in their schema.
  __isLocalDraft = false;

  constructor(resource) {
    this.#resource = resource;
  }

  get __resource() {
    return this.#resource;
  }

  // ---- Ember-style legacy accessors

  get(path) {
    if (typeof path !== "string") {
      return undefined;
    }
    let value = this;
    for (const key of path.split(".")) {
      if (value == null) {
        return undefined;
      }
      value = value[key];
    }
    return value;
  }

  set(key, value) {
    // For drafts, mutate the attrs bag directly so subsequent reads see the
    // new value. For LegacyMode cache records, write through the prototype
    // setter (which delegates to the record's own field).
    if (this.__isLocalDraft) {
      this.__resource[key] = value;
      return value;
    }
    this[key] = value;
    return value;
  }

  getProperties(...keys) {
    if (keys.length === 1 && Array.isArray(keys[0])) {
      keys = keys[0];
    }
    const out = {};
    for (const key of keys) {
      out[key] = this.get(key);
    }
    return out;
  }

  setProperties(hash) {
    if (!hash) {
      return hash;
    }
    for (const key of Object.keys(hash)) {
      this.set(key, hash[key]);
    }
    return hash;
  }

  // ---- Lifecycle

  updateFromJson(json) {
    if (json == null) {
      return this;
    }
    const Klass = this.constructor;
    const store = warpStoreFor(Klass);
    const document = Klass.normalize(json);
    if (!document || Array.isArray(document.data)) {
      return this;
    }
    store.push(document);
    const id = document.data?.id;
    if (id != null) {
      const cached = store.peekRecord({ type: Klass.type, id });
      if (cached && cached !== this.#resource) {
        this.#resource = cached;
        this.__isLocalDraft = false;
      }
    }
    return this;
  }

  async save(data) {
    const Klass = this.constructor;
    const store = warpStoreFor(Klass);
    const result = await store.request(Klass.builders.save(this, data));

    const doc = result.content;
    const id = doc?.data?.id;
    if (id != null) {
      const cached = store.peekRecord({ type: Klass.type, id });
      if (cached && cached !== this.#resource) {
        this.#resource = cached;
        this.__isLocalDraft = false;
      }
    }
    return this;
  }

  async destroy() {
    const Klass = this.constructor;
    const id = this.id;
    if (id == null) {
      return;
    }
    const store = warpStoreFor(Klass);
    await store.request(Klass.builders.delete(id));
  }

  // If a cache record now exists for this wrapper's id, swap `__resource` to
  // it. Used after `store.push` for an optimistic update on a draft so that
  // subsequent reads from the wrapper reflect the pushed attributes.
  _adoptCacheRecord() {
    const Klass = this.constructor;
    const id = this.id;
    if (id == null) {
      return;
    }
    const cached = warpStoreFor(Klass).peekRecord({
      type: Klass.type,
      id: String(id),
    });
    if (cached && cached !== this.#resource) {
      this.#resource = cached;
      this.__isLocalDraft = false;
    }
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

// Define accessors on Klass.prototype for each schema field (and the identity
// key). Each reads/writes through `this.__resource`:
//   - For LegacyMode cache records the underlying field is mutable, so a
//     write lands as a normal property assignment.
//   - For drafts the attrs bag is a plain object — same property assignment
//     works.
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
