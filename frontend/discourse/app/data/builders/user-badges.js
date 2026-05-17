import { normalizeUserBadgesPayload } from "discourse/data/normalize";

function buildQuery(params) {
  const entries = Object.entries(params).filter(
    ([, v]) => v != null && v !== ""
  );
  if (entries.length === 0) {
    return "";
  }
  return (
    "?" +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&")
  );
}

export function findUserBadgesByUsername(username, opts = {}) {
  const query = buildQuery({ grouped: opts.grouped ? "true" : null });
  return {
    url: `/user-badges/${encodeURIComponent(username)}.json${query}`,
    method: "GET",
    op: "query",
    options: { normalize: normalizeUserBadgesPayload },
  };
}

export function findUserBadgesByBadgeId(badgeId, opts = {}) {
  const query = buildQuery({
    badge_id: badgeId,
    offset: opts.offset,
    username: opts.username,
  });
  return {
    url: `/user_badges.json${query}`,
    method: "GET",
    op: "query",
    options: { normalize: normalizeUserBadgesPayload },
  };
}

export function grantUserBadge(badgeId, username, reason) {
  return {
    url: `/user_badges`,
    method: "POST",
    op: "createRecord",
    options: {
      body: { username, badge_id: badgeId, reason },
      normalize: normalizeUserBadgesPayload,
    },
  };
}

export function deleteUserBadge(id) {
  return {
    url: `/user_badges/${encodeURIComponent(id)}`,
    method: "DELETE",
    op: "deleteRecord",
    data: { type: "user-badge", id: String(id) },
  };
}

export function toggleFavoriteUserBadge(id) {
  return {
    url: `/user_badges/${encodeURIComponent(id)}/toggle_favorite`,
    method: "PUT",
  };
}
