import { trackedObject } from "@ember/reactive/collections";
import WarpRestModel from "discourse/data/warp-rest-model";

// Bridges Discourse's legacy `Store` + `RestModel` callsites to WarpRestModel.
// Drop this layer (extend WarpRestModel directly) once a model's callers no
// longer use `.get(path)` / `.set(...)` / `.setProperties(...)` /
// `store.createRecord("foo", attrs)`.
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

  // True until `save()` / `updateFromJson()` swaps in the cached record. The
  // flag lives on the wrapper because cached LegacyMode records reject any
  // field not declared in their schema.
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
