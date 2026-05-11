import { useRecommendedStore } from "@warp-drive/core";
import { JSONAPICache } from "@warp-drive/json-api";
import discourseRestHandler from "discourse/data/handlers/discourse-rest";
import { schemas } from "discourse/data/schemas";

export default class WarpStore extends useRecommendedStore({
  cache: JSONAPICache,
  schemas,
  handlers: [discourseRestHandler],
}) {}
