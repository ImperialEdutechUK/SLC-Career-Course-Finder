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

const score = (C2: string[], C4: string[] = [], C3: string[] = []) =>
  scoreCareerDirections({ C2, C3, C4 });
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

  it('reads C3 as a third dimension, so answering it can change the order', () => {
    const helping = score(['support_people'], ['talk_people'], ['help_others']);
    const routine = score(['support_people'], ['talk_people'], ['clear_routine']);
    expect(find(helping, 'care_support')!.values).toBeGreaterThan(0);
    expect(find(routine, 'care_support')!.values).toBe(0);
    expect(find(helping, 'care_support')!.score)
      .toBeGreaterThan(find(routine, 'care_support')!.score);
  });

  it('adds the daily contribution with weight one', () => {
    const result = score(['support_people'], ['talk_people']);
    const care = find(result, 'care_support')!;
    expect(care.activity).toBe(2);
    expect(care.daily).toBe(1);
    expect(care.score).toBe(3);
  });

  it('halves the daily contribution when two daily answers are given and one matches', () => {
    const result = score(['support_people'], ['talk_people', 'information_digital']);
    expect(find(result, 'care_support')!.daily).toBe(0.5);
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
      ...Object.values(content.investigateByPriority)].join(' ');
    expect(text).not.toMatch(forbidden);
  });

  it('describes the everyday activity as something a person may do', () => {
    for (const content of Object.values(CAREER_FAMILY_CONTENT)) {
      expect(content.everydayActivity, content.id).toMatch(/\bmay\b/);
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
