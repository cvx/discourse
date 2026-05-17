import {
  buildQuery,
  createOne,
  deleteOne,
  readMany,
} from "discourse/data/builders/helpers";
import { normalizeUserBadgesPayload } from "discourse/data/normalize";

// Note: `/user-badges/:username` (dashed) is a distinct Rails route from
// `/user_badges` (underscored) — not a typo. The dashed endpoint lists a
// user's badges by username; the underscored endpoints are the CRUD ones.

export function findUserBadgesByUsername(username, opts = {}) {
  const query = buildQuery({ grouped: opts.grouped ? "true" : null });
  return readMany(
    `/user-badges/${encodeURIComponent(username)}.json${query}`,
    normalizeUserBadgesPayload
  );
}

export function findUserBadgesByBadgeId(badgeId, opts = {}) {
  const query = buildQuery({
    badge_id: badgeId,
    offset: opts.offset,
    username: opts.username,
  });
  return readMany(`/user_badges.json${query}`, normalizeUserBadgesPayload);
}

export function grantUserBadge(badgeId, username, reason) {
  return createOne(
    `/user_badges`,
    { username, badge_id: badgeId, reason },
    normalizeUserBadgesPayload
  );
}

export function deleteUserBadge(id) {
  return deleteOne("user-badge", id, `/user_badges/${encodeURIComponent(id)}`);
}

// RPC-style: no `op` / `data` — this isn't a CRUD operation, and there's no
// response body that should pass through normalization.
export function toggleFavoriteUserBadge(id) {
  return {
    url: `/user_badges/${encodeURIComponent(id)}/toggle_favorite`,
    method: "PUT",
  };
}
