import WarpRestModel from "discourse/data/warp-rest-model";

// Legacy compatibility layer for models that still need to slot into
// Discourse's old `Store` + `RestModel` API surface. Adds:
//
//   - `Klass.create(attrs)` → returns a *draft* wrapper whose `__resource`
//     is a plain attrs bag rather than a cached LegacyMode record. Used by
//     `store.createRecord("badge", {...})`, factory-style construction, and
//     pre-cached payload ingestion.
//   - `__isLocalDraft` instance flag — true until `save()` / `updateFromJson()`
//     swaps in the cached record. The marker lives on the wrapper because
//     cached LegacyMode records reject any field not declared in their schema.
//   - Ember-style accessors: `get(path)`, `set(key, value)`, `getProperties`,
//     `setProperties`. Templates and helpers across Discourse still use these.
//
// When a model's callers have all migrated away from these idioms, the model
// can switch its `extends` to `WarpRestModel` directly and drop the compat.
export default class RestCompatModel extends WarpRestModel {
  static create(attrs = {}) {
    const wrapper = new this({ ...attrs });
    wrapper.__isLocalDraft = true;
    return wrapper;
  }

  __isLocalDraft = false;

  _didReplaceResource() {
    this.__isLocalDraft = false;
  }

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
}
