import { withDefaults } from "@warp-drive/core/reactive";

export const BadgeSchema = withDefaults({
  type: "badge",
  fields: [
    { kind: "field", name: "name" },
    { kind: "field", name: "description" },
    { kind: "field", name: "long_description" },
    { kind: "field", name: "slug" },
    { kind: "field", name: "icon" },
    { kind: "field", name: "image_url" },
    { kind: "field", name: "grant_count" },
    { kind: "field", name: "enabled" },
    { kind: "field", name: "listable" },
    { kind: "field", name: "show_in_post_header" },
    { kind: "field", name: "has_badge" },
    { kind: "field", name: "allow_title" },
    { kind: "field", name: "multiple_grant" },
    { kind: "field", name: "manually_grantable" },
    { kind: "field", name: "system" },
    // Admin-only attributes (AdminBadgeSerializer). Always declared so the
    // cache preserves them when an admin payload arrives.
    { kind: "field", name: "query" },
    { kind: "field", name: "trigger" },
    { kind: "field", name: "target_posts" },
    { kind: "field", name: "auto_revoke" },
    { kind: "field", name: "show_posts" },
    { kind: "field", name: "i18n_name" },
    { kind: "field", name: "image_upload_id" },
    {
      kind: "belongsTo",
      name: "badge_type",
      type: "badge-type",
      options: { async: false, inverse: null },
    },
    {
      kind: "belongsTo",
      name: "badge_grouping",
      type: "badge-grouping",
      options: { async: false, inverse: null },
    },
  ],
});
