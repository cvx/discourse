import { attrs, belongsTo, withDefaults } from "./helpers";

// `badge` is a real belongsTo so cached Badge records (with their wrapper
// getters like `.url`, `.badgeTypeClassName`) are reachable through
// `userBadge.badge`. The user / granted_by / topic relations are stored as
// plain attributes (opaque payloads from the sideload) — those models aren't
// migrated yet and LegacyMode would otherwise throw on every unknown field
// read against a cached `user` / `topic` record.
/** @type {import("@warp-drive/core/types/schema/fields").LegacyResourceSchema} */
export const UserBadgeSchema = withDefaults({
  type: "user-badge",
  fields: [
    ...attrs(
      "granted_at",
      "created_at",
      "count",
      "post_id",
      "post_number",
      "grouping_position",
      "topic_id",
      "topic_title",
      "is_favorite",
      "can_favorite",
      "user",
      "granted_by",
      "topic"
    ),
    belongsTo("badge", "badge"),
  ],
});
