# Sound effects

All clips are from **Mixkit** (<https://mixkit.co/free-sound-effects/>) and
used under the [Mixkit Free License](https://mixkit.co/license/#sfxFree):
royalty-free for commercial and non-commercial use, no attribution
required. (Redistributing the raw files as a standalone sound library is
not allowed — bundling them inside this app is fine.)

| File | Mixkit sound | ID |
|------|--------------|----|
| `game-start.mp3` | Unlock game notification | 253 |
| `round-start.mp3` | Positive interface beep | 221 |
| `reveal.mp3` | Digital quick tone | 2866 |
| `correct.mp3` | Correct answer tone | 2870 |
| `wrong.mp3` | Funny fail low tone | 2876 |
| `confirm.mp3` | Cool interface click tone | 2568 |
| `player-join.mp3` | Message pop alert | 2354 |
| `wheel-spin.mp3` | Fast bike wheel spin | 1614 |
| `wheel-land.mp3` | Explainer video game reveal | 235 |
| `game-win.mp3` | Winning chimes | 2015 |
| `game-over.mp3` | Melodic game over | 956 |
| `grand-finale.mp3` | Achievement bell | 600 |

Each file was downloaded from
`https://assets.mixkit.co/active_storage/sfx/<ID>/<ID>-preview.mp3`.

## Replacing or adding a sound

1. Drop a new file in this folder.
2. Add/point a key at it in `client/src/sound/soundEngine.js`
   (`SOUND_MANIFEST`), tuning `gain` (0–1) so it sits level with the others.
3. Play it with `useSound().play('your-key')`, or — for a generic moment —
   map a game phase to it in `client/src/sound/useSoundDirector.js`.
