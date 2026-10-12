// Glue between Alphabet Soup's pure game state and the async category
// validator (server/categoryValidator.js). index.js calls pumpValidation()
// after every typed submit and on every ticker beat; it sends any answers
// not yet dispatched to the room's validator and folds each verdict back
// into the game as it arrives.
//
// A verdict only ever changes the AUTHOR's private view (the pending dot
// flipping to a check / cross), so the default reaction is to re-send that
// one player's private state; phase changes (checking -> review once the
// last verdict lands) are left to the ticker.
//
// Nothing here blocks: validation runs in the background while the player
// keeps typing their next answer.

import * as soup from "./games/alphabet-soup.js";
import { validatorFor } from "./categoryValidator.js";

// deps: {
//   getRoom(code) -> room | undefined   — to detect a room/game that's gone
//   onVerdict(room, playerId)           — re-send that player's private view
//   validatorOf?(room) -> validator     — injectable for tests
// }
export function pumpValidation(room, deps) {
  const game = room?.game;
  if (!game || game.id !== soup.id) return 0;
  const validatorOf = deps.validatorOf ?? validatorFor;

  const jobs = soup.takeValidationJobs(game);
  for (const job of jobs) {
    validatorOf(room)
      .validate(job)
      .then((verdict) => {
        // The room may have moved on (new game, back to lobby, deleted).
        if (deps.getRoom(room.code) !== room || room.game !== game) return;
        if (soup.recordValidation(game, job.token, verdict)) {
          deps.onVerdict(room, job.token.playerId);
          pumpValidation(room, deps); // a failure during "checking" re-queues its retry
        }
      })
      .catch((err) => console.warn("[alphabet-soup] validation error:", err));
  }
  return jobs.length;
}
