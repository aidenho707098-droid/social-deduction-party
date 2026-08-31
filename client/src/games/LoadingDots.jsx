// Three softly bobbing dots for the app's bare "getting ready" /
// "waiting" moments, so a screen with nothing else on it still feels
// alive. Motion is CSS (.loading-dots) and off under reduced-motion.
export default function LoadingDots() {
  return (
    <span className="loading-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}
