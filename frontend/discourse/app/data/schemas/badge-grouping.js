import { withDefaults } from "@warp-drive/legacy/model/migration-support";

export const BadgeGroupingSchema = withDefaults({
  type: "badge-grouping",
  fields: [
    { kind: "attribute", name: "name" },
    { kind: "attribute", name: "description" },
    { kind: "attribute", name: "position" },
    { kind: "attribute", name: "system" },
    // i18n-aware display name. Pre-computed at normalize time because the
    // server doesn't ship it; preserves the legacy `BadgeGrouping#displayName`
    // surface that templates read.
    { kind: "attribute", name: "displayName" },
  ],
});
