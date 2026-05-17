import { JSONAPICache } from "@warp-drive/json-api";
import { useLegacyStore } from "@warp-drive/legacy";
import discourseRestHandler from "discourse/data/handlers/discourse-rest";
import { schemas } from "discourse/data/schemas";

// `useLegacyStore` registers the legacy derivations and adds the
// LegacyMode ReactiveResource hooks for us. `linksMode: true` skips the
// LegacyNetworkHandler — our DiscourseRestHandler routes all requests
// through Discourse's `ajax()` helper.
export default class WarpStore extends useLegacyStore({
  cache: JSONAPICache,
  schemas,
  handlers: [discourseRestHandler],
  linksMode: true,
}) {}
