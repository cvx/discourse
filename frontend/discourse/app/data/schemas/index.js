import { BadgeSchema } from "./badge";
import { BadgeGroupingSchema } from "./badge-grouping";
import { BadgeTypeSchema } from "./badge-type";
import { TopicSchema } from "./topic";
import { UserSchema } from "./user";
import { UserBadgeSchema } from "./user-badge";

export const schemas = [
  BadgeSchema,
  BadgeTypeSchema,
  BadgeGroupingSchema,
  UserSchema,
  TopicSchema,
  UserBadgeSchema,
];
