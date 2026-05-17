const BADGE_ATTRIBUTE_KEYS = [
  "name",
  "description",
  "long_description",
  "slug",
  "icon",
  "image_url",
  "grant_count",
  "enabled",
  "listable",
  "show_in_post_header",
  "has_badge",
  "allow_title",
  "multiple_grant",
  "manually_grantable",
  "system",
  // AdminBadgeSerializer attributes; absent from public responses, copied
  // through when present.
  "query",
  "trigger",
  "target_posts",
  "auto_revoke",
  "show_posts",
  "i18n_name",
  "image_upload_id",
];

const USER_ATTRIBUTE_KEYS = [
  "username",
  "name",
  "avatar_template",
  "moderator",
  "admin",
  "primary_group_name",
  "title",
];

const TOPIC_ATTRIBUTE_KEYS = ["title", "fancy_title", "slug", "posts_count"];

const USER_BADGE_ATTRIBUTE_KEYS = [
  "granted_at",
  "created_at",
  "count",
  "post_id",
  "post_number",
  "grouping_position",
  "topic_id",
  "topic_title",
  "is_favorite",
  "can_favorite",
];

function pickAttributes(raw, keys) {
  const out = {};
  for (const key of keys) {
    if (key in raw) {
      out[key] = raw[key];
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
    attributes: pickAttributes(raw, BADGE_ATTRIBUTE_KEYS),
    relationships,
  };
}

function badgeTypeResource(raw) {
  return {
    type: "badge-type",
    id: String(raw.id),
    attributes: pickAttributes(raw, ["name", "sort_order"]),
  };
}

function badgeGroupingResource(raw) {
  return {
    type: "badge-grouping",
    id: String(raw.id),
    attributes: pickAttributes(raw, [
      "name",
      "description",
      "position",
      "system",
    ]),
  };
}

function userResource(raw) {
  return {
    type: "user",
    id: String(raw.id),
    attributes: pickAttributes(raw, USER_ATTRIBUTE_KEYS),
  };
}

function topicResource(raw) {
  return {
    type: "topic",
    id: String(raw.id),
    attributes: pickAttributes(raw, TOPIC_ATTRIBUTE_KEYS),
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
    attributes: pickAttributes(raw, USER_BADGE_ATTRIBUTE_KEYS),
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
