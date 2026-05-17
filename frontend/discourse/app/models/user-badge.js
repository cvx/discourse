import {
  deleteUserBadge,
  findUserBadgesByBadgeId,
  findUserBadgesByUsername,
  grantUserBadge,
  toggleFavoriteUserBadge,
} from "discourse/data/builders/user-badges";
import { normalizeUserBadgesPayload } from "discourse/data/normalize";
import WarpRestModel, {
  defineFieldForwarders,
  warpStoreFor,
} from "discourse/data/reactive-base";
import { UserBadgeSchema } from "discourse/data/schemas/user-badge";
import { popupAjaxError } from "discourse/lib/ajax-error";
import Badge from "discourse/models/badge";

// Attaches the per-document `grant_count` / `username` from a normalized
// user-badges response onto the returned wrapper array. Preserves the legacy
// shape where callers read these off the result of findByBadgeId.
function withMeta(wrappers, meta) {
  if (meta) {
    wrappers.grant_count = meta.grant_count;
    wrappers.username = meta.username;
  }
  return wrappers;
}

export default class UserBadge extends WarpRestModel {
  static type = "user-badge";
  static normalize = normalizeUserBadgesPayload;
  static builders = { delete: deleteUserBadge };

  // Overrides the base shim only to surface `grant_count` / `username` from
  // /user_badges responses (`user_badge_info` wrapper), which legacy callers
  // read off the returned array.
  static createFromJson(json) {
    const store = warpStoreFor(this);
    const document = normalizeUserBadgesPayload(json);

    if (Array.isArray(document.data)) {
      const records = store.push(document);
      return withMeta(
        records.map((r) => new this(r)),
        document.meta
      );
    }

    return new this(store.push(document));
  }

  static async findByUsername(username, options = {}) {
    if (!username) {
      return [];
    }
    const store = warpStoreFor(this);
    const result = await store.request(
      findUserBadgesByUsername(username, options)
    );
    const data = result.content?.data ?? [];
    return data.map((resource) => new this(resource));
  }

  static async findByBadgeId(badgeId, options = {}) {
    const store = warpStoreFor(this);
    const result = await store.request(
      findUserBadgesByBadgeId(badgeId, options)
    );
    const doc = result.content;
    return withMeta(
      (doc?.data ?? []).map((resource) => new this(resource)),
      doc?.meta
    );
  }

  static async grant(badgeId, username, reason) {
    const store = warpStoreFor(this);
    const result = await store.request(
      grantUserBadge(badgeId, username, reason)
    );
    return new this(result.content?.data);
  }

  // `badge` derived getters (url, badgeTypeClassName, image, newBadge) live
  // on the Badge wrapper class, not the cached ReactiveResource. Wrap here so
  // `userBadge.badge.url` etc. keep working at consumer sites.
  get badge() {
    const resource = this.__resource.badge;
    return resource ? new Badge(resource) : undefined;
  }

  // Number of milliseconds since epoch, parsed lazily from the granted_at
  // string. Matches the previous EmberObject's `grantedAt` slot.
  get grantedAt() {
    const raw = this.granted_at;
    return raw ? Date.parse(raw) : null;
  }

  get postUrl() {
    if (this.topic_title) {
      return `/t/-/${this.topic_id}/${this.post_number}`;
    }
    return undefined;
  }

  revoke() {
    return this.destroy();
  }

  async favorite() {
    const store = warpStoreFor(UserBadge);
    const previous = this.is_favorite;
    const partial = (value) => ({
      data: {
        type: "user-badge",
        id: this.id,
        attributes: { is_favorite: value },
      },
    });

    // Optimistic flip — `store.push` of a partial resource merges attributes
    // onto the existing cache entry, leaving relationships and other fields
    // intact.
    store.push(partial(!previous));

    try {
      await store.request(toggleFavoriteUserBadge(this.id));
    } catch (e) {
      store.push(partial(previous));
      popupAjaxError(e);
    }
  }
}

defineFieldForwarders(UserBadge, UserBadgeSchema);
