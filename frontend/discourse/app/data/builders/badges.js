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
