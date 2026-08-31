// After a shared round timer hits zero, the host's device waits this many
// seconds before telling the server to advance — a grace window so every
// other client's auto-submitted (typed / selected) answer lands first.
export const HOST_GRACE_SECONDS = 2
