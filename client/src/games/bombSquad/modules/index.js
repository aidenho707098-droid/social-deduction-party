// The Defuser-side half of each module plug-in (the server half lives in
// server/games/bombSquad/modules/). Adding a module = its UI here, one line
// below. Every UI gets { view, interactive, onAct(action) }.
import ButtonModule from './ButtonModule'
import Maze from './Maze'
import Memory from './Memory'
import Simon from './Simon'
import Switches from './Switches'
import Symbols from './Symbols'
import Wires from './Wires'

export const MODULE_UI = {
  wires: Wires,
  symbols: Symbols,
  button: ButtonModule,
  memory: Memory,
  switches: Switches,
  maze: Maze,
  simon: Simon,
}
