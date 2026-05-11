import { normalizeBadgesPayload } from "discourse/data/normalize";

export function findBadges(opts = {}) {
  const params = opts.onlyListable ? "?only_listable=true" : "";
  return {
    url: `/badges.json${params}`,
    method: "GET",
    op: "query",
    normalize: normalizeBadgesPayload,
  };
}

export function findBadge(id) {
  return {
    url: `/badges/${encodeURIComponent(id)}.json`,
    method: "GET",
    op: "findRecord",
    normalize: normalizeBadgesPayload,
  };
}

export function saveBadge(badge, data) {
  if (badge.id != null) {
    return {
      url: `/admin/badges/${badge.id}.json`,
      method: "PUT",
      body: data,
      op: "updateRecord",
      normalize: normalizeBadgesPayload,
    };
  }
  return {
    url: `/admin/badges.json`,
    method: "POST",
    body: data,
    op: "createRecord",
    normalize: normalizeBadgesPayload,
  };
}

export function deleteBadge(id) {
  return {
    url: `/admin/badges/${id}.json`,
    method: "DELETE",
    op: "deleteRecord",
    data: { type: "badge", id: String(id) },
  };
}
