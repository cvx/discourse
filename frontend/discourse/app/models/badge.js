import {
  deleteBadge,
  findBadge,
  findBadges,
  saveBadge,
} from "discourse/data/builders/badges";
import { normalizeBadgesPayload } from "discourse/data/normalize";
import WarpRestModel, {
  defineFieldForwarders,
} from "discourse/data/reactive-base";
import { BadgeSchema } from "discourse/data/schemas/badge";
import getURL from "discourse/lib/get-url";

export default class Badge extends WarpRestModel {
  static type = "badge";
  static normalize = normalizeBadgesPayload;
  static builders = {
    list: findBadges,
    one: findBadge,
    save: saveBadge,
    delete: deleteBadge,
  };

  // For cached records, the relation comes back through the belongsTo on the
  // ReactiveResource (`badge_type.id`). For drafts created via `Badge.create`
  // the attrs bag holds `badge_type_id` directly. Support both.
  get badge_type_id() {
    return this.__resource.badge_type_id ?? this.__resource.badge_type?.id;
  }

  get badge_grouping_id() {
    return (
      this.__resource.badge_grouping_id ?? this.__resource.badge_grouping?.id
    );
  }

  // The `icon-or-image` helper reads `badge.image` and prefers it over `icon`
  // when present. Preserved as a read-only alias for `image_url`.
  get image() {
    return this.image_url;
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
