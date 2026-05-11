import { getOwnerWithFallback } from "discourse/lib/get-owner";

function warpStoreFor(klass) {
  const owner = klass.__owner ?? getOwnerWithFallback();
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

  save() {
    throw new Error(
      `${this.constructor.name}#save is not yet migrated to WarpDrive`
    );
  }

  destroy() {
    throw new Error(
      `${this.constructor.name}#destroy is not yet migrated to WarpDrive`
    );
  }

  updateFromJson() {
    throw new Error(
      `${this.constructor.name}#updateFromJson is not yet migrated to WarpDrive`
    );
  }
}
