import { withDefaults } from "@warp-drive/legacy/model/migration-support";
import { attrs } from "./helpers";

// TopicDetails is a sub-resource owned by a Topic. Its identity is the
// parent topic's id (one details per topic), and it ships embedded in the
// topic show payload rather than being fetched on its own.
//
// `created_by`, `last_poster`, `participants`, `links`, `allowed_users`, and
// `allowed_groups` are modeled as plain attributes (opaque arrays / objects)
// rather than relationships. Their related models aren't migrated yet, so
// LegacyMode would throw on unknown fields read from cached records.
// Templates iterating these expect plain objects with `username` / `name`,
// which the raw sideload payload already provides.
export const TopicDetailsSchema = withDefaults({
  type: "topic-details",
  fields: [
    ...attrs(
      "can_edit",
      "can_move_posts",
      "can_delete",
      "can_permanently_delete",
      "can_recover",
      "can_remove_allowed_users",
      "can_invite_to",
      "can_invite_via_email",
      "can_create_post",
      "can_reply_as_new_topic",
      "can_flag_topic",
      "can_convert_topic",
      "can_review_topic",
      "can_edit_tags",
      "can_publish_page",
      "can_close_topic",
      "can_archive_topic",
      "can_split_merge_topic",
      "can_edit_staff_notes",
      "can_toggle_topic_visibility",
      "can_pin_unpin_topic",
      "can_banner_topic",
      "can_moderate_category",
      "can_remove_self_id",
      "notification_level",
      "notifications_reason_id",
      "created_by",
      "last_poster",
      "participants",
      "links",
      "allowed_users",
      "allowed_groups"
    ),
  ],
});
