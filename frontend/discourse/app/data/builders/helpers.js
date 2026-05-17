// Shared scaffolding for per-resource builders. Each helper returns a
// request object in the shape the DiscourseRestHandler / WarpDrive
// RequestManager expects:
//
//   { url, method, op?, data?, options: { body?, normalize? } }
//
// The `op` and `data: { type, id }` fields let WarpDrive's CacheHandler
// associate the request with a cached record. RPC-style endpoints (toggle,
// notification update, remove-allowed-user) don't fit a CRUD operation and
// should be expressed as plain inline request objects — see `topic-details.js`.

// Serialize a flat params object into a URL query string, dropping
// null / undefined / empty entries and URL-encoding both keys and values.
// Returns "" (not "?") when there are no params.
export function buildQuery(params) {
  const entries = Object.entries(params).filter(
    ([, v]) => v != null && v !== ""
  );
  if (entries.length === 0) {
    return "";
  }
  return (
    "?" +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&")
  );
}

export function readMany(url, normalize) {
  return { url, method: "GET", op: "query", options: { normalize } };
}

export function readOne(url, normalize) {
  return { url, method: "GET", op: "findRecord", options: { normalize } };
}

export function createOne(url, body, normalize) {
  return {
    url,
    method: "POST",
    op: "createRecord",
    options: { body, normalize },
  };
}

export function updateOne(type, id, url, body, normalize) {
  return {
    url,
    method: "PUT",
    op: "updateRecord",
    data: { type, id: String(id) },
    options: { body, normalize },
  };
}

export function deleteOne(type, id, url) {
  return {
    url,
    method: "DELETE",
    op: "deleteRecord",
    data: { type, id: String(id) },
  };
}
