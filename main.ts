// Deep Echo — entry program for make.fun's best-game-01 (Node 22, standard library only).
//
// The game itself is the static site under game/: plain files a desktop browser opens
// offline, no build step and no network. This program is only the courier. It copies
// game/ and screenshots/ from beside this file into the output directory and writes
// dossier.json there with buildDossier from the vendored make.fun library, byte for
// byte as the scorer rebuilds it. Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// MAKEFUN_OUTPUT_DIR stands in for /output outside the grader's container.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps below are the gate's own (screenshots: at most 4 files of at most 256 KiB;
// game/: at most 993 files, 48 MiB in all, no path over 1000 bytes; dossier text
// capped at 160 KiB). buildDossier refuses an entry the gate would refuse.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
