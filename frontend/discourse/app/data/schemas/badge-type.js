import { withDefaults } from "@warp-drive/core/reactive";

export const BadgeTypeSchema = withDefaults({
  type: "badge-type",
  fields: [
    { kind: "field", name: "name" },
    { kind: "field", name: "sort_order" },
  ],
});
