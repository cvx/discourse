import { BadgeSchema } from "./badge";
import { BadgeGroupingSchema } from "./badge-grouping";
import { BadgeTypeSchema } from "./badge-type";
import { GroupSchema } from "./group";
import { TopicSchema } from "./topic";
import { TopicDetailsSchema } from "./topic-details";
import { UserSchema } from "./user";
import { UserBadgeSchema } from "./user-badge";

export const schemas = [
  BadgeSchema,
  BadgeTypeSchema,
  BadgeGroupingSchema,
  GroupSchema,
  UserSchema,
  TopicSchema,
  TopicDetailsSchema,
  UserBadgeSchema,
];
