import { findBadge, findBadges } from "discourse/data/builders/badges";
import { normalizeBadgesPayload } from "discourse/data/normalize";
import WarpRestModel, {
  defineFieldForwarders,
} from "discourse/data/reactive-base";
import { BadgeSchema } from "discourse/data/schemas/badge";
import getURL from "discourse/lib/get-url";

export default class Badge extends WarpRestModel {
  static type = "badge";
  static normalize = normalizeBadgesPayload;
  static builders = { list: findBadges, one: findBadge };

  get badge_type_id() {
    return this.__resource.badge_type?.id;
  }

  get badge_grouping_id() {
    return this.__resource.badge_grouping?.id;
  }

  get url() {
    return getURL(`/badges/${this.id}/${this.slug}`);
  }

  get newBadge() {
    return this.id == null;
  }

  get badgeTypeClassName() {
    const type = this.badge_type?.name || "";
    return `badge-type-${type.toLowerCase()}`;
  }
}

defineFieldForwarders(Badge, BadgeSchema);
