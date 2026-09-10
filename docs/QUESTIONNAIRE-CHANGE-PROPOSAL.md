# Proposed questionnaire change: 2026-09-08.1 → 2026-09-08.3

**Status: Change 3 is implemented at the client's instruction. Changes 1 and 2 are
still drafts.** The service now serves `2026-09-08.2` with C8 added as a seventh
career question, and `data/source/questionnaire.json` has been edited. It is no
longer identical to the supplied package. The college still needs to review all
three changes, and Change 3 retrospectively.

Raised because automation is now the most common worry learners bring to a
careers conversation, and the career questionnaire currently has no way to hear
it or answer it.

---

## What this proposal will not do

Worth stating first, because it is the request most likely to arrive and the one
that would do real harm.

**It does not add a question asking whether the learner is worried about AI, and
it does not rank career directions by how exposed they are to automation.**

A question is only worth asking if the results can answer it. To answer "which of
these careers is safe from AI", the guide would need evidence linking each career
direction to an automation exposure measure. It holds none. The published UK
evidence describes broad occupation groups; the ten career families in this
service are editorial hypotheses awaiting the college's approval. Asserting a
correspondence between the two would be inventing a forecast and showing it to
someone anxious about their livelihood, on a service that otherwise refuses to
guess at a course price.

The three changes below are the honest version: ask what the learner values and
how they feel about change, then answer with what to go and find out.

---

## Evidence this draft was written against

Published UK analysis, used as background only. No figure from it appears in the
interface, and none is attached to a career direction.

| Source | Relevant finding |
| --- | --- |
| DfE, *The impact of AI on UK jobs and training* | Ranks occupations by AI exposure |
| ONS business survey | Employers most often name administrative and clerical roles, then creative and design, then data analysis |
| ONS worker survey | Concern is highest in administrative and secretarial, and sales and customer service; lowest in skilled trades and caring roles |

The service already reflects this in the "How this work is changing" line on each
career direction, which is editorial content the college owns and can change
without a version bump.

---

## Change 1 — C3 gains a value option

**Question:** "What would matter most to you in your work?" (multi-select, max 2)

**Add:**

```json
{ "id": "lasting_demand", "label": "Work that is likely to still be needed" }
```

**Why.** Durability of work is a value people hold, and the questionnaire has no
way to express it. Someone choosing it is telling the adviser something real.

**What it must change.** Selecting it must foreground the "How this work is
changing" block on every direction, and the results must say plainly that the
guide cannot rank directions by how long the work will last.

**What it must not change.** It carries **no scoring weight**. It changes the
answer given, not which directions appear. Weighting it would require the
evidence this proposal says does not exist.

**Risk if approved without the response.** A learner selects it, sees no
difference, and concludes the guide ignored the thing they most wanted help with.
The response is not optional.

---

## Change 2 — C1 gains a starting situation

**Question:** "What would you like your next step to help you do?" (single select)

**Add:**

```json
{ "id": "field_changing", "label": "My current line of work is changing and I want options" }
```

**Why.** The existing options are start work, change career, progress, return,
explore, personal interest. None fits someone whose occupation is being
restructured under them, which is now a common reason to arrive.

**What it changes.** Wording only: "why this appeared" and the suggested next
step. It behaves like `change_career` for reuse into the course journey.

**What it must not change.** No scoring weight, and no implication that the
directions shown are more durable than the learner's current field.

---

## Change 3 — a new question C8 on appetite for change

**Proposed:**

```json
{
  "id": "C8",
  "type": "single_select",
  "title": "How would you feel about your work changing over the next few years?",
  "hint": "There is no right answer. Both kinds of work exist.",
  "required": true,
  "allowSkip": true,
  "minSelections": 0,
  "maxSelections": 1,
  "options": [
    { "id": "keen_change",   "label": "I want work that keeps changing and I like learning new tools" },
    { "id": "change_with_training", "label": "Some change is fine if I am trained for it" },
    { "id": "prefer_steady", "label": "I would rather the work stayed broadly the same" },
    { "id": "unsure", "label": "I'm still working this out", "isUnknown": true }
  ],
  "use": "Order directions by pace of change. Never present as a prediction about job security."
}
```

**Why.** This is the axis the evidence actually supports and the learner can
actually answer. It asks about their appetite, not about the future of the labour
market, so it can be answered honestly.

**What it changes.** It becomes a fourth scoring dimension in the career map.
Directions differ genuinely in pace of change, and that is an editorial judgement
of the same kind as every other row in the matrix.

**Weight, revised during implementation from 1 to 0.5.** At full weight it
overrode the daily-work answer: a learner who chose problem solving and hands-on
work was shown finance ahead of practical work purely on appetite, which the
regression fixture caught. C8 is a single select, so unlike the multi-select
dimensions it is never divided by a second answer and would otherwise dominate.
It is also the least concrete thing asked. Appetite now orders the list rather
than deciding it.

**Draft weights, for the college to accept or reject:**

| Direction | keen_change | change_with_training | prefer_steady |
| --- | --- | --- | --- |
| Digital and technology | 1.0 | 0.6 | — |
| Creative and communication | 1.0 | 0.6 | — |
| Business and operations | 0.6 | 1.0 | — |
| Finance and analysis | 0.6 | 1.0 | 0.3 |
| Customer and commercial services | 0.6 | 0.6 | 0.3 |
| Education and learner support | 0.3 | 1.0 | 0.6 |
| Practical and technical work | 0.3 | 0.6 | 1.0 |
| Care and support | — | 0.6 | 1.0 |
| Active and personal services | 0.3 | 0.6 | 0.6 |
| Animals and the environment | — | 0.6 | 1.0 |

**What it must not become.** `prefer_steady` must never be presented as "these
jobs are safe from AI". It means the work changes at a slower pace, which is a
different claim and the only one the evidence supports.

**Question count.** Career has gone from six questions to seven, at the client's
instruction. C8 sits after C6 and before the optional C7 branch. If the college
would rather not lengthen it, C8 can replace C6 ("How would you like to start
exploring this?"), which affects wording only.

---

## Change 4 — C2 has no option for active or personal service work

This one was found by measurement rather than by reading, and it is a content
gap rather than a scoring bug.

Scoring every valid combination of answers, 34,848 of them, shows how often each
of the ten directions can come first. Nine of them win between 7% and 14% of the
time. `active_personal_services` wins 2.9%.

The cause is visible in the matrix. Every other direction has at least one C2
activity marked central to it. This one does not. Its strongest links are
`support_people` and `make_improve`, both at 0.6, because none of the eight
activities on offer describes sport, fitness, hair and beauty, or travel and
tourism. The best a learner can say is that they want to support people or make
things better, and neither is what this work is.

The consequence: a learner who wants exactly this work cannot say so, and the
direction sits below others on every answer set where they compete.

It also turned out to be one half of a larger problem. With eight activities,
each linked to two to four directions, the guide could produce only 47 distinct
sets of three, and for 21 of the 36 possible activity answers the three shown
never changed however the learner answered everything else.

Raising weights was simulated and rejected. Adding ten edge links at 0.3 moved
the 21 to 18 and left the 47 untouched, because a 0.3 link scores at most 0.9
against 2.0 for a central one and can never reach the top three. Making those
links strong enough to matter means claiming an activity is more central to a
direction than it is, which is not a trade this guide should make.

**Implemented in content version 2026-09-08.3.** C2 gains three activities, each
one central to a direction that needed it:

| Option | Label | Central to |
| --- | --- | --- |
| `health_fitness` | Helping people with their health, fitness or appearance | Active and personal services |
| `work_with_numbers` | Working with numbers, money or data | Finance and analysis |
| `work_outdoors` | Working outdoors rather than at a desk | Animals and the environment |

Two existing weights were corrected alongside them, both stretches that existed
only because nothing better was on offer. `make_improve` drops from 0.6 to 0.3
for active and personal services, and `work_with_numbers` sits at 0.3 rather
than 0.6 for digital and technology, because at 0.6 it re-cut the digital and
finance pairing the new activity existed to separate.

Measured across all possible answer sets:

| | Before | After |
| --- | --- | --- |
| Distinct sets of three | 47 | 58 |
| Answers where the three never change | 21 of 36 | 36 of 66 |
| Least to most shown direction | 22.2% to 36.9% | 24.8% to 37.9% |
| Animals and the environment | 22.2% | 31.5% |
| Digital and finance shown together | 21.6% | 19.2% |

The three labels and the five weights are editorial claims about what this work
is. They still need a career adviser to confirm or amend them.

---

## Technical consequences if approved

1. `data/source/questionnaire.json` is edited and `contentVersion` becomes
   `2026-09-08.2`. This file is otherwise treated as read-only supplied material.
2. `QUESTIONNAIRE_VERSION` is updated in configuration. The API rejects any
   submission carrying the old version, so client and server must ship together.
3. `src/lib/career/matrix.ts` gains a `pace` dimension and `CAREER_MAP_VERSION`
   becomes `career-map-0.3.0-provisional`.
4. `src/lib/career/engine.ts` adds the fourth term.
5. `src/lib/adapter/preferences.ts` maps `field_changing` for reuse.
6. Regression fixtures are recalculated. Every changed ranking is reviewed
   individually rather than accepted because the code produced it.
7. Roughly 40 of the 666 tests need updating.

Estimated one working day, most of it verifying rankings rather than writing code.

---

## Approval

This changes what the service asks a learner and how it orders what it tells
them. It needs the same sign-off as the career map itself.

| | Name | Date | Decision |
| --- | --- | --- | --- |
| Change 1, C3 `lasting_demand` | | | accept / reject / amend |
| Change 2, C1 `field_changing` | | | accept / reject / amend |
| Change 3, new C8 and its weights | | | accept / reject / amend |
| Change 4, the three new C2 activities and their weights | | | confirm / amend |
| C8 replaces C6, or is added | | | replace / add |

Owner: course development, with a career adviser.
