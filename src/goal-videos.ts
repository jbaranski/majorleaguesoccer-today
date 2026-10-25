/** Which team scored a goal. */
export type Side = 'home' | 'away';

/** Identifiers MLS uses for a team in video titles and slugs. */
export interface VideoTeam {
  readonly code: string;
  readonly name: string;
  readonly shortName: string;
}

export interface BrightcoveItem {
  readonly slug: string;
  readonly thumbnail?: {
    readonly title?: string;
  };
}

/** A goal clip. `side` is the scoring side, or undefined when the clip names no recognisable opponent. */
export interface GoalVideo {
  readonly url: string;
  readonly minute: string;
  readonly side?: Side;
}

const MAX_MINUTE_DIFF = 5;

// The part of a slug after "-vs-", minus the "-x1234" suffix MLS adds to some slugs:
// "goal-l-messi-vs-phi-26-x5096" -> "phi-26"
const afterVs = (slug: string): string => {
  const vsIdx = slug.indexOf('-vs-');
  if (vsIdx === -1) return '';
  return slug.slice(vsIdx + 4).replace(/-x\d+$/, '');
};

// "D.C. United" / "d-c-united" / "DC" -> "dcunited" / "dcunited" / "dc"; "Montréal" -> "montreal"
const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Title: "Goal: T. Barlow vs. D.C. United, 52'" -> ["D.C. United", "D.C."]. Both the full phrase
// and its first token are tried, so "vs. MIN" and "vs. D.C. United" both resolve.
const opponentsFromTitle = (title: string): readonly string[] => {
  const m = /\bvs\.?\s+([^,]+)/i.exec(title);
  if (!m) return [];
  const phrase = m[1]!.trim();
  return [phrase, phrase.split(/\s+/)[0]!];
};

// Slug: "goal-e-da-silva-ferreira-vs-d-c-united-35" -> "d-c-united"; "goal-x-vs-orl-45-3" -> "orl"
const opponentFromSlug = (slug: string): string => afterVs(slug).replace(/(-\d+)+$/, '');

const teamKeys = (team: VideoTeam): readonly string[] =>
  [team.code, team.name, team.shortName].map(normalize).filter((k) => k.length > 0);

// A clip names the conceding team ("vs. Opponent"), so the scoring side is the other one.
const sideFromOpponents = (opponents: readonly string[], home: VideoTeam, away: VideoTeam): Side | undefined => {
  const homeKeys = teamKeys(home);
  const awayKeys = teamKeys(away);
  for (const opponent of opponents.map(normalize)) {
    if (!opponent) continue;
    const isHome = homeKeys.includes(opponent);
    const isAway = awayKeys.includes(opponent);
    if (isHome && !isAway) return 'away';
    if (isAway && !isHome) return 'home';
  }
  return undefined;
};

const minuteFromTitle = (title: string): string => (/,\s*(\d+(?:\+\d+)?)'/.exec(title) ?? [])[1] ?? '';

// Slug format: "goal-player-vs-team-45-1" (injury time) or "goal-player-vs-team-82"
// Take the trailing digits after -vs- (dedupe suffix already removed), converting
// hyphen-separated extra time back to "45+1" form.
const minuteFromSlug = (slug: string): string => {
  const m = /(\d+(?:-\d+)?)$/.exec(afterVs(slug));
  return m ? m[1]!.replace(/-(\d+)$/, '+$1') : '';
};

/** Picks the goal clips out of a match's Brightcove videos and works out each clip's minute and scoring side. */
export const parseGoalVideos = (
  items: readonly BrightcoveItem[],
  home: VideoTeam,
  away: VideoTeam
): readonly GoalVideo[] =>
  items
    .filter((item) => /^(pk |own )?goal:/i.test(item.thumbnail?.title ?? '') || /^(pk-|own-)?goal-/.test(item.slug))
    .map((item) => {
      const title = item.thumbnail?.title ?? '';
      // Titles aren't always "Goal: X vs. Y, 35'" (e.g. "REG26-Evander-Goal"), so fall back to the slug
      const side = sideFromOpponents([...opponentsFromTitle(title), opponentFromSlug(item.slug)], home, away);
      return {
        url: `https://www.mlssoccer.com/video/${item.slug}`,
        minute: minuteFromTitle(title) || minuteFromSlug(item.slug),
        ...(side && { side })
      } satisfies GoalVideo;
    });

const parseMinute = (m: string): number => {
  const plus = m.indexOf('+');
  if (plus === -1) return parseInt(m, 10);
  return parseInt(m.slice(0, plus), 10) + parseInt(m.slice(plus + 1), 10);
};

const minuteDiff = (a: string, b: string): number => Math.abs(parseMinute(a) - parseMinute(b));

/**
 * Finds the clip for a goal: the closest-minute clip (within 5 minutes) for the goal's side,
 * falling back to clips whose side is unknown.
 */
export const findGoalVideo = (videos: readonly GoalVideo[], side: Side, minute: string): GoalVideo | undefined => {
  const closest = (candidates: readonly GoalVideo[]): GoalVideo | undefined =>
    candidates
      .filter((v) => minuteDiff(v.minute, minute) <= MAX_MINUTE_DIFF)
      .reduce<GoalVideo | undefined>(
        (best, v) => (!best || minuteDiff(v.minute, minute) < minuteDiff(best.minute, minute) ? v : best),
        undefined
      );
  return closest(videos.filter((v) => v.side === side)) ?? closest(videos.filter((v) => v.side === undefined));
};
