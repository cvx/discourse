import { withDefaults } from "@warp-drive/core/reactive";

// Minimal topic resource — fields BasicTopicSerializer ships when topics are
// sideloaded (e.g. inside UserBadge responses). Schema will expand as Topic
// migrates.
export const TopicSchema = withDefaults({
  type: "topic",
  fields: [
    { kind: "field", name: "title" },
    { kind: "field", name: "fancy_title" },
    { kind: "field", name: "slug" },
    { kind: "field", name: "posts_count" },
  ],
});
