import {
  indexIncluded,
  maybeRelate,
  pickSchemaAttributes,
} from "discourse/data/jsonapi-utils";
import { BadgeSchema } from "discourse/data/schemas/badge";
import { BadgeGroupingSchema } from "discourse/data/schemas/badge-grouping";
import { BadgeTypeSchema } from "discourse/data/schemas/badge-type";
import { TopicDetailsSchema } from "discourse/data/schemas/topic-details";
import { UserBadgeSchema } from "discourse/data/schemas/user-badge";
import { i18n } from "discourse-i18n";

function badgeResource(raw, includedIds) {
  const relationships = {};
  maybeRelate(
    relationships,
    "badge_type",
    includedIds,
    "badge-type",
    raw.badge_type_id
  );
  maybeRelate(
    relationships,
    "badge_grouping",
    includedIds,
    "badge-grouping",
    raw.badge_grouping_id
  );
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

function userBadgeResource(raw, lookup, includedIds) {
  const attributes = pickSchemaAttributes(raw, UserBadgeSchema);
  // Inline sideloads as plain objects so templates can read arbitrary fields
  // without hitting LegacyMode's strict schema check on cached records.
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
  maybeRelate(relationships, "badge", includedIds, "badge", raw.badge_id);
  return {
    type: "user-badge",
    id: String(raw.id),
    attributes,
    relationships,
  };
}

function collectBadgeMetaIncluded(payload, included) {
  for (const raw of payload.badge_types ?? []) {
    included.push(badgeTypeResource(raw));
  }
  for (const raw of payload.badge_groupings ?? []) {
    included.push(badgeGroupingResource(raw));
  }
}

// Accepts:
//   { badge: {...},  badge_types: [...], badge_groupings?: [...] }   (show)
//   { badges: [...], badge_types: [...], badge_groupings: [...] }    (index)
// Empty / unrecognized payloads return `{ data: null }` (no `included` —
// JSON:API forbids it when data is null).
export function normalizeBadgesPayload(payload) {
  if (!payload) {
    return { data: null };
  }
  const included = [];
  collectBadgeMetaIncluded(payload, included);
  const includedIds = indexIncluded(included);

  if (payload.badge) {
    return { data: badgeResource(payload.badge, includedIds), included };
  }
  if (payload.badges) {
    return {
      data: payload.badges.map((raw) => badgeResource(raw, includedIds)),
      included,
    };
  }
  return { data: null };
}

// Accepts:
//   { user_badge: {...}, badges, badge_types, users, topics, granted_bies }      (grant POST)
//   { user_badges: [...], badges, badge_types, users, topics, granted_bies }     (findByUsername)
//   { user_badge_info: { user_badges, grant_count, username }, badges, ... }     (findByBadgeId)
export function normalizeUserBadgesPayload(payload) {
  if (!payload) {
    return { data: null };
  }
  const included = [];
  collectBadgeMetaIncluded(payload, included);
  // Index BEFORE pushing sideloaded badges so each badge's relationships only
  // reference badge-type / badge-grouping resources we actually included.
  const badgeRelIds = indexIncluded(included);
  for (const raw of payload.badges ?? []) {
    included.push(badgeResource(raw, badgeRelIds));
  }
  const includedIds = indexIncluded(included);

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
    return {
      data: userBadgeResource(payload.user_badge, lookup, includedIds),
      included,
    };
  }

  const wrapper = payload.user_badge_info;
  const rawUserBadges = wrapper?.user_badges ?? payload.user_badges ?? [];
  const doc = {
    data: rawUserBadges.map((ub) => userBadgeResource(ub, lookup, includedIds)),
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

export function normalizeTopicDetailsPayload({ topicId, details }) {
  return {
    data: {
      type: "topic-details",
      id: String(topicId),
      attributes: pickSchemaAttributes(details, TopicDetailsSchema),
    },
  };
}
