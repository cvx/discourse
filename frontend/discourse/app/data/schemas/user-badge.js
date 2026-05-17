import { withDefaults } from "@warp-drive/legacy/model/migration-support";

// `badge` is a real belongsTo so cached Badge records (with their wrapper
// getters like `.url`, `.badgeTypeClassName`) are reachable through
// `userBadge.badge`. The user / granted_by / topic relations are stored as
// plain attributes (opaque payloads from the sideload) — those models aren't
// migrated yet and LegacyMode would otherwise throw on every unknown field
// read against a cached `user` / `topic` record.
export const UserBadgeSchema = withDefaults({
  type: "user-badge",
  fields: [
    { kind: "attribute", name: "granted_at" },
    { kind: "attribute", name: "created_at" },
    { kind: "attribute", name: "count" },
    { kind: "attribute", name: "post_id" },
    { kind: "attribute", name: "post_number" },
    { kind: "attribute", name: "grouping_position" },
    { kind: "attribute", name: "topic_id" },
    { kind: "attribute", name: "topic_title" },
    { kind: "attribute", name: "is_favorite" },
    { kind: "attribute", name: "can_favorite" },
    { kind: "attribute", name: "user" },
    { kind: "attribute", name: "granted_by" },
    { kind: "attribute", name: "topic" },
    {
      kind: "belongsTo",
      name: "badge",
      type: "badge",
      options: { async: false, inverse: null },
    },
  ],
});
