import { withDefaults } from "@warp-drive/legacy/model/migration-support";

// TopicDetails is a sub-resource owned by a Topic. Its identity is the
// parent topic's id (one details per topic), and it ships embedded in the
// topic show payload rather than being fetched on its own.
//
// `created_by`, `last_poster`, `participants`, `links` are modeled as plain
// attributes (opaque objects) rather than relationships. They're read with
// scattered `.id` / `.username`-shape access; cache-resolving them isn't
// worth the normalization cost for the POC.
//
// `allowed_users` and `allowed_groups` are real hasMany relationships —
// exercised by removeAllowedUser / removeAllowedGroup.
export const TopicDetailsSchema = withDefaults({
  type: "topic-details",
  fields: [
    { kind: "attribute", name: "can_edit" },
    { kind: "attribute", name: "can_move_posts" },
    { kind: "attribute", name: "can_delete" },
    { kind: "attribute", name: "can_permanently_delete" },
    { kind: "attribute", name: "can_recover" },
    { kind: "attribute", name: "can_remove_allowed_users" },
    { kind: "attribute", name: "can_invite_to" },
    { kind: "attribute", name: "can_invite_via_email" },
    { kind: "attribute", name: "can_create_post" },
    { kind: "attribute", name: "can_reply_as_new_topic" },
    { kind: "attribute", name: "can_flag_topic" },
    { kind: "attribute", name: "can_convert_topic" },
    { kind: "attribute", name: "can_review_topic" },
    { kind: "attribute", name: "can_edit_tags" },
    { kind: "attribute", name: "can_publish_page" },
    { kind: "attribute", name: "can_close_topic" },
    { kind: "attribute", name: "can_archive_topic" },
    { kind: "attribute", name: "can_split_merge_topic" },
    { kind: "attribute", name: "can_edit_staff_notes" },
    { kind: "attribute", name: "can_toggle_topic_visibility" },
    { kind: "attribute", name: "can_pin_unpin_topic" },
    { kind: "attribute", name: "can_banner_topic" },
    { kind: "attribute", name: "can_moderate_category" },
    { kind: "attribute", name: "can_remove_self_id" },
    { kind: "attribute", name: "notification_level" },
    { kind: "attribute", name: "notifications_reason_id" },
    { kind: "attribute", name: "created_by" },
    { kind: "attribute", name: "last_poster" },
    { kind: "attribute", name: "participants" },
    { kind: "attribute", name: "links" },
    // Stored as opaque arrays — user/group resources aren't migrated yet, so
    // LegacyMode would throw on unknown fields read from cached records.
    // Templates iterating these expect plain objects with `username` /
    // `name`, which the raw sideload payload already provides.
    { kind: "attribute", name: "allowed_users" },
    { kind: "attribute", name: "allowed_groups" },
  ],
});
