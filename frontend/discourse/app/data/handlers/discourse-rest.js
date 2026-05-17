import { ajax } from "discourse/lib/ajax";

const discourseRestHandler = {
  async request(context, next) {
    const request = context.request;
    if (!request.url) {
      return next(request);
    }

    const ajaxOptions = { type: (request.method ?? "GET").toUpperCase() };
    const body = request.options?.body;
    if (body !== undefined && body !== null) {
      ajaxOptions.data = body;
    }

    const raw = await ajax(request.url, ajaxOptions);
    const normalize = request.options?.normalize;
    if (normalize) {
      return normalize(raw);
    }
    // For requests without a normalizer (delete, custom actions) there is no
    // meaningful resource document to push. `{ data: null }` keeps the cache
    // validator happy when the CacheHandler tries to ingest the response.
    return { data: null };
  },
};

export default discourseRestHandler;
