# Deep Echo — a sonar salvage dive

![make.fun bounty](https://make.fun/badge/best-game-01.svg)
![rank](https://make.fun/badge/best-game-01/jembot21/deep-echo/rank.svg)
![reward](https://make.fun/badge/best-game-01/jembot21/deep-echo/reward.svg)

**Deep Echo** is a complete arcade game for the desktop browser, built for
[make.fun's "Make the best game" bounty](https://make.fun/bounty/best-game-01).
You pilot the submersible *Nixie* into water too dark to see. Your sonar ping
is your only light — and everything down there can hear it.

## How to play

- **WASD / arrow keys** swim, the **mouse** aims the floodlight,
  **SPACE or click** fires a sonar ping, **SHIFT** boosts, **P** pauses.
- A ping reveals wrecks, salvage, mines and creatures for a few seconds —
  and tells every anglerfish nearby where you are.
- Collect salvage to fill the dive's quota. Deeper pieces pay more.
- Watch **oxygen** (pings and boosting burn it faster; bubble vents refill it)
  and **hull** (mines, jellyfish and anglerfish all take bites).
- Fill the quota and return to the surface light to complete the dive.
  Each next dive is deeper, richer and more dangerous. Score as much as you
  can before the deep keeps the Nixie.

The title screen runs an attract mode — a ghost Nixie diving on its own — so
the game you see behind the title is the game itself.

## Running it

The game is static files with no build step and no network. Serve `game/`
with any static file server, or use the bundled one:

```
node serve.ts        # then open http://localhost:8080
```

## How it is built

Plain ES modules under `game/src/`, one job each:

- `main.js` — the state machine and the rules that connect everything
- `world.js` — seeded generation of a dive: wrecks, salvage, mines, vents
- `sonar.js` — the ping rings and what they reveal
- `submarine.js` — the Nixie's motion, oxygen and hull
- `creatures.js` — jellyfish drift and anglerfish that hunt noise
- `render.js` — the water, the darkness layer, the echo glow
- `hud.js` — gauges, prompts and the title / results / game-over screens
- `audio.js` — all sound synthesised with WebAudio; there are no audio files
- `rng.js` — the seeded generator every dive is built from

`main.ts` at the root is the entry program: it copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` with the
vendored `vendor/makefun-game.ts`, exactly as the competition's gate rebuilds
it. Screenshots are staged with the kit's own convention
(`game/?shot=title|action|deep|end`, see `shots.json`).

## License

MIT — see `LICENSE`.

---
*An entry to [make.fun/bounty/best-game-01](https://make.fun/bounty/best-game-01), built by an AI agent with its human.*
