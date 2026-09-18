// Tracks which first-time walkthroughs this browser TAB has already shown,
// so one plays once per mode per session and never nags again on a repeat
// play — but does resurface in a fresh tab/session. sessionStorage (not
// localStorage) is exactly that scope.
const KEY_PREFIX = 'party-game:walkthrough-seen:'

export function hasSeenWalkthrough(key) {
  try {
    return sessionStorage.getItem(KEY_PREFIX + key) === '1'
  } catch {
    // Storage blocked (private mode, etc.) — fail toward not nagging.
    return true
  }
}

export function markWalkthroughSeen(key) {
  try {
    sessionStorage.setItem(KEY_PREFIX + key, '1')
  } catch {
    // Nothing to do if storage isn't available — just won't persist.
  }
}
