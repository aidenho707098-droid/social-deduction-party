// One press per tap, for every module button. Pointer events only (no
// onClick, no touch handlers), so a tap can never fire twice (touchstart +
// click) and a fast double tap on the same button is two presses, not a
// double-tap zoom (the CSS sets touch-action: manipulation). A press fires
// on pointerup over the button that saw the pointerdown; a scroll gesture
// (pointercancel) or sliding off first cancels it. Enter / Space press it
// from the keyboard.
export function tapProps(onPress) {
  return {
    onPointerDown(e) {
      if (e.button !== 0) return
      e.currentTarget.dataset.tapId = String(e.pointerId)
    },
    onPointerUp(e) {
      const el = e.currentTarget
      if (el.dataset.tapId !== String(e.pointerId)) return
      delete el.dataset.tapId
      const r = el.getBoundingClientRect()
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return
      if (!el.disabled) onPress()
    },
    onPointerCancel(e) {
      delete e.currentTarget.dataset.tapId
    },
    onKeyDown(e) {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault()
        onPress()
      }
    },
  }
}
