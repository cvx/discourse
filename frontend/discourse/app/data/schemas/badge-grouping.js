import { withDefaults } from "@warp-drive/legacy/model/migration-support";
import { attrs } from "./helpers";

export const BadgeGroupingSchema = withDefaults({
  type: "badge-grouping",
  fields: [
    ...attrs(
      "name",
      "description",
      "position",
      "system",
      // i18n-aware display name. Pre-computed at normalize time because the
      // server doesn't ship it; preserves the legacy `BadgeGrouping#displayName`
      // surface that templates read.
      "displayName"
    ),
  ],
});
