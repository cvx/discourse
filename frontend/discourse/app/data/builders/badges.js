import { normalizeBadgesPayload } from "discourse/data/normalize";

export function findBadges(opts = {}) {
  const params = opts.onlyListable ? "?only_listable=true" : "";
  return {
    url: `/badges.json${params}`,
    method: "GET",
    op: "query",
    options: { normalize: normalizeBadgesPayload },
  };
}

export function findBadge(id) {
  return {
    url: `/badges/${encodeURIComponent(id)}`,
    method: "GET",
    op: "findRecord",
    options: { normalize: normalizeBadgesPayload },
  };
}

export function saveBadge(badge, data) {
  if (badge.id != null) {
    return {
      url: `/admin/badges/${badge.id}`,
      method: "PUT",
      op: "updateRecord",
      data: { type: "badge", id: String(badge.id) },
      options: { body: data, normalize: normalizeBadgesPayload },
    };
  }
  return {
    url: `/admin/badges`,
    method: "POST",
    op: "createRecord",
    options: { body: data, normalize: normalizeBadgesPayload },
  };
}

export function deleteBadge(id) {
  return {
    url: `/admin/badges/${id}`,
    method: "DELETE",
    op: "deleteRecord",
    data: { type: "badge", id: String(id) },
  };
}
