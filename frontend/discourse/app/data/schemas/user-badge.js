import { withDefaults } from "@warp-drive/core/reactive";

export const UserBadgeSchema = withDefaults({
  type: "user-badge",
  fields: [
    { kind: "field", name: "granted_at" },
    { kind: "field", name: "created_at" },
    { kind: "field", name: "count" },
    { kind: "field", name: "post_id" },
    { kind: "field", name: "post_number" },
    { kind: "field", name: "grouping_position" },
    { kind: "field", name: "topic_id" },
    { kind: "field", name: "topic_title" },
    { kind: "field", name: "is_favorite" },
    { kind: "field", name: "can_favorite" },
    {
      kind: "belongsTo",
      name: "badge",
      type: "badge",
      options: { async: false, inverse: null },
    },
    {
      kind: "belongsTo",
      name: "user",
      type: "user",
      options: { async: false, inverse: null },
    },
    {
      kind: "belongsTo",
      name: "granted_by",
      type: "user",
      options: { async: false, inverse: null },
    },
    {
      kind: "belongsTo",
      name: "topic",
      type: "topic",
      options: { async: false, inverse: null },
    },
  ],
});
