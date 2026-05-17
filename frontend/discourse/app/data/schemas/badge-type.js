import { withDefaults } from "@warp-drive/legacy/model/migration-support";
import { attrs } from "./helpers";

export const BadgeTypeSchema = withDefaults({
  type: "badge-type",
  fields: [...attrs("name", "sort_order")],
});
