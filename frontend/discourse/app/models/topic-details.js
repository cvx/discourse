import { tracked } from "@glimmer/tracking";
import {
  removeAllowedTopicGroup,
  removeAllowedTopicUser,
  updateTopicNotificationLevel,
} from "discourse/data/builders/topic-details";
import { normalizeTopicDetailsPayload } from "discourse/data/normalize";
import WarpRestModel, {
  defineFieldForwarders,
  warpStoreFor,
} from "discourse/data/reactive-base";
import { TopicDetailsSchema } from "discourse/data/schemas/topic-details";

// Builds a partial relationship-update push for a hasMany on the
// topic-details cache record. Used after a remove-allowed-X call returns to
// reflect the removal locally.
function pushRelationship(td, relationshipName, remainingRecords, relatedType) {
  const store = warpStoreFor(td.constructor);
  store.push({
    data: {
      type: "topic-details",
      id: td.id,
      relationships: {
        [relationshipName]: {
          data: remainingRecords.map((r) => ({
            type: relatedType,
            id: String(r.id),
          })),
        },
      },
    },
  });
}

/**
 * A topic's details (allowed users/groups, can_* permissions, notification
 * level, etc.). Loaded as part of the topic-view payload rather than from a
 * dedicated endpoint — its identity is the parent topic's id.
 */
export default class TopicDetails extends WarpRestModel {
  static type = "topic-details";

  // Old-store entry point: `store.createRecord("topicDetails", { id, topic })`.
  // Returns a wrapper bound to the topic id; the cache stays empty until
  // `updateFromJson` is called with actual data.
  static create(attrs = {}) {
    const td = new this(attrs.id);
    if (attrs.topic !== undefined) {
      td.topic = attrs.topic;
    }
    return td;
  }

  @tracked loaded = false;
  topic = null;

  #topicId;

  constructor(topicId) {
    super();
    this.#topicId = topicId == null ? null : String(topicId);
  }

  get id() {
    return this.#topicId;
  }

  // The cache resource is materialized lazily — at construction time the
  // details haven't loaded yet. Re-reading each access keeps the wrapper in
  // sync with the cache when `updateFromJson` (or any partial push) lands.
  get __resource() {
    if (this.#topicId == null) {
      return null;
    }
    return (
      warpStoreFor(this.constructor).peekRecord({
        type: "topic-details",
        id: this.#topicId,
      }) ?? null
    );
  }

  // Topic invokes this when the topic-view JSON arrives (and on subsequent
  // refreshes). Pushes a full normalized doc; subsequent calls merge.
  updateFromJson(details) {
    if (this.#topicId == null || !details) {
      return;
    }
    const store = warpStoreFor(this.constructor);
    store.push(
      normalizeTopicDetailsPayload({ topicId: this.#topicId, details })
    );
    this.loaded = true;
  }

  updateNotifications(level) {
    const store = warpStoreFor(this.constructor);
    return store
      .request(updateTopicNotificationLevel(this.#topicId, level))
      .then(() => {
        this._pushAttributes({
          notification_level: level,
          notifications_reason_id: null,
        });
      });
  }

  async removeAllowedGroup(group) {
    const store = warpStoreFor(this.constructor);
    await store.request(removeAllowedTopicGroup(this.#topicId, group.name));

    const remaining = this.allowed_groups.filter((g) => g.name !== group.name);
    pushRelationship(this, "allowed_groups", remaining, "group");
  }

  async removeAllowedUser(user) {
    const username = user.username ?? user.get?.("username");
    const store = warpStoreFor(this.constructor);
    await store.request(removeAllowedTopicUser(this.#topicId, username));

    const remaining = this.allowed_users.filter((u) => u.username !== username);
    pushRelationship(this, "allowed_users", remaining, "user");
  }
}

defineFieldForwarders(TopicDetails, TopicDetailsSchema);
