import { findBadge, findBadges } from "discourse/data/builders/badges";
import { normalizeBadgesPayload } from "discourse/data/normalize";
import WarpRestModel from "discourse/data/reactive-base";
import getURL from "discourse/lib/get-url";

export default class Badge extends WarpRestModel {
  static type = "badge";
  static normalize = normalizeBadgesPayload;
  static builders = { list: findBadges, one: findBadge };

  // --- Field forwarders (mirror BadgeSerializer)

  get id() {
    return this.__resource.id;
  }
  get name() {
    return this.__resource.name;
  }
  get description() {
    return this.__resource.description;
  }
  get long_description() {
    return this.__resource.long_description;
  }
  get slug() {
    return this.__resource.slug;
  }
  get icon() {
    return this.__resource.icon;
  }
  get image_url() {
    return this.__resource.image_url;
  }
  get grant_count() {
    return this.__resource.grant_count;
  }
  get enabled() {
    return this.__resource.enabled;
  }
  get listable() {
    return this.__resource.listable;
  }
  get show_in_post_header() {
    return this.__resource.show_in_post_header;
  }
  get has_badge() {
    return this.__resource.has_badge;
  }
  get allow_title() {
    return this.__resource.allow_title;
  }
  get multiple_grant() {
    return this.__resource.multiple_grant;
  }
  get manually_grantable() {
    return this.__resource.manually_grantable;
  }
  get system() {
    return this.__resource.system;
  }
  get badge_type() {
    return this.__resource.badge_type;
  }
  get badge_grouping() {
    return this.__resource.badge_grouping;
  }
  get badge_type_id() {
    return this.__resource.badge_type?.id;
  }
  get badge_grouping_id() {
    return this.__resource.badge_grouping?.id;
  }

  // --- Computed getters preserved from the previous model

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
