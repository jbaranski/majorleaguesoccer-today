# Missing goal video link (non-standard clip title)

**Status:** known issue, not fixed. A tested fix exists in commit [`e9bc3cf`](https://github.com/jbaranski/majorleaguesoccer-today/commit/e9bc3cf8e71fa0269d3ec56cfce1abb73509851a). Apply it if this happens again.

## What happened

On 2026-10-25 the site showed D.C. United 0-2 FC Cincinnati (2026-10-24, `MLS-MAT-0009NQ`). Tom Barlow's 52' goal had a video link. Evander's 35' goal had none, even though MLS had published a clip for it.

The same pattern shows up in `client/public/matches.json` history. In each case one away goal had no link while every other goal in its match did:

| Date       | Match                        | Goal without a link                               |
| ---------- | ---------------------------- | ------------------------------------------------- |
| 2026-10-14 | MIN at COL                   | Loïc Williams 83' (away)                          |
| 2026-10-17 | TOR at RBNY                  | Justin Che 3' (away)                              |
| 2026-10-24 | CIN at DC (`MLS-MAT-0009NQ`) | Evander 35' (away)                                |
| 2026-11-07 | LA at RSL (`MLS-MAT-0009P6`) | Luc de Fougerolles 40' own goal (counts for away) |

The 11-07 own goal is probably the same cause but hasn't been confirmed against the API. MLS own-goal slugs have no `-vs-` (for example `own-goal-r-cannon-col-54`), so if the title has no "vs." either, the side defaults to home. Run the first command below with `MATCH_ID=MLS-MAT-0009P6` to confirm.

## Example response

The Brightcove videos response for `MLS-MAT-0009NQ`, filtered to slug and title:

```json
{ "slug": "highlights-d-c-united-vs-fc-cincinnati-october-24-2026", "t": "REG26-HIGHLIGHTS_DCvsCIN" }
{ "slug": "match-snapshot-d-c-vs-cincinnati-x1127", "t": "MATCH SNAPSHOT: D.C. vs. Cincinnati" }
{ "slug": "goal-t-barlow-vs-d-c-united-52", "t": "Goal: T. Barlow vs. D.C. United, 52'" }
{ "slug": "goal-e-da-silva-ferreira-vs-d-c-united-35", "t": "REG26-Evander-Goal" }
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

## Potential fix (commit `e9bc3cf`)

The fix was written and tested on 2026-10-25 and never merged. It still applies cleanly to `main` as of 2026-11-14.

- **Match team names.** The opponent from the title or slug is compared against each team's code, full name and short name. The comparison ignores accents and punctuation, so `d-c-united` resolves to D.C.
- **Strip suffixes.** The whole minute (`-45-3`) and the `-x1234` dedupe suffix are stripped from slugs.
- **Stop assuming home.** If the team still can't be worked out, the side is left unknown. Such a clip matches a goal by minute alone, after any same-side clips.
- **New module and tests.** Parsing and matching move into `src/goal-videos.ts`, with `node:test` tests in `src/goal-videos.test.ts`. The real response above is the main test case. `tsconfig.test.json` type-checks the tests. `npm test` runs them, and so does the scheduled workflow.

Checks:

- `tsc`, `npm test` (11 tests) and Prettier pass.
- A re-parse of the slugs of about 1,000 previously linked clips (slug only, no title) gave 0 wrong sides.
- A code review approved the fix.

Known limitations:

- **Wrong-goal risk.** A clip whose team is unknown could, in theory, attach to the other team's goal within 5 minutes.
- **NY name variants.** Variants such as "NYCFC" / "New York Red Bulls" aren't aliased. They come out as unknown, never as the wrong team.

Apply it:

```sh
git fetch origin e9bc3cf8e71fa0269d3ec56cfce1abb73509851a
git cherry-pick e9bc3cf8e71fa0269d3ec56cfce1abb73509851a
npm ci && npm test && npm run build
```

## Commands for checking it again

Replace the match ID with the affected match's ID. You can find it in `client/public/matches.json` under `yesterdayResults[].match.match_id`.

```sh
MATCH_ID=MLS-MAT-0009NQ

# Goal clips MLS published for the match (the data behind the video links)
curl -s -H 'User-Agent: JEFF-Bot' \
  "https://dapi.mlssoccer.com/v2/content/en-us/brightcovevideos?fields.sportecMatchId=$MATCH_ID" \
  | jq '.items[] | {slug, t: .thumbnail.title}'

# Goal events (scorer, minute, team) for the match
curl -s -H 'User-Agent: JEFF-Bot' \
  "https://stats-api.mlssoccer.com/matches/$MATCH_ID/key_events?per_page=1000" \
  | jq '.events[] | select(.sub_type == "goals" or .type == "own_goals")
        | {type, minute: .event.minute_of_play, team: .event.team_name,
           player: ((.event.shot_at_goal // .event) | "\(.player_first_name) \(.player_last_name)")}'

# Team names, short names and three-letter codes for the match (what side detection compares against)
curl -s -H 'User-Agent: JEFF-Bot' \
  "https://stats-api.mlssoccer.com/matches/seasons/MLS-SEA-0001KA?match_date%5Bgte%5D=2026-10-24&match_date%5Blte%5D=2026-10-24&per_page=1000" \
  | jq --arg id "$MATCH_ID" '.schedule[] | select(.match_id == $id)
        | {home_team_name, home_team_short_name, home_team_three_letter_code,
           away_team_name, away_team_short_name, away_team_three_letter_code}'
```

Goals without a link in the current `matches.json`:

```sh
jq -r '.yesterdayResults[] | .match as $m | .goalEvents[]
       | select(.isShootout | not) | select(.videoUrl == null)
       | "\($m.match_id)  \($m.home_team_name) vs \($m.away_team_name)  \(.minute)m \(.playerName) (\(.side))"' \
  client/public/matches.json
```

The same check across `matches.json` history (one line per run that had a goal without a link):

```sh
for c in $(git log --format=%h -- client/public/matches.json); do
  git show "$c:client/public/matches.json" | jq -r --arg c "$c" '
    .lastUpdated as $u
    | [.yesterdayResults[]? | .match as $m | .goalEvents[]
     | select((.isShootout | not) and .videoUrl == null)
     | "\($m.match_id) \(.minute)m \(.playerName) (\(.side))"]
    | select(length > 0) | "\($c) \($u) \(join(", "))"' 2>/dev/null
done
```

Note: a whole match with no links is usually a different case: MLS published no clips for it (Leagues Cup, friendlies and so on). The bug described here is a single goal without a link while the rest of its match has links.
