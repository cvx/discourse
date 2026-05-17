export function updateTopicNotificationLevel(topicId, level) {
  return {
    url: `/t/${encodeURIComponent(topicId)}/notifications`,
    method: "POST",
    body: { notification_level: level },
  };
}

export function removeAllowedTopicGroup(topicId, name) {
  return {
    url: `/t/${encodeURIComponent(topicId)}/remove-allowed-group`,
    method: "PUT",
    body: { name },
  };
}

export function removeAllowedTopicUser(topicId, username) {
  return {
    url: `/t/${encodeURIComponent(topicId)}/remove-allowed-user`,
    method: "PUT",
    body: { username },
  };
}
