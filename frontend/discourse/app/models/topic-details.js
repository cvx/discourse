import { tracked } from "@glimmer/tracking";
import {
  removeAllowedTopicGroup,
  removeAllowedTopicUser,
  updateTopicNotificationLevel,
} from "discourse/data/builders/topic-details";
import { normalizeTopicDetailsPayload } from "discourse/data/normalize";
import RestCompatModel from "discourse/data/rest-compat";
import { TopicDetailsSchema } from "discourse/data/schemas/topic-details";
import {
  defineFieldForwarders,
  warpStoreFor,
} from "discourse/data/warp-rest-model";

/**
 * A topic's details (allowed users/groups, can_* permissions, notification
 * level, etc.). Loaded as part of the topic-view payload rather than from a
 * dedicated endpoint — its identity is the parent topic's id.
 */
export default class TopicDetails extends RestCompatModel {
  static type = "topic-details";

  // Old-store entry point: `store.createRecord("topicDetails", { id, topic, ...attrs })`.
  // Returns a wrapper bound to the topic id. Any additional attrs (e.g.
  // `allowed_users` passed directly by a test or by `topic.details = {...}`)
  // are stashed in a draft bag that the wrapper reads/writes through until
  // the cache record materializes.
  static create({ id, topic, ...rest } = {}) {
    const td = new this(id);
    if (topic !== undefined) {
      td.topic = topic;
    }
    if (Object.keys(rest).length > 0) {
      td.#draft = rest;
    }
    return td;
  }

  @tracked loaded = false;
  topic = null;

  #topicId;
  #draft = {};

  constructor(topicId) {
    super();
    this.#topicId = topicId == null ? null : String(topicId);
  }

  // Topic's `_details` field initializer runs before Topic.id has been
  // assigned, so the wrapper is constructed with a null topicId. We back-fill
  // from `this.topic.id` lazily — Topic.create later sets the id, and any
  // subsequent access resolves it.
  #effectiveTopicId() {
    if (this.#topicId == null && this.topic?.id != null) {
      this.#topicId = String(this.topic.id);
    }
    return this.#topicId;
  }

  get id() {
    return this.#effectiveTopicId();
  }

  // The cache resource is materialized lazily — at construction time the
  // details haven't loaded yet. Re-reading each access keeps the wrapper in
  // sync with the cache when `updateFromJson` (or any partial push) lands.
  // Falls back to the draft bag so attrs passed to `create({...})` (or
  // assigned before `updateFromJson` arrives) are readable / writable.
  get __resource() {
    const id = this.#effectiveTopicId();
    if (id != null) {
      const cached = warpStoreFor(this.constructor).peekRecord({
        type: "topic-details",
        id,
      });
      if (cached) {
        return cached;
      }
    }
    return this.#draft;
  }

  // Topic invokes this when the topic-view JSON arrives (and on subsequent
  // refreshes). Pushes a full normalized doc; subsequent calls merge.
  updateFromJson(details) {
    const id = this.#effectiveTopicId();
    if (id == null || !details) {
      return;
    }
    const store = warpStoreFor(this.constructor);
    store.push(normalizeTopicDetailsPayload({ topicId: id, details }));
    this.loaded = true;
  }

  updateNotifications(level) {
    const store = warpStoreFor(this.constructor);
    const id = this.#effectiveTopicId();
    return store.request(updateTopicNotificationLevel(id, level)).then(() => {
      // LegacyMode records are mutable — assign through the field
      // forwarders directly.
      this.notification_level = level;
      this.notifications_reason_id = null;
    });
  }

  async removeAllowedGroup(group) {
    const store = warpStoreFor(this.constructor);
    await store.request(
      removeAllowedTopicGroup(this.#effectiveTopicId(), group.name)
    );
    this.allowed_groups = this.allowed_groups.filter(
      (g) => g.name !== group.name
    );
  }

  async removeAllowedUser(user) {
    const username = user.username ?? user.get?.("username");
    const store = warpStoreFor(this.constructor);
    await store.request(
      removeAllowedTopicUser(this.#effectiveTopicId(), username)
    );
    this.allowed_users = this.allowed_users.filter(
      (u) => u.username !== username
    );
  }
}

defineFieldForwarders(TopicDetails, TopicDetailsSchema);
