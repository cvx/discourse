import { withDefaults } from "@warp-drive/core/reactive";

export const BadgeGroupingSchema = withDefaults({
  type: "badge-grouping",
  fields: [
    { kind: "field", name: "name" },
    { kind: "field", name: "description" },
    { kind: "field", name: "position" },
    { kind: "field", name: "system" },
  ],
});
