import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findGoalVideo, parseGoalVideos } from './goal-videos.ts';
import type { GoalVideo, VideoTeam } from './goal-videos.ts';

const DC: VideoTeam = { code: 'DC', name: 'D.C. United', shortName: 'D.C. United' };
const CIN: VideoTeam = { code: 'CIN', name: 'FC Cincinnati', shortName: 'Cincinnati' };
const ORL: VideoTeam = { code: 'ORL', name: 'Orlando City', shortName: 'Orlando' };
const MTL: VideoTeam = { code: 'MTL', name: 'CF Montréal', shortName: 'Montréal' };

// Real response for D.C. United 0-2 FC Cincinnati, 2026-10-24 (MLS-MAT-0009NQ)
const DC_CIN_ITEMS = [
  {
    slug: 'highlights-d-c-united-vs-fc-cincinnati-october-24-2026',
    thumbnail: { title: 'REG26-HIGHLIGHTS_DCvsCIN' }
  },
  { slug: 'match-snapshot-d-c-vs-cincinnati-x1127', thumbnail: { title: 'MATCH SNAPSHOT: D.C. vs. Cincinnati' } },
  { slug: 'goal-t-barlow-vs-d-c-united-52', thumbnail: { title: "Goal: T. Barlow vs. D.C. United, 52'" } },
  { slug: 'goal-e-da-silva-ferreira-vs-d-c-united-35', thumbnail: { title: 'REG26-Evander-Goal' } }
];

describe('parseGoalVideos', () => {
  it('keeps only goal clips and reads side and minute from the title or slug', () => {
    assert.deepEqual(parseGoalVideos(DC_CIN_ITEMS, DC, CIN), [
      { url: 'https://www.mlssoccer.com/video/goal-t-barlow-vs-d-c-united-52', minute: '52', side: 'away' },
      { url: 'https://www.mlssoccer.com/video/goal-e-da-silva-ferreira-vs-d-c-united-35', minute: '35', side: 'away' }
    ]);
  });

  it('reads the opponent code from a title', () => {
    const [video] = parseGoalVideos(
      [{ slug: 'goal-x-vs-orl-58', thumbnail: { title: "Goal: E. Da Silva Ferreira vs. ORL, 58'" } }],
      ORL,
      CIN
    );
    assert.equal(video?.side, 'away');
    assert.equal(video?.minute, '58');
  });

  it('strips an injury-time minute from the slug before reading the opponent', () => {
    const [video] = parseGoalVideos([{ slug: 'goal-e-da-silva-ferreira-vs-orl-45-3' }], ORL, CIN);
    assert.equal(video?.side, 'away');
    assert.equal(video?.minute, '45+3');
  });

  it('ignores the "-x1234" suffix on some slugs', () => {
    const PHI: VideoTeam = { code: 'PHI', name: 'Philadelphia Union', shortName: 'Philadelphia' };
    const [video] = parseGoalVideos([{ slug: 'goal-m-ojeda-vs-phi-90-x0058' }], PHI, ORL);
    assert.equal(video?.side, 'away');
    assert.equal(video?.minute, '90');
  });

  it('matches accented team names in slugs', () => {
    const [video] = parseGoalVideos([{ slug: 'goal-h-mukhtar-vs-cf-montreal-76' }], MTL, CIN);
    assert.equal(video?.side, 'away');
  });

  it('leaves side unknown when the opponent is not recognised', () => {
    const [video] = parseGoalVideos([{ slug: 'goal-someone-vs-xyz-10' }], DC, CIN);
    assert.deepEqual(video, { url: 'https://www.mlssoccer.com/video/goal-someone-vs-xyz-10', minute: '10' });
  });
});

describe('findGoalVideo', () => {
  const homeAt35: GoalVideo = { url: 'home-35', minute: '35', side: 'home' };
  const awayAt37: GoalVideo = { url: 'away-37', minute: '37', side: 'away' };
  const unknownAt36: GoalVideo = { url: 'unknown-36', minute: '36' };

  it('picks the closest clip on the same side', () => {
    assert.equal(findGoalVideo([homeAt35, awayAt37], 'away', '35'), awayAt37);
  });

  it('prefers a clip with a known side over a closer unknown one', () => {
    assert.equal(findGoalVideo([unknownAt36, awayAt37], 'away', '36'), awayAt37);
  });

  it('falls back to a clip with an unknown side', () => {
    assert.equal(findGoalVideo([homeAt35, unknownAt36], 'away', '36'), unknownAt36);
  });

  it('ignores clips more than 5 minutes away', () => {
    assert.equal(findGoalVideo([awayAt37], 'away', '30'), undefined);
  });

  it('handles injury-time minutes', () => {
    const at90plus4: GoalVideo = { url: 'away-90+4', minute: '90+4', side: 'away' };
    assert.equal(findGoalVideo([awayAt37, at90plus4], 'away', '90+6'), at90plus4);
  });
});
