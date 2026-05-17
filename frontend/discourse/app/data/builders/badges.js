import {
  buildQuery,
  createOne,
  deleteOne,
  readMany,
  readOne,
  updateOne,
} from "discourse/data/builders/helpers";
import { normalizeBadgesPayload } from "discourse/data/normalize";

export function findBadges(opts = {}) {
  const query = buildQuery({ only_listable: opts.onlyListable ? "true" : null });
  return readMany(`/badges.json${query}`, normalizeBadgesPayload);
}

export function findBadge(id) {
  return readOne(
    `/badges/${encodeURIComponent(id)}`,
    normalizeBadgesPayload
  );
}

export function saveBadge(badge, data) {
  if (badge.id != null) {
    return updateOne(
      "badge",
      badge.id,
      `/admin/badges/${encodeURIComponent(badge.id)}`,
      data,
      normalizeBadgesPayload
    );
  }
  return createOne(`/admin/badges`, data, normalizeBadgesPayload);
}

export function deleteBadge(id) {
  return deleteOne("badge", id, `/admin/badges/${encodeURIComponent(id)}`);
}
