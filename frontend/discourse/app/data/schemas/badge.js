import { withDefaults } from "@warp-drive/legacy/model/migration-support";

export const BadgeSchema = withDefaults({
  type: "badge",
  fields: [
    { kind: "attribute", name: "name" },
    { kind: "attribute", name: "description" },
    { kind: "attribute", name: "long_description" },
    { kind: "attribute", name: "slug" },
    { kind: "attribute", name: "icon" },
    { kind: "attribute", name: "image_url" },
    { kind: "attribute", name: "grant_count" },
    { kind: "attribute", name: "enabled" },
    { kind: "attribute", name: "listable" },
    { kind: "attribute", name: "show_in_post_header" },
    { kind: "attribute", name: "has_badge" },
    { kind: "attribute", name: "allow_title" },
    { kind: "attribute", name: "multiple_grant" },
    { kind: "attribute", name: "manually_grantable" },
    { kind: "attribute", name: "system" },
    // Admin-only attributes (AdminBadgeSerializer). Always declared so the
    // cache preserves them when an admin payload arrives.
    { kind: "attribute", name: "query" },
    { kind: "attribute", name: "trigger" },
    { kind: "attribute", name: "target_posts" },
    { kind: "attribute", name: "auto_revoke" },
    { kind: "attribute", name: "show_posts" },
    { kind: "attribute", name: "i18n_name" },
    { kind: "attribute", name: "image_upload_id" },
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
