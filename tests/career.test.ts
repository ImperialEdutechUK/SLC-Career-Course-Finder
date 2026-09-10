import { describe, expect, it } from 'vitest';
import { applyC7, scoreCareerDirections } from '@/lib/career/engine';
import { CAREER_FAMILY_MATRIX, familyIds } from '@/lib/career/matrix';
import { CAREER_FAMILY_CONTENT, nextStepWording } from '@/lib/career/content';
import { requireQuestion } from '@/lib/questionnaire';

/**
 * The formula under test, from developer_handoff.md section 5:
 *   activity(f) = 0 when A is empty, otherwise 2 x SUM association(f,a) / |A|
 *   daily(f)    = 0 when D is empty, otherwise 1 x SUM compatibility(f,d) / |D|
 * Expected values below are calculated by hand from that definition.
 */

const score = (C2: string[], C4: string[] = [], C3: string[] = [], C8?: string) =>
  scoreCareerDirections({ C2, C3, C4, ...(C8 ? { C8 } : {}) });
const find = (result: ReturnType<typeof score>, id: string) =>
  result.ranked.find(item => item.familyId === id);

describe('activity to family matrix', () => {
  it('has ten families with editorial content and a subject mapping for each', () => {
    expect(familyIds()).toHaveLength(10);
    for (const id of familyIds()) {
      expect(CAREER_FAMILY_CONTENT[id], id).toBeDefined();
      expect(CAREER_FAMILY_CONTENT[id].label.length).toBeGreaterThan(0);
    }
  });

  it('only references configured C2, C3 and C4 answer ids', () => {
    const c2 = requireQuestion('career', 'C2').options.map(o => o.id);
    const c3 = requireQuestion('career', 'C3').options.map(o => o.id);
    const c4 = requireQuestion('career', 'C4').options.map(o => o.id);
    for (const family of CAREER_FAMILY_MATRIX) {
      for (const id of Object.keys(family.activities)) expect(c2, family.id).toContain(id);
      for (const id of Object.keys(family.values)) expect(c3, family.id).toContain(id);
      for (const id of Object.keys(family.daily)) expect(c4, family.id).toContain(id);
    }
  });

  it('every weight is one of the three reviewed tiers', () => {
    for (const family of CAREER_FAMILY_MATRIX) {
      for (const group of [family.activities, family.daily, family.values]) {
        for (const [id, weight] of Object.entries(group)) {
          expect([1, 0.6, 0.3], `${family.id}.${id}`).toContain(weight);
        }
      }
    }
  });

  it('never treats an unknown or breadth answer as an association', () => {
    for (const family of CAREER_FAMILY_MATRIX) {
      expect(Object.keys(family.activities)).not.toContain('unsure');
      expect(Object.keys(family.values)).not.toContain('unsure');
      expect(Object.keys(family.daily)).not.toContain('unsure');
      expect(Object.keys(family.daily)).not.toContain('mixed_activities');
    }
  });

  it('every family stays reachable: each has at least one central activity or two lesser ones', () => {
    for (const family of CAREER_FAMILY_MATRIX) {
      const weights = Object.values(family.activities);
      expect(weights.length, family.id).toBeGreaterThan(0);
      expect(Math.max(...weights), family.id).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('is not derived from the SLC catalogue: the score comes only from answers', () => {
    // creative_communication is thinly covered by the catalogue and still scores
    // the full two points, because nothing here reads the course data.
    expect(find(score(['create_ideas']), 'creative_communication')?.score).toBe(2);
  });
});

describe('normalised scoring', () => {
  it('a single activity central to a family scores the full two points', () => {
    expect(find(score(['support_people']), 'care_support')?.activity).toBe(2);
  });

  it('a second selection does not double a question contribution', () => {
    // education_development weights help_learning 1.0 and support_people 0.6.
    // One selection: 2 x 0.6 / 1. Two: 2 x 1.6 / 2. The divisor is what stops a
    // second answer inflating the question rather than sharpening it.
    expect(find(score(['support_people']), 'education_development')?.activity).toBeCloseTo(1.2);
    const two = score(['support_people', 'help_learning']);
    expect(find(two, 'education_development')?.activity).toBeCloseTo(1.6);
    // care_support weights support_people 1.0 and help_learning only 0.3, so the
    // second answer pulls its average down rather than adding to it.
    expect(find(two, 'care_support')?.activity).toBeCloseTo(1.3);
  });

  it('grades an association rather than treating every match as equal', () => {
    // The same answer must not put three families on an identical score, which is
    // what the 0/1 matrix did and why ordering fell to alphabetical tie-break.
    const result = score(['support_people']);
    const scores = ['care_support', 'education_development', 'active_personal_services']
      .map(id => find(result, id)!.activity);
    expect(new Set(scores).size).toBeGreaterThan(1);
    expect(scores[0]).toBeGreaterThan(scores[1]);
  });

  it('reads C8 as a fourth dimension, at the smallest share so it orders rather than decides', () => {
    const steady = score(['solve_problems'], ['hands_on'], [], 'prefer_steady');
    const keen = score(['solve_problems'], ['hands_on'], [], 'keen_change');
    // practical_technical is weighted prefer_steady 1.0 and keen_change 0.3, and
    // 1.0 is the best it can do, so steady is a perfect fit and keen is 0.3 of one.
    expect(find(steady, 'practical_technical')!.pace).toBeCloseTo(0.15);
    expect(find(keen, 'practical_technical')!.pace).toBeCloseTo(0.045);
    // Appetite must never outweigh what the learner wants to do. Digital weights
    // solve_problems as central; no C8 answer can pull practical above it on
    // activity alone.
    expect(find(keen, 'digital_technology')!.activity)
      .toBeGreaterThan(find(keen, 'practical_technical')!.activity);
  });

  it('scales the other dimensions by how strongly the activity was wanted', () => {
    // animals_nature is central to animals_environment and an edge link for
    // practical_technical. The day, values and pace answers all suit practical.
    const r = scoreCareerDirections({
      C2: ['animals_nature'], C4: ['focus_tasks'], C3: ['variety_challenge'], C8: 'prefer_steady'
    });
    const animals = find(r, 'animals_environment')!;
    const practical = find(r, 'practical_technical')!;
    // Practical earns more from preferences than animals does, and must still
    // rank below it, because preferences may sharpen a wanted direction but
    // never manufacture one the learner barely chose.
    expect(practical.daily + practical.values + practical.pace)
      .toBeGreaterThan(animals.daily + animals.values + animals.pace);
    expect(practical.score).toBeLessThan(animals.score);
    expect(r.ranked[0].familyId).toBe('animals_environment');
  });

  it('a family with the maximum activity keeps its preferences at full value', () => {
    const r = scoreCareerDirections({ C2: ['support_people'], C4: ['talk_people'], C3: ['help_others'] });
    const care = find(r, 'care_support')!;
    expect(care.activity).toBe(2);
    expect(care.score).toBeCloseTo(care.activity + care.daily + care.values + care.pace);
  });

  it('breaks a tie on breadth of evidence before falling back to the alphabet', () => {
    const r = scoreCareerDirections({ C2: ['solve_problems'] });
    const ids = r.tiedFamilyIds;
    if (ids.length > 1) {
      const scores = ids.map(id => find(r, id)!);
      const breadth = (f: typeof scores[0]) =>
        [f.activity, f.daily, f.values, f.pace].filter(v => v > 0).length;
      for (let i = 1; i < scores.length; i++) {
        expect(breadth(scores[i - 1])).toBeGreaterThanOrEqual(breadth(scores[i]));
      }
    }
  });

  it('never lets appetite for change create a direction on its own', () => {
    const result = score([], [], [], 'prefer_steady');
    expect(result.ranked).toEqual([]);
    expect(result.broadExploration).toBe(true);
  });

  it('treats an unsure appetite as no signal rather than a vote', () => {
    const unsure = score(['solve_problems'], ['focus_tasks'], [], 'unsure');
    const none = score(['solve_problems'], ['focus_tasks']);
    expect(find(unsure, 'finance_analysis')!.score).toBe(find(none, 'finance_analysis')!.score);
  });

  it('reads C3 as a third dimension, so answering it can change the order', () => {
    const helping = score(['support_people'], ['talk_people'], ['help_others']);
    const routine = score(['support_people'], ['talk_people'], ['clear_routine']);
    expect(find(helping, 'care_support')!.values).toBeGreaterThan(0);
    expect(find(routine, 'care_support')!.values).toBe(0);
    expect(find(helping, 'care_support')!.score)
      .toBeGreaterThan(find(routine, 'care_support')!.score);
  });

  it('gives the day half of the preference point when it fits perfectly', () => {
    const result = score(['support_people'], ['talk_people']);
    const care = find(result, 'care_support')!;
    expect(care.activity).toBe(2);
    // talk_people is 1.0 and is the best care_support can score on the day, so
    // this is a perfect daily fit and earns the whole 0.5 share.
    expect(care.daily).toBe(0.5);
    expect(care.score).toBe(2.5);
  });

  it('halves the daily fit when two daily answers are given and one matches', () => {
    const result = score(['support_people'], ['talk_people', 'information_digital']);
    expect(find(result, 'care_support')!.daily).toBe(0.25);
  });

  it('measures each preference against what that direction could ever score', () => {
    // animals_environment tops out at 0.3 on values; creative_communication at
    // 1.0. Each learner has stated the strongest values fit their direction
    // allows, so both must earn the same, or the ranking is reading how densely
    // the matrix row was written rather than what the learner said.
    const animals = score(['animals_nature'], [], ['variety_challenge']);
    const creative = score(['create_ideas'], [], ['creativity']);
    expect(find(animals, 'animals_environment')!.values)
      .toBeCloseTo(find(creative, 'creative_communication')!.values);
  });

  it('handicaps no direction for the shape of its row in the matrix', () => {
    // For every direction, an answer that suits it as well as any answer could
    // must earn the same preference score. Otherwise a direction whose row an
    // editor wrote thinly is penalised for every learner, whatever they said,
    // and the ranking is partly reading the matrix instead of the person.
    const best = (weights: Record<string, number>) =>
      Object.entries(weights).sort((a, b) => b[1] - a[1])[0][0];
    const seen = new Set<number>();
    for (const family of CAREER_FAMILY_MATRIX) {
      const result = scoreCareerDirections({
        C2: [best(family.activities)],
        C4: [best(family.daily)],
        C3: [best(family.values)],
        C8: best(family.pace)
      });
      const self = find(result, family.id)!;
      seen.add(Number((self.daily + self.values + self.pace).toFixed(6)));
    }
    expect([...seen]).toEqual([1]);
  });

  it('keeps the score between zero and three', () => {
    const best = score(['support_people'], ['talk_people'], ['help_others'], 'prefer_steady');
    for (const family of best.ranked) {
      expect(family.score).toBeGreaterThan(0);
      expect(family.score).toBeLessThanOrEqual(3);
    }
  });

  it('excludes "a mix" and "not sure" from the daily set', () => {
    const mixed = score(['support_people'], ['mixed_activities']);
    const unsure = score(['support_people'], ['unsure']);
    const none = score(['support_people'], []);
    expect(find(mixed, 'care_support')!.score).toBe(find(none, 'care_support')!.score);
    expect(find(unsure, 'care_support')!.score).toBe(find(none, 'care_support')!.score);
  });

  it('requires an explicit activity signal before ranking a direction', () => {
    const result = score([], ['talk_people', 'hands_on']);
    expect(result.ranked).toEqual([]);
    expect(result.broadExploration).toBe(true);
  });

  it('an unsure activity answer produces broad exploration, not a manufactured direction', () => {
    const result = score(['unsure'], ['talk_people']);
    expect(result.ranked).toEqual([]);
    expect(result.broadExploration).toBe(true);
  });

  it('all-unknown answers produce broad exploration', () => {
    expect(scoreCareerDirections({ C2: ['unsure'], C4: ['unsure'] }).broadExploration).toBe(true);
  });

  it('never ranks a family whose activity contribution is zero', () => {
    const result = score(['animals_nature'], ['talk_people'], ['help_others']);
    // Every ranked direction earned an activity score. Nothing is carried in on
    // the daily or values dimensions alone, however well they match.
    expect(result.ranked.length).toBeGreaterThan(0);
    for (const item of result.ranked) expect(item.activity, item.familyId).toBeGreaterThan(0);
    // care_support has no weight for animals_nature, so it is absent even though
    // this learner's day and values match it perfectly.
    expect(result.ranked.map(item => item.familyId)).not.toContain('care_support');
  });
});

describe('ties', () => {
  it('keeps genuinely tied directions visible rather than picking one', () => {
    const result = score(['solve_problems']);
    // Both weight solve_problems as central, so they really do tie. practical
    // technical weights it 0.6 and is ranked below rather than tied with them.
    expect(result.tiedFamilyIds.sort()).toEqual(['digital_technology', 'finance_analysis']);
    expect(result.ranked.filter(i => i.score === result.topScore)).toHaveLength(2);
    expect(result.ranked.map(i => i.familyId)).toContain('practical_technical');
  });

  it('orders ties by a stable identifier, without claiming the first is more suitable', () => {
    const first = score(['solve_problems']).ranked.map(item => item.familyId);
    const second = score(['solve_problems']).ranked.map(item => item.familyId);
    expect(first).toEqual(second);
    // Within the tied group the order is alphabetical, so nothing about the
    // position of one over another is a judgement.
    const tied = score(['solve_problems']).tiedFamilyIds;
    expect(tied).toEqual([...tied].sort());
  });

  it('a C7 answer may only reorder families that are already tied', () => {
    const result = score(['solve_problems']);
    // Both scenarios must name families that are actually tied; practical
    // technical is now ranked below the tie and so cannot be promoted by C7.
    const pair = { scenarioAFamilyId: 'digital_technology', scenarioBFamilyId: 'finance_analysis' };
    const chosen = applyC7(result.ranked, result.tiedFamilyIds, pair, 'scenario_a');
    expect(chosen.ranked[0].familyId).toBe('digital_technology');
    expect(chosen.ranked.map(i => i.familyId).sort()).toEqual(result.ranked.map(i => i.familyId).sort());
  });

  it('both, unsure and a skipped C7 keep the tie unchanged', () => {
    const result = score(['solve_problems']);
    const pair = { scenarioAFamilyId: 'practical_technical', scenarioBFamilyId: 'digital_technology' };
    for (const answer of ['both', 'unsure', null]) {
      expect(applyC7(result.ranked, result.tiedFamilyIds, pair, answer).ranked)
        .toEqual(result.ranked);
    }
  });

  it('neither broadens exploration rather than choosing a winner', () => {
    const result = score(['solve_problems']);
    const pair = { scenarioAFamilyId: 'practical_technical', scenarioBFamilyId: 'digital_technology' };
    expect(applyC7(result.ranked, result.tiedFamilyIds, pair, 'neither').broaden).toBe(true);
  });

  it('C7 cannot promote a family that was not tied', () => {
    const result = score(['support_people'], ['talk_people']);
    const pair = { scenarioAFamilyId: 'animals_environment', scenarioBFamilyId: 'care_support' };
    expect(applyC7(result.ranked, result.tiedFamilyIds, pair, 'scenario_a').ranked)
      .toEqual(result.ranked);
  });

  it('C7 is inert without a reviewed scenario pair', () => {
    const result = score(['solve_problems']);
    expect(applyC7(result.ranked, result.tiedFamilyIds, null, 'scenario_a').ranked).toEqual(result.ranked);
  });
});

describe('editorial content makes no occupational claims', () => {
  const forbidden = /\b(guarantee|guaranteed|you will earn|salary|£|well[- ]paid|in demand|job security|qualifies you|you are suited)\b/i;

  it.each(Object.values(CAREER_FAMILY_CONTENT))('$id avoids employment and pay claims', content => {
    const text = [content.summary, content.everydayActivity, content.investigate,
      ...content.roles, ...Object.values(content.investigateByPriority)].join(' ');
    expect(text).not.toMatch(forbidden);
  });

  it('describes the everyday activity as something a person may do', () => {
    for (const content of Object.values(CAREER_FAMILY_CONTENT)) {
      expect(content.everydayActivity, content.id).toMatch(/\bmay\b/);
    }
  });

  it('names jobs people hold in every direction', () => {
    for (const content of Object.values(CAREER_FAMILY_CONTENT)) {
      expect(content.roles.length, content.id).toBeGreaterThanOrEqual(3);
      expect(new Set(content.roles).size, content.id).toBe(content.roles.length);
    }
  });

  it('keeps a role a job title rather than a sentence about the learner', () => {
    // A title can be searched for and checked against a real vacancy. A sentence
    // starts making claims about the person reading it, which this guide cannot
    // support and which the National Careers Service is there to answer.
    for (const content of Object.values(CAREER_FAMILY_CONTENT)) {
      for (const role of content.roles) {
        expect(role, content.id).toMatch(/^[A-Z][A-Za-z ]{2,34}$/);
        expect(role, content.id).not.toMatch(/\byou\b|\byour\b|\./i);
      }
    }
  });

  it('does not repeat a job title across two directions', () => {
    // Two directions offering the same title would tell the learner the guide
    // cannot actually tell them apart.
    const seen = new Map<string, string>();
    for (const content of Object.values(CAREER_FAMILY_CONTENT)) {
      for (const role of content.roles) {
        expect(seen.get(role), `${role} in ${content.id}`).toBeUndefined();
        seen.set(role, content.id);
      }
    }
  });

  it('every priority prompt is a thing to check, not a claim', () => {
    for (const content of Object.values(CAREER_FAMILY_CONTENT)) {
      for (const [priority, text] of Object.entries(content.investigateByPriority)) {
        expect(text, `${content.id}/${priority}`).toMatch(/^(Check|Ask)\b/);
      }
    }
  });

  it('covers every C3 priority except the unknown answer', () => {
    const priorities = requireQuestion('career', 'C3').options
      .filter(option => !option.isUnknown).map(option => option.id);
    for (const content of Object.values(CAREER_FAMILY_CONTENT)) {
      expect(Object.keys(content.investigateByPriority).sort(), content.id).toEqual([...priorities].sort());
    }
  });
});

describe('next-step wording', () => {
  it('produces distinct wording for every C6 answer', () => {
    const options = requireQuestion('career', 'C6').options.map(option => option.id);
    const wordings = options.map(id => nextStepWording(id, 'start_work', 'starting_beginning'));
    expect(new Set(wordings).size).toBe(options.length);
  });

  it('a preference for a small first step does not remove longer possibilities', () => {
    const wording = nextStepWording('try_activity', 'start_work', 'starting_beginning');
    expect(wording).toMatch(/then decide|before deciding/i);
  });

  it('does not lower the starting level for a returner', () => {
    const returner = nextStepWording('build_existing', 'return_work', 'worked_related');
    expect(returner).toMatch(/still count|build on/i);
    expect(returner).not.toMatch(/beginner|start again from|basic/i);
  });

  it('a personal-interest learner is not pushed towards a career outcome', () => {
    const wording = nextStepWording('try_activity', 'personal_interest', 'starting_beginning');
    expect(wording).not.toMatch(/job|employer|career/i);
  });
});
