import { withDefaults } from "@warp-drive/core/reactive";

// TopicDetails is a sub-resource owned by a Topic. Its identity is the
// parent topic's id (one details per topic), and it ships embedded in the
// topic show payload rather than being fetched on its own.
//
// `created_by`, `last_poster`, `participants`, `links` are modeled as plain
// fields (opaque objects) rather than relationships. They're read with
// scattered `.id` / `.username`-shape access; cache-resolving them isn't
// worth the normalization cost for the POC.
//
// `allowed_users` and `allowed_groups` are real hasMany relationships —
// exercised by removeAllowedUser / removeAllowedGroup.
export const TopicDetailsSchema = withDefaults({
  type: "topic-details",
  fields: [
    { kind: "field", name: "can_edit" },
    { kind: "field", name: "can_move_posts" },
    { kind: "field", name: "can_delete" },
    { kind: "field", name: "can_permanently_delete" },
    { kind: "field", name: "can_recover" },
    { kind: "field", name: "can_remove_allowed_users" },
    { kind: "field", name: "can_invite_to" },
    { kind: "field", name: "can_invite_via_email" },
    { kind: "field", name: "can_create_post" },
    { kind: "field", name: "can_reply_as_new_topic" },
    { kind: "field", name: "can_flag_topic" },
    { kind: "field", name: "can_convert_topic" },
    { kind: "field", name: "can_review_topic" },
    { kind: "field", name: "can_edit_tags" },
    { kind: "field", name: "can_publish_page" },
    { kind: "field", name: "can_close_topic" },
    { kind: "field", name: "can_archive_topic" },
    { kind: "field", name: "can_split_merge_topic" },
    { kind: "field", name: "can_edit_staff_notes" },
    { kind: "field", name: "can_toggle_topic_visibility" },
    { kind: "field", name: "can_pin_unpin_topic" },
    { kind: "field", name: "can_banner_topic" },
    { kind: "field", name: "can_moderate_category" },
    { kind: "field", name: "can_remove_self_id" },
    { kind: "field", name: "notification_level" },
    { kind: "field", name: "notifications_reason_id" },
    { kind: "field", name: "created_by" },
    { kind: "field", name: "last_poster" },
    { kind: "field", name: "participants" },
    { kind: "field", name: "links" },
    {
      kind: "hasMany",
      name: "allowed_users",
      type: "user",
      options: { async: false, inverse: null },
    },
    {
      kind: "hasMany",
      name: "allowed_groups",
      type: "group",
      options: { async: false, inverse: null },
    },
  ],
});
