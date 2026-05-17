import {
  findUserBadgesByBadgeId,
  findUserBadgesByUsername,
  grantUserBadge,
  toggleFavoriteUserBadge,
} from "discourse/data/builders/user-badges";
import { normalizeUserBadgesPayload } from "discourse/data/normalize";
import WarpRestModel, {
  attachMeta,
  defineFieldForwarders,
  warpStoreFor,
} from "discourse/data/reactive-base";
import { UserBadgeSchema } from "discourse/data/schemas/user-badge";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import Badge from "discourse/models/badge";

export default class UserBadge extends WarpRestModel {
  static type = "user-badge";
  static normalize = normalizeUserBadgesPayload;

  static async findByUsername(username, options = {}) {
    if (!username) {
      return [];
    }
    const store = warpStoreFor(this);
    const { content } = await store.request(
      findUserBadgesByUsername(username, options)
    );
    return attachMeta(
      (content?.data ?? []).map((resource) => new this(resource)),
      content?.meta
    );
  }

  static async findByBadgeId(badgeId, options = {}) {
    const store = warpStoreFor(this);
    const { content } = await store.request(
      findUserBadgesByBadgeId(badgeId, options)
    );
    return attachMeta(
      (content?.data ?? []).map((resource) => new this(resource)),
      content?.meta
    );
  }

  static async grant(badgeId, username, reason) {
    const store = warpStoreFor(this);
    const { content } = await store.request(
      grantUserBadge(badgeId, username, reason)
    );
    return new this(content?.data);
  }

  // `badge` derived getters (url, badgeTypeClassName, image, newBadge) live
  // on the Badge wrapper class, not the cached ReactiveResource. Wrap here so
  // `userBadge.badge.url` etc. keep working at consumer sites.
  get badge() {
    const resource = this.__resource?.badge;
    return resource ? new Badge(resource) : undefined;
  }

  // Coerce null-relationships to undefined to match the previous EmberObject
  // contract — callers do `strictEqual(userBadge.granted_by, undefined)`.
  get granted_by() {
    return this.__resource?.granted_by ?? undefined;
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

  // Direct ajax (not via store.request) so the response body reaches the
  // caller — admin code does `await userBadge.revoke()` and reads the result.
  revoke() {
    return ajax(`/user_badges/${this.id}`, { type: "DELETE" });
  }

  async favorite() {
    const store = warpStoreFor(UserBadge);
    const previous = this.is_favorite;
    const partial = (value) => ({
      data: {
        type: "user-badge",
        id: String(this.id),
        attributes: { is_favorite: value },
      },
    });

    // Optimistic flip — `store.push` of a partial resource merges attributes
    // onto the existing cache entry, leaving relationships and other fields
    // intact. Adopt the cache record afterwards so the wrapper reflects the
    // pushed value (matters when the wrapper started as a draft).
    store.push(partial(!previous));
    this._adoptCacheRecord();

    try {
      await store.request(toggleFavoriteUserBadge(this.id));
    } catch (e) {
      store.push(partial(previous));
      popupAjaxError(e);
    }
  }
}

defineFieldForwarders(UserBadge, UserBadgeSchema);
