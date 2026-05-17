import { BadgeSchema } from "discourse/data/schemas/badge";
import { BadgeGroupingSchema } from "discourse/data/schemas/badge-grouping";
import { BadgeTypeSchema } from "discourse/data/schemas/badge-type";
import { TopicDetailsSchema } from "discourse/data/schemas/topic-details";
import { UserBadgeSchema } from "discourse/data/schemas/user-badge";
import { i18n } from "discourse-i18n";

// Pull every scalar field out of the raw payload into a JSON:API
// `attributes` object. Relationship fields are handled separately by each
// per-resource builder.
function pickSchemaAttributes(raw, schema) {
  const out = {};
  for (const field of schema.fields ?? []) {
    if (field.kind !== "attribute") {
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
  const attributes = pickSchemaAttributes(raw, BadgeGroupingSchema);
  if (raw.name) {
    const i18nNameKey = raw.name.toLowerCase().replace(/\s/g, "_");
    attributes.displayName = i18n(`badges.badge_grouping.${i18nNameKey}.name`, {
      defaultValue: raw.name,
    });
  }
  return {
    type: "badge-grouping",
    id: String(raw.id),
    attributes,
  };
}

function userBadgeResource(raw, lookup) {
  const attributes = pickSchemaAttributes(raw, UserBadgeSchema);
  // Inline the user/topic sideloads as plain attribute values so consumers
  // get plain JS objects (with arbitrary fields) rather than cached records.
  if (raw.user_id != null) {
    attributes.user = lookup.user(raw.user_id);
  }
  if (raw.granted_by_id != null) {
    attributes.granted_by = lookup.user(raw.granted_by_id);
  }
  if (raw.topic_id != null) {
    attributes.topic = lookup.topic(raw.topic_id);
  }

  const relationships = {};
  if (raw.badge_id != null) {
    relationships.badge = {
      data: { type: "badge", id: String(raw.badge_id) },
    };
  }
  return {
    type: "user-badge",
    id: String(raw.id),
    attributes,
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
// Returns a JSON:API document: { data, included }. Empty / unrecognized
// payloads (e.g. an empty response body after a save) produce `{ data: null }`,
// which the cache validator accepts as a no-op.
export function normalizeBadgesPayload(payload) {
  if (!payload) {
    return { data: null };
  }
  const included = [];
  collectBadgeMetaIncluded(payload, included);

  if (payload.badge) {
    return { data: badgeResource(payload.badge), included };
  }
  if (payload.badges) {
    return { data: payload.badges.map(badgeResource), included };
  }
  return { data: null, included };
}

// Accepts any of:
//   { user_badge: {...}, badges, badge_types, users, topics, granted_bies }      (grant POST)
//   { user_badges: [...], badges, badge_types, users, topics, granted_bies }     (findByUsername)
//   { user_badge_info: { user_badges, grant_count, username }, badges, ... }     (findByBadgeId)
// Returns { data, included, meta? }.
export function normalizeUserBadgesPayload(payload) {
  if (!payload) {
    return { data: null };
  }
  const included = [];
  collectBadgeMetaIncluded(payload, included);
  for (const raw of payload.badges ?? []) {
    included.push(badgeResource(raw));
  }

  // Index sideloaded users / topics by id so the user-badge resource can
  // inline them as plain attribute values (see `userBadgeResource`).
  const usersById = new Map();
  for (const raw of [
    ...(payload.users ?? []),
    ...(payload.granted_bies ?? []),
  ]) {
    if (!usersById.has(raw.id)) {
      usersById.set(raw.id, raw);
    }
  }
  const topicsById = new Map();
  for (const raw of payload.topics ?? []) {
    topicsById.set(raw.id, raw);
  }
  const lookup = {
    user: (id) => usersById.get(id),
    topic: (id) => topicsById.get(id),
  };

  if (payload.user_badge) {
    return { data: userBadgeResource(payload.user_badge, lookup), included };
  }

  const wrapper = payload.user_badge_info;
  const rawUserBadges = wrapper?.user_badges ?? payload.user_badges ?? [];
  const doc = {
    data: rawUserBadges.map((ub) => userBadgeResource(ub, lookup)),
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
  return {
    data: {
      type: "topic-details",
      id: String(topicId),
      attributes: pickSchemaAttributes(details, TopicDetailsSchema),
    },
  };
}
