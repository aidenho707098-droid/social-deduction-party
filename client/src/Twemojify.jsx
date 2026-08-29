import { useEffect } from 'react'
import twemoji from '@twemoji/api'

// Replace every native emoji glyph in the app with a Twemoji SVG <img>, so
// emoji render identically on every device instead of leaning on each OS's
// built-in emoji font (which is where the "some emoji look wrong on my
// phone" reports came from).
//
// Assets are served from jsDelivr; they're tiny and cache hard. The
// original `twemoji` package is deprecated with a dead default CDN — this
// uses the maintained `@twemoji/api` fork with an explicit `base`.
const OPTS = {
  folder: 'svg',
  ext: '.svg',
  base: 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/',
}

// Renders nothing. Parses #root once on mount, then re-parses (coalesced to
// one pass per frame) whenever the DOM changes, so emoji that show up on a
// later render or route change get converted too. React may swap a Twemoji
// <img> back to its text node when it re-reconciles that node's text — the
// observer catches that and re-parses, so it self-heals within a frame.
export default function Twemojify() {
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root || typeof MutationObserver === 'undefined') return undefined

    let raf = 0
    const observer = new MutationObserver(() => {
      if (!raf) raf = requestAnimationFrame(run)
    })

    function run() {
      raf = 0
      // Detach while we mutate — twemoji's own DOM edits would otherwise
      // retrigger the observer. Re-parsing already-converted content is a
      // no-op (it only touches raw text nodes), so this settles immediately.
      observer.disconnect()
      twemoji.parse(root, OPTS)
      observer.observe(root, { childList: true, subtree: true, characterData: true })
    }

    run()

    return () => {
      observer.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
