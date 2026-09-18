import { WALKTHROUGHS } from './content'

// Small persistent "Step X of Y" indicator for the same modes that get a
// first-time walkthrough — a lightweight reminder of where the current
// phase sits in the round's flow, without needing to re-read the rules.
export default function StepBadge({ walkthroughKey, phase }) {
  const content = walkthroughKey && WALKTHROUGHS[walkthroughKey]
  if (!content) return null

  const idx = content.phaseSteps[phase]
  if (idx == null) return null

  const total = content.steps.length
  return (
    <div className="wt-badge" title={content.steps[idx].title}>
      Step {idx + 1} of {total}
    </div>
  )
}
