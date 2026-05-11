import { ajax } from "discourse/lib/ajax";

const discourseRestHandler = {
  async request(context, next) {
    const request = context.request;
    if (!request.normalize) {
      return next(request);
    }

    const ajaxOptions = { type: (request.method ?? "GET").toUpperCase() };
    if (request.body !== undefined && request.body !== null) {
      ajaxOptions.data = request.body;
    }

    const raw = await ajax(request.url, ajaxOptions);
    return { content: request.normalize(raw) };
  },
};

export default discourseRestHandler;
