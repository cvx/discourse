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

// Accepts either:
//   { badge: {...},  badge_types: [...], badge_groupings?: [...] }   (show)
//   { badges: [...], badge_types: [...], badge_groupings: [...] }    (index)
// Returns a JSON:API document: { data, included }.
export function normalizeBadgesPayload(payload) {
  const included = [];
  for (const raw of payload.badge_types ?? []) {
    included.push(badgeTypeResource(raw));
  }
  for (const raw of payload.badge_groupings ?? []) {
    included.push(badgeGroupingResource(raw));
  }

  if (payload.badge) {
    return { data: badgeResource(payload.badge), included };
  }
  return {
    data: (payload.badges ?? []).map(badgeResource),
    included,
  };
}
