import { getOwnerWithFallback } from "discourse/lib/get-owner";

export function warpStoreFor(klass) {
  const owner = klass?.__owner ?? getOwnerWithFallback();
  return owner.lookup("service:warp-store");
}

export default class WarpRestModel {
  // Subclass must set:
  //   static type             — schema type, e.g. "badge"
  //   static normalize        — function: rooted JSON → JSON:API document
  //   static builders         — { list(opts), one(id) }

  static type = null;
  static normalize = null;
  static builders = null;

  // ---- Static shims (preserve `Klass.findAll` / `findById` / `createFromJson` / `create` API)
  static async findAll(opts) {
    const store = warpStoreFor(this);
    const result = await store.request(this.builders.list(opts));
    const data = result.content?.data ?? result.data ?? [];
    return data.map((resource) => new this(resource));
  }

  static async findById(id) {
    const store = warpStoreFor(this);
    const result = await store.request(this.builders.one(id));
    const data = result.content?.data ?? result.data;
    return new this(data);
  }

  // Used by callers like User.create / Post#badgesGranted / preloaded route models.
  static createFromJson(json) {
    const store = warpStoreFor(this);
    const document = this.normalize(json);

    if (Array.isArray(document.data)) {
      const records = store.push(document);
      return records.map((r) => new this(r));
    }

    const record = store.push(document);
    return new this(record);
  }

  // attribute bag without ingesting into the cache. `save()` is out of scope and throws.
  static create(attrs = {}) {
    return new this({ ...attrs, __isLocalDraft: true });
  }

  #resource;

  constructor(resource) {
    this.#resource = resource;
  }

  get __resource() {
    return this.#resource;
  }

  // Ember-style dotted-path getter for backward compatibility with callers
  // that still use `record.get("foo.bar")` instead of property access.
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

  // Ember-style multi-key getter. Accepts varargs or a single array, matching
  // `@ember/object#getProperties`. Used by route `serialize()` and similar.
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

  async save(data) {
    const Klass = this.constructor;
    const store = warpStoreFor(Klass);
    const result = await store.request(Klass.builders.save(this, data));

    // The CacheHandler has already ingested the normalized response. For a
    // draft that didn't have an id, the wrapper's `__resource` is still the
    // plain attrs bag — swap it to the cached record so subsequent reads go
    // through the cache.
    const doc = result.content;
    const id = doc?.data?.id;
    if (id != null) {
      const cached = store.peekRecord({ type: Klass.type, id });
      if (cached && cached !== this.#resource) {
        this.#resource = cached;
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

  // Pushes a partial attribute update into the cache for this record's
  // identity. Used by field setters and by instance methods that want to
  // reflect a server-confirmed change locally.
  _pushAttributes(attributes) {
    const Klass = this.constructor;
    const id = this.id;
    if (id == null) {
      return;
    }
    const store = warpStoreFor(Klass);
    store.push({
      data: { type: Klass.type, id: String(id), attributes },
    });
  }
}

// Define accessors on Klass.prototype for each schema field (and the identity
// key). Scalar `kind: "field"` fields get both a getter and a setter — the
// setter pushes a partial attribute update so Ember-style
// `setProperties({"foo.bar": value})` path-walking lands a write in the cache.
// Relationship fields (belongsTo, hasMany) get a getter only; their cached
// representation isn't reassignable through a simple value swap.
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
    if (Object.prototype.hasOwnProperty.call(proto, name)) {
      continue;
    }
    const descriptor = {
      configurable: true,
      get() {
        return this.__resource?.[name];
      },
    };
    if (kind === "field") {
      descriptor.set = function (value) {
        this._pushAttributes({ [name]: value });
      };
    }
    Object.defineProperty(proto, name, descriptor);
  }
}
