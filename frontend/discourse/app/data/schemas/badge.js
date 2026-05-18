import { attrs, belongsTo, withDefaults } from "./helpers";

/** @type {import("@warp-drive/core/types/schema/fields").LegacyResourceSchema} */
export const BadgeSchema = withDefaults({
  type: "badge",
  fields: [
    ...attrs(
      "name",
      "description",
      "long_description",
      "slug",
      "icon",
      "image_url",
      "grant_count",
      "enabled",
      "listable",
      "show_in_post_header",
      "has_badge",
      "allow_title",
      "multiple_grant",
      "manually_grantable",
      "system",
      // AdminBadgeSerializer-only — declared so the cache preserves them.
      "query",
      "trigger",
      "target_posts",
      "auto_revoke",
      "show_posts",
      "i18n_name",
      "image_upload_id"
    ),
    belongsTo("badge_type", "badge-type"),
    belongsTo("badge_grouping", "badge-grouping"),
  ],
});
