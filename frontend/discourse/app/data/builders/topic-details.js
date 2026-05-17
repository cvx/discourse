// RPC-style endpoints for topic-details — these don't fit a CRUD shape (no
// resource is being created / updated / deleted at a stable identity, and
// the responses aren't full normalized payloads), so they're expressed as
// plain inline request objects rather than using the `helpers.js` builders.

export function updateTopicNotificationLevel(topicId, level) {
  return {
    url: `/t/${encodeURIComponent(topicId)}/notifications`,
    method: "POST",
    options: { body: { notification_level: level } },
  };
}

export function removeAllowedTopicGroup(topicId, name) {
  return {
    url: `/t/${encodeURIComponent(topicId)}/remove-allowed-group`,
    method: "PUT",
    options: { body: { name } },
  };
}

export function removeAllowedTopicUser(topicId, username) {
  return {
    url: `/t/${encodeURIComponent(topicId)}/remove-allowed-user`,
    method: "PUT",
    options: { body: { username } },
  };
}
