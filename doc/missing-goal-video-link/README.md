# Missing goal video link (non-standard clip title)

**Status:** known issue, not fixed. The fix is described below. Apply it if this happens again.

## What happened

On 2026-10-25 the site showed D.C. United 0-2 FC Cincinnati (2026-10-24, `MLS-MAT-0009NQ`). Tom Barlow's 52' goal had a video link. Evander's 35' goal had none, even though MLS had published a clip for it.

The same pattern shows up in `client/public/matches.json` history. In each case one away goal had no link while every other goal in its match did:

| Date       | Match                        | Goal without a link                               |
| ---------- | ---------------------------- | ------------------------------------------------- |
| 2026-10-14 | MIN at COL                   | Loïc Williams 83' (away)                          |
| 2026-10-17 | TOR at RBNY                  | Justin Che 3' (away)                              |
| 2026-10-24 | CIN at DC (`MLS-MAT-0009NQ`) | Evander 35' (away)                                |
| 2026-11-07 | LA at RSL (`MLS-MAT-0009P6`) | Luc de Fougerolles 40' own goal (counts for away) |

The 11-07 own goal has the same cause. Its clip is titled `Own Goal: L. de Fougerolles, RSL, 40'`, with no "vs.", and its slug `own-goal-l-de-fougerolles-rsl-40` has no `-vs-`. So the side defaulted to home, but the goal counts for LA, the away side.

## Data

These responses were saved in this folder on 2026-11-14:

| File                                   | Contents                                                         |
| -------------------------------------- | ---------------------------------------------------------------- |
| `brightcovevideos-MLS-MAT-0009NQ.json` | Clips for DC vs CIN. Evander's is the `REG26-Evander-Goal` item. |
| `key_events-MLS-MAT-0009NQ.json`       | Match events for DC vs CIN (goals at 35' and 52')                |
| `match-MLS-MAT-0009NQ.json`            | Schedule entry for DC vs CIN: team names, short names, codes     |
| `brightcovevideos-MLS-MAT-0009P6.json` | Clips for RSL vs LA (the 11-07 own goal)                         |

The clips for `MLS-MAT-0009NQ`:

```json
{"slug":"highlights-d-c-united-vs-fc-cincinnati-october-24-2026","title":"REG26-HIGHLIGHTS_DCvsCIN"}
{"slug":"match-snapshot-d-c-vs-cincinnati-x1127","title":"MATCH SNAPSHOT: D.C. vs. Cincinnati"}
{"slug":"goal-t-barlow-vs-d-c-united-52","title":"Goal: T. Barlow vs. D.C. United, 52'"}
{"slug":"goal-e-da-silva-ferreira-vs-d-c-united-35","title":"REG26-Evander-Goal"}
```

These are the curls that fetched the saved files:

```sh
curl -s -H 'User-Agent: JEFF-Bot' 'https://dapi.mlssoccer.com/v2/content/en-us/brightcovevideos?fields.sportecMatchId=MLS-MAT-0009NQ' | jq . > brightcovevideos-MLS-MAT-0009NQ.json
curl -s -H 'User-Agent: JEFF-Bot' 'https://stats-api.mlssoccer.com/matches/MLS-MAT-0009NQ/key_events?per_page=1000' | jq . > key_events-MLS-MAT-0009NQ.json
curl -s -H 'User-Agent: JEFF-Bot' 'https://stats-api.mlssoccer.com/matches/seasons/MLS-SEA-0001KA?match_date%5Bgte%5D=2026-10-24&match_date%5Blte%5D=2026-10-24&per_page=1000' | jq '.schedule[] | select(.match_id == "MLS-MAT-0009NQ")' > match-MLS-MAT-0009NQ.json
curl -s -H 'User-Agent: JEFF-Bot' 'https://dapi.mlssoccer.com/v2/content/en-us/brightcovevideos?fields.sportecMatchId=MLS-MAT-0009P6' | jq . > brightcovevideos-MLS-MAT-0009P6.json
```

## Root cause

This is in `fetchGoalVideos` in `src/index.ts` (around lines 213-265). For each goal clip, the code reads the opponent ("vs. X") to work out which team scored.

1. Barlow's title `Goal: T. Barlow vs. D.C. United, 52'` gives `D.C.`, which becomes `DC`. That matches D.C.'s three-letter code, so the clip is an away goal. It links.
2. Evander's title `REG26-Evander-Goal` has no "vs.", so the code falls back to the slug. The slug names the opponent in full: `...-vs-d-c-united-35` becomes `DCUNITED`. That isn't `DC`.
3. `sideFromOpponent` returns `'home'` for any opponent it doesn't recognise (`return 'home';`, around line 239).
4. Matching in `generateJSON` (around line 308) needs the same side and a minute within 5. The clip is labelled home and the goal is away, so no link is built.

The result: when a clip has a non-standard title, a home goal can still be linked by luck, but an away goal never is.

The same slug fallback has two smaller bugs:

- **Stoppage-time minute.** Only the last number is stripped, so `goal-x-vs-orl-45-3` gives opponent `ORL45`.
- **Dedupe suffix.** In `goal-l-messi-vs-phi-26-x5096`, the `-x5096` suffix blocks the opponent, and `minuteFromSlug` reads the minute as `5096`.

## Potential fix

All four changes are in `src/index.ts`. A version of this fix was built and tested on 2026-10-25 but not merged.

**1. Pass team names into `fetchGoalVideos`.** Today it only gets the two three-letter codes. Also pass `home_team_name` / `away_team_name` and `home_team_short_name` / `away_team_short_name` (both are in the schedule data; add the short names to the `MLSMatch` interface).

**2. Match the opponent against code, full name and short name, ignoring accents and punctuation.** This is what makes `d-c-united` resolve to D.C.:

```ts
interface VideoTeam {
  readonly code: string;
  readonly name: string;
  readonly shortName: string;
}

// "D.C. United" / "d-c-united" -> "dcunited"; "Montréal" -> "montreal"
const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const teamKeys = (t: VideoTeam): readonly string[] =>
  [t.code, t.name, t.shortName].map(normalize).filter((k) => k.length > 0);

// A clip names the conceding team, so the scoring side is the other one.
// Returns undefined instead of guessing 'home' when the opponent isn't recognised.
const sideFromOpponents = (opponents: readonly string[], home: VideoTeam, away: VideoTeam): Side | undefined => {
  for (const opponent of opponents.map(normalize)) {
    if (!opponent) continue;
    const isHome = teamKeys(home).includes(opponent);
    const isAway = teamKeys(away).includes(opponent);
    if (isHome && !isAway) return 'away';
    if (isAway && !isHome) return 'home';
  }
  return undefined;
};
```

For the opponent candidates, try the title's text after "vs." up to the comma (`D.C. United`), that text's first word (`MIN`), and the slug's opponent. Read the slug's opponent like this:

```ts
// "goal-e-da-silva-ferreira-vs-d-c-united-35" -> "d-c-united"
// "goal-x-vs-orl-45-3" -> "orl"; "goal-l-messi-vs-phi-26-x5096" -> "phi"
const afterVs = (slug: string): string => {
  const i = slug.indexOf('-vs-');
  return i === -1 ? '' : slug.slice(i + 4).replace(/-x\d+$/, '');
};
const opponentFromSlug = (slug: string): string => afterVs(slug).replace(/(-\d+)+$/, '');
```

**3. Fix `minuteFromSlug`.** Have it run its existing regex on `afterVs(slug)`, so the `-x5096` suffix isn't read as the minute.

**4. Let unknown-side clips match by minute.** Make `GoalVideo.side` optional. In `generateJSON`, look for the closest clip (within 5 minutes) on the goal's side first. Only if there isn't one, fall back to clips whose side is unknown:

```ts
const video =
  closest(r.goalVideos.filter((v) => v.side === e.side)) ?? closest(r.goalVideos.filter((v) => v.side === undefined));
```

This also fixes the 11-07 own goal. Its clip names no opponent, so its side is unknown and it matches by minute.

**Tests:** cover the parsing with the example response above as the main case. Also include a stoppage-time slug (`goal-x-vs-orl-45-3`), a `-x1234` slug, an accented name (`cf-montreal`), and an unrecognised opponent (side stays undefined). `node:test` with Node 24's type stripping needs no new dependencies.

**What testing found last time:**

- Re-parsing the slugs of about 1,000 previously linked clips (slug only, no title) gave 0 wrong sides.
- About 1% came out unknown, mostly own-goal slugs with no `-vs-`. The minute fallback covers those.

**Known limitations:**

- **Wrong-goal risk.** An unknown-side clip could, in theory, attach to the other team's goal within 5 minutes.
- **NY name variants.** Variants such as "NYCFC" / "New York Red Bulls" don't match the API names. They come out as unknown, never as the wrong team.
