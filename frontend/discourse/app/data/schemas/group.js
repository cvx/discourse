import { withDefaults } from "@warp-drive/core/reactive";

// Minimal group resource — covers what BasicGroupSerializer ships for
// `allowed_groups` on a TopicDetails. Will grow as Group migrates.
export const GroupSchema = withDefaults({
  type: "group",
  fields: [
    { kind: "field", name: "name" },
    { kind: "field", name: "display_name" },
    { kind: "field", name: "flair_url" },
    { kind: "field", name: "flair_color" },
    { kind: "field", name: "flair_bg_color" },
  ],
});
