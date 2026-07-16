import { tracked } from "@glimmer/tracking";
import { trackedObject } from "@ember/reactive/collections";
import WarpRestModel from "discourse/data/warp-rest-model";

// Bridges Discourse's legacy `Store` + `RestModel` callsites to WarpRestModel.
// Drop this layer (extend WarpRestModel directly) once a model's callers no
// longer use `.get` / `.set` / `.setProperties` / `store.createRecord` /
// `record.save` / `record.destroyRecord`.
export default class RestCompatModel extends WarpRestModel {
  // Identity by default; legacy `service:store._hydrate` calls this on cache
  // updates. Subclasses can override to massage JSON before it lands.
  static munge(json) {
    return json;
  }

  // Draft attrs go into a `trackedObject` so field reads/writes are reactive
  // — Glimmer templates rerender when callers do `bookmark.set("name", ...)`,
  // matching the old EmberObject behavior. Cached LegacyMode records have
  // their own signal-based reactivity.
  static create(attrs = {}) {
    const wrapper = new this(trackedObject({ ...attrs }));
    wrapper.__isLocalDraft = true;
    return wrapper;
  }

  @tracked isSaving = false;

  // Subclasses override (e.g. `TagNotification` uses `"name"`).
  primaryKey = "id";

  // True until `save()` / `updateFromJson()` swaps in the cached record. The
  // flag lives on the wrapper because cached LegacyMode records reject any
  // field not declared in their schema.
  __isLocalDraft = false;

  _didReplaceResource() {
    this.__isLocalDraft = false;
  }

  // `store`, `__type`, `__state` are stamped onto the raw attrs by
  // `Store._build` and land in the trackedObject; the wrapper needs explicit
  // accessors to reach them back out.

  get store() {
    return this.__resource?.store;
  }

  get __type() {
    return this.__resource?.__type;
  }

  get __state() {
    return this.__resource?.__state;
  }

  set __state(value) {
    if (this.__resource) {
      this.__resource.__state = value;
    }
  }

  get isNew() {
    return this.__state === "new";
  }

  get isCreated() {
    return this.__state === "created";
  }

  get(path) {
    if (typeof path !== "string") {
      return undefined;
    }
    return path.split(".").reduce((acc, key) => acc?.[key], this);
  }

  set(key, value) {
    // Drafts: mutate the attrs bag directly. Cached records: route through
    // the prototype setter, which writes to the record's own field.
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
    return Object.fromEntries(keys.map((k) => [k, this.get(k)]));
  }

  setProperties(hash) {
    if (!hash) {
      return hash;
    }
    for (const [key, value] of Object.entries(hash)) {
      this.set(key, value);
    }
    return hash;
  }

  // Legacy `RestModel#save`. If the subclass defines `static builders.save`,
  // delegate to `WarpRestModel.save` (builder-driven, WarpDrive path);
  // otherwise branch on `isNew` and use the legacy adapter pipeline.
  save(data) {
    if (this.constructor.builders?.save) {
      return super.save(data);
    }
    return this.isNew ? this._saveNew(data) : this.update(data);
  }

  async _saveNew(props) {
    return this.#withSaving(async () => {
      const adapter = this.store.adapterFor(this.__type);
      const res = await adapter.createRecord(this.store, this.__type, props);
      if (res.payload) {
        this.setProperties(this.constructor.munge(res.payload));
        this.__state = "created";
      }
      res.target = this;
      return res;
    });
  }

  async update(props) {
    return this.#withSaving(async () => {
      const res = await this.store.update(
        this.__type,
        this[this.primaryKey],
        props
      );
      const payload = this.constructor.munge(res.payload || res.responseJson);
      if (payload && payload.success !== "OK") {
        this.setProperties(payload);
      }
      res.target = this;
      return res;
    });
  }

  destroyRecord() {
    return this.store.destroyRecord(this.__type, this);
  }

  async #withSaving(fn) {
    if (this.isSaving) {
      return Promise.reject();
    }
    this.isSaving = true;
    try {
      return await fn();
    } finally {
      this.isSaving = false;
    }
  }
}
