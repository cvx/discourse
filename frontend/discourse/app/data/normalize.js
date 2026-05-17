import { BadgeSchema } from "discourse/data/schemas/badge";
import { BadgeGroupingSchema } from "discourse/data/schemas/badge-grouping";
import { BadgeTypeSchema } from "discourse/data/schemas/badge-type";
import { GroupSchema } from "discourse/data/schemas/group";
import { TopicSchema } from "discourse/data/schemas/topic";
import { TopicDetailsSchema } from "discourse/data/schemas/topic-details";
import { UserSchema } from "discourse/data/schemas/user";
import { UserBadgeSchema } from "discourse/data/schemas/user-badge";

// Pull every `kind: "field"` (scalar) name out of the raw payload into a
// JSON:API `attributes` object. Relationship fields are handled separately
// by each per-resource builder.
function pickSchemaAttributes(raw, schema) {
  const out = {};
  for (const field of schema.fields ?? []) {
    if (field.kind !== "field") {
      continue;
    }
    if (field.name in raw) {
      out[field.name] = raw[field.name];
    }
  }
  return out;
}

function badgeResource(raw) {
  const relationships = {};
  if (raw.badge_type_id != null) {
    relationships.badge_type = {
      data: { type: "badge-type", id: String(raw.badge_type_id) },
    };
  }
  if (raw.badge_grouping_id != null) {
    relationships.badge_grouping = {
      data: { type: "badge-grouping", id: String(raw.badge_grouping_id) },
    };
  }
  return {
    type: "badge",
    id: String(raw.id),
    attributes: pickSchemaAttributes(raw, BadgeSchema),
    relationships,
  };
}

function badgeTypeResource(raw) {
  return {
    type: "badge-type",
    id: String(raw.id),
    attributes: pickSchemaAttributes(raw, BadgeTypeSchema),
  };
}

function badgeGroupingResource(raw) {
  return {
    type: "badge-grouping",
    id: String(raw.id),
    attributes: pickSchemaAttributes(raw, BadgeGroupingSchema),
  };
}

function userResource(raw) {
  return {
    type: "user",
    id: String(raw.id),
    attributes: pickSchemaAttributes(raw, UserSchema),
  };
}

function topicResource(raw) {
  return {
    type: "topic",
    id: String(raw.id),
    attributes: pickSchemaAttributes(raw, TopicSchema),
  };
}

function groupResource(raw) {
  return {
    type: "group",
    id: String(raw.id),
    attributes: pickSchemaAttributes(raw, GroupSchema),
  };
}

function userBadgeResource(raw) {
  const relationships = {};
  if (raw.badge_id != null) {
    relationships.badge = {
      data: { type: "badge", id: String(raw.badge_id) },
    };
  }
  if (raw.user_id != null) {
    relationships.user = {
      data: { type: "user", id: String(raw.user_id) },
    };
  }
  if (raw.granted_by_id != null) {
    relationships.granted_by = {
      data: { type: "user", id: String(raw.granted_by_id) },
    };
  }
  if (raw.topic_id != null) {
    relationships.topic = {
      data: { type: "topic", id: String(raw.topic_id) },
    };
  }
  return {
    type: "user-badge",
    id: String(raw.id),
    attributes: pickSchemaAttributes(raw, UserBadgeSchema),
    relationships,
  };
}

// Collects the badge-adjacent sideloads (badge_types, badge_groupings) into
// the JSON:API `included` array. Used by both badge and user-badge payloads;
// the caller decides where the badges themselves go (primary `data` for badge
// payloads, `included` for user-badge payloads).
function collectBadgeMetaIncluded(payload, included) {
  for (const raw of payload.badge_types ?? []) {
    included.push(badgeTypeResource(raw));
  }
  for (const raw of payload.badge_groupings ?? []) {
    included.push(badgeGroupingResource(raw));
  }
}

// Accepts either:
//   { badge: {...},  badge_types: [...], badge_groupings?: [...] }   (show)
//   { badges: [...], badge_types: [...], badge_groupings: [...] }    (index)
// Returns a JSON:API document: { data, included }.
export function normalizeBadgesPayload(payload) {
  const included = [];
  collectBadgeMetaIncluded(payload, included);

  if (payload.badge) {
    return { data: badgeResource(payload.badge), included };
  }
  return {
    data: (payload.badges ?? []).map(badgeResource),
    included,
  };
}

// Accepts any of:
//   { user_badge: {...}, badges, badge_types, users, topics, granted_bies }      (grant POST)
//   { user_badges: [...], badges, badge_types, users, topics, granted_bies }     (findByUsername)
//   { user_badge_info: { user_badges, grant_count, username }, badges, ... }     (findByBadgeId)
// Returns { data, included, meta? }.
export function normalizeUserBadgesPayload(payload) {
  const included = [];
  collectBadgeMetaIncluded(payload, included);
  for (const raw of payload.badges ?? []) {
    included.push(badgeResource(raw));
  }

  // Users may appear in either `users` (grantees) or `granted_bies` (granters);
  // dedupe by id so a single cache entry holds the union of fields.
  const seenUsers = new Map();
  for (const raw of [
    ...(payload.users ?? []),
    ...(payload.granted_bies ?? []),
  ]) {
    if (!seenUsers.has(raw.id)) {
      seenUsers.set(raw.id, userResource(raw));
    }
  }
  for (const resource of seenUsers.values()) {
    included.push(resource);
  }

  for (const raw of payload.topics ?? []) {
    included.push(topicResource(raw));
  }

  if (payload.user_badge) {
    return { data: userBadgeResource(payload.user_badge), included };
  }

  const wrapper = payload.user_badge_info;
  const rawUserBadges = wrapper?.user_badges ?? payload.user_badges ?? [];
  const doc = {
    data: rawUserBadges.map(userBadgeResource),
    included,
  };
  if (wrapper) {
    doc.meta = {
      grant_count: wrapper.grant_count,
      username: wrapper.username,
    };
  }
  return doc;
}

// Builds a JSON:API document for a single TopicDetails record from the
// embedded `details` object of a topic-view payload. The parent topic's id
// becomes the topic-details identity (one details per topic).
export function normalizeTopicDetailsPayload({ topicId, details }) {
  const included = [];
  const relationships = {};

  if (details.allowed_users) {
    relationships.allowed_users = {
      data: details.allowed_users.map((u) => ({
        type: "user",
        id: String(u.id),
      })),
    };
    for (const raw of details.allowed_users) {
      included.push(userResource(raw));
    }
  }
  if (details.allowed_groups) {
    relationships.allowed_groups = {
      data: details.allowed_groups.map((g) => ({
        type: "group",
        id: String(g.id),
      })),
    };
    for (const raw of details.allowed_groups) {
      included.push(groupResource(raw));
    }
  }

  return {
    data: {
      type: "topic-details",
      id: String(topicId),
      attributes: pickSchemaAttributes(details, TopicDetailsSchema),
      relationships,
    },
    included,
  };
}
