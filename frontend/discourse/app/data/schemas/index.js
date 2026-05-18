import { BadgeSchema } from "./badge";
import { BadgeGroupingSchema } from "./badge-grouping";
import { BadgeTypeSchema } from "./badge-type";
import { BookmarkSchema } from "./bookmark";
import { TopicDetailsSchema } from "./topic-details";
import { UserBadgeSchema } from "./user-badge";

/** @type {import("@warp-drive/core/types/schema/fields").LegacyResourceSchema[]} */
export const schemas = [
  BadgeSchema,
  BadgeTypeSchema,
  BadgeGroupingSchema,
  BookmarkSchema,
  TopicDetailsSchema,
  UserBadgeSchema,
];
