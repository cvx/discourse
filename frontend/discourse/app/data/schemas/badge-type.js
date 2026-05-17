import { withDefaults } from "@warp-drive/legacy/model/migration-support";

export const BadgeTypeSchema = withDefaults({
  type: "badge-type",
  fields: [
    { kind: "attribute", name: "name" },
    { kind: "attribute", name: "sort_order" },
  ],
});
