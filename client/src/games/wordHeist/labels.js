import { WALKTHROUGHS } from '../../walkthrough/content'

// Header labels shared by the set / solve / reveal screens.

// "Step 2 of 3", inline. The solve screen hides the fixed corner badge (it
// needs every pixel at 320x568) and shows this in its header instead.
export function stepLabel(phase) {
  const w = WALKTHROUGHS['word-heist']
  const i = w?.phaseSteps[phase]
  return i == null ? null : `Step ${i + 1} of ${w.steps.length}`
}

export function roundLabel(game) {
  return `Round ${game.roundIndex + 1} of ${game.totalRounds}`
}
