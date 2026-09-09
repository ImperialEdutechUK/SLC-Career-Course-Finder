# Ambiguity register

Every point where the supplied package does not determine an answer, what this build
does instead, and who has to decide. Nothing in this list was resolved by guessing
quietly: each entry is isolated in one named file so a reviewer can change or reject it
without touching the rest of the application.

Raised 9 September 2026 against `Career and Course Guide.zip`
(`SLC_Developer_Package`, questionnaire `2026-09-08.1`, reference engine `0.2.0`).

---

## AR-001 — The staging snapshot records no course as active

**The conflict.** `data/catalog_staging.json` sets `active: null` on all 395 rows and
`status: "staging_only_not_recommendable"`. The reference engine requires
`active === true` before a course can be served. Taken literally, no course can ever be
recommended and the whole service returns "no verified match".

**What this build does.** `scripts/editorial-rules.mjs` publishes `active: true` for any
row present in South London College's own July 2026 course listing, recorded as a
*listing* fact with the exact sheet and row as its source, and with a twelve-month
review life so a stale listing expires itself rather than being served indefinitely.

**What it does not claim.** It does not claim enrolment is currently open, that the
course still exists, or that the college has approved this release.

**Owner.** Course development. Replace this derivation with the real availability feed
before a learner pilot. **Blocking for production: yes.**

---

## AR-002 — No reviewed `goals` or `experienceFit` tags exist

**The conflict.** The handoff requires importers to create reviewed `goals` and
`experienceFit` tags and states explicitly that "the engine does not derive these tags
from course titles". The snapshot contains no such tags, and deriving them from titles
is forbidden.

**What this build does.** It publishes neither. The engine therefore keeps both
dimensions in the relevance denominator, scores them zero, and emits
`course_field_missing` warnings, which the interface renders as "We do not yet hold a
reviewed record of what this course prepares you for."

**The consequence, stated plainly.** Within one subject every course scores identically,
so the engine's tie-break on canonical identifier decides the top three. The results page
says so: "On the information we hold, these options are equally relevant to your answers.
They are not shown in order of suitability." Learners are offered subject and level
refinements, both built from real source facts, to narrow the list themselves.

**What was rejected.** Inventing a level-to-goal or level-to-readiness mapping would have
produced a more convincing ranking with no evidence behind it.

**Owner.** Course development, with a career adviser. **Blocking for a useful ranking: yes.**

---

## AR-003 — Nothing in the snapshot verifies regulated status

**The conflict.** The snapshot's own `qualification_status` values are
`requires_register_check` (286 rows) and `qls_label_requires_endorsement_check`
(109 rows). Both are requests for a check, not a verification.

**What this build does.** Both map to the engine's `unverified`. No course in the release
is `regulated_verified`, so the "Regulated qualifications only" filter correctly returns
nothing, and the interface explains why rather than quietly widening the filter.

**Owner.** Course development, against the GOV.UK register of regulated qualifications.

---

## AR-004 — No prices, workloads, entry requirements or placement facts

**The conflict.** `price_gbp`, `tqt_hours`, `entry_requirements` and `placement_required`
are `null` on every row.

**What this build does.** All four stay unknown. Prices render as "Not confirmed yet",
never as £0 and never as within budget. Every course carries `entry_policy: { status:
'unknown' }`, so every result is "Entry requirements to check" and no learner is ever
told they are eligible.

**Owner.** Course development, plus the qualification and offer layer described in
handoff section 4.

---

## AR-005 — Canonical identity has to be assigned

**The conflict.** `canonical_id` is `null` throughout, deliberately. The engine needs one,
and duplicate import rows must share it.

**What this build does.** It adopts the importer's existing `url_group_id`. That
identifier is stable, already shared by rows about one course, and — unlike a title slug
— does not cluster near-identical awards together when the engine breaks a relevance tie
by canonical identifier.

**Owner.** Course development, when real programme identifiers arrive from the CMS.

---

## AR-006 — Master rows 205 and 206 share one URL

**The conflict.** Both describe "Level 3 Diploma in Business and Management (RQF)" at one
URL, but name different awarding organisations (ATHE and Focus Awards). The verification
record flags this for resolution before publication.

**What this build does.** The publication pipeline quarantines the whole canonical group.
Neither row reaches the catalogue, the browse page, or any result. The quarantine is
reported on the browse page and covered by a test.

**Owner.** Course development. This is a data question, not a code question.

---

## AR-007 — No reviewed content exists for either optional branch

**The conflict.** C7 requires `scenarioPairId`, `scenarioALabel`, `scenarioBLabel`,
`reviewedBy`, `reviewedAt` and `version`. F6 requires `requirementRuleId`, `courseIds`,
`requirementKey`, `verifiedSourceUrl`, `reviewedBy`, `reviewedAt` and `version`. Neither
set is supplied, and `unresolvedBindingsMustNotRender` forbids rendering without them.
Writing the content here would breach `runtimeGenerativeQuestionAuthoringAllowed: false`.

**What this build does.** Both branches are fully implemented, unit tested and switched
off by `CAREER_C7_ENABLED=false` and `COURSE_F6_ENABLED=false`. The server rejects an
answer to either branch with `INAPPLICABLE_BRANCH`, and neither appears in the question
count.

**Owner.** An educator or career adviser writes the scenario library; course development
writes the requirement rules. **Blocking for the optional branches only.**

---

## AR-008 — Career family editorial content is not supplied

**The conflict.** The handoff supplies the family identifiers and the C2/C4 matrix, and
states that occupation examples, daily tasks, routes and links "require their own
evidence and content approval". The blueprint gives one worked example of the tone.

**What this build does.** `src/lib/career/content.ts` carries provisional wording for ten
families, written to that example's pattern. Every everyday activity says what a person
*may* do. Every thing to investigate begins "Check" or "Ask". Tests assert that no string
mentions pay, employment, guarantees or suitability, and each direction links to the
National Careers Service for occupational facts.

**Owner.** SLC's educators and career adviser. The matrix itself is transcribed verbatim
from the handoff and is separately marked provisional.

---

## AR-009 — The deployment target differs from the handoff

**The conflict.** Handoff section 8 recommends ECS/Fargate behind an Application Load
Balancer. The build brief for this application specifies CloudFront, S3 and Lambda on
ARM64 in `eu-west-2`, and excludes ECS and Fargate.

**What this build does.** It follows the build brief. `docs/AWS-DEPLOYMENT.md` documents
the serverless architecture, and records this as a deliberate departure from the handoff
along with what it changes operationally.

**Owner.** SLC engineering, with whoever owns the AWS account.

---

## AR-010 — Contact delivery, saved results and analytics have no controls yet

**The conflict.** The handoff requires a durable outbox, consent records, retention
policy and an approved event allowlist before any of these can run. None exists.

**What this build does.** All are configured off. The adviser page says so and points to
the college's own contact details rather than showing a form that discards the message.
Results need no email address, and the service is complete without any of them.

**Owner.** The privacy owner, with engineering.
