import { withDefaults } from "@warp-drive/core/reactive";

// Minimal user resource — covers what UserBadge payloads (BasicUserSerializer
// + UserPrimaryGroupMixin + a couple of extras) sideload. The schema will
// grow as the full `User` model migrates.
export const UserSchema = withDefaults({
  type: "user",
  fields: [
    { kind: "field", name: "username" },
    { kind: "field", name: "name" },
    { kind: "field", name: "avatar_template" },
    { kind: "field", name: "moderator" },
    { kind: "field", name: "admin" },
    { kind: "field", name: "primary_group_name" },
    { kind: "field", name: "title" },
  ],
});
