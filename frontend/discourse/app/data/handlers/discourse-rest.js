import { ajax } from "discourse/lib/ajax";

const NORMALIZERS = new Map();

export function registerNormalizer(types, fn) {
  for (const type of types) {
    NORMALIZERS.set(type, fn);
  }
}

function normalizerFor(request) {
  const types = request.cacheOptions?.types ?? [];
  for (const type of types) {
    const fn = NORMALIZERS.get(type);
    if (fn) {
      return fn;
    }
  }
  return null;
}

const discourseRestHandler = {
  async request(context, next) {
    const request = context.request;
    const normalize = normalizerFor(request);
    if (!normalize) {
      return next(request);
    }

    const url = request.url;
    const method = (request.method ?? "GET").toUpperCase();

    const ajaxOptions = { type: method };
    if (request.body !== undefined && request.body !== null) {
      ajaxOptions.data = request.body;
    }

    const raw = await ajax(url, ajaxOptions);
    return { content: normalize(raw) };
  },
};

export default discourseRestHandler;
