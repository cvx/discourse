import { registerNormalizer } from "discourse/data/handlers/discourse-rest";
import { normalizeBadgesPayload } from "discourse/data/normalize";

registerNormalizer(
  ["badge", "badge-type", "badge-grouping"],
  normalizeBadgesPayload
);

export function findBadges(opts = {}) {
  const params = opts.onlyListable ? "?only_listable=true" : "";
  return {
    url: `/badges.json${params}`,
    method: "GET",
    op: "query",
    cacheOptions: { types: ["badge"] },
  };
}

export function findBadge(id) {
  return {
    url: `/badges/${encodeURIComponent(id)}.json`,
    method: "GET",
    op: "findRecord",
    cacheOptions: { types: ["badge"] },
  };
}
