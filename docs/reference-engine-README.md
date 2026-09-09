# SLC recommendation reference engine

Version 0.2.0. A small, deterministic JavaScript reference for developer review and adaptation. It has no AI calls, dependencies, web server, database or deployment configuration. **The catalog fixture is wholly synthetic. None of its titles, rules, levels, prices or regulated-status labels describe South London College courses. Do not import it into a live service.**

This module ranks already approved course records. It does not administer a career assessment, decide admission, verify regulation, infer missing course facts, generate a qualification route or guarantee employment. The production catalog and request adapter remain essential.

## Run the checks

Requires Node.js 20 or later. From this directory run:

```sh
npm test
```

No installation step is needed. The test suite covers caps, unknown values, eligibility logic, review expiry, duplicate conflicts, URL destinations, bounded requests, repeatable ordering and protection against ranking unrelated courses.

## Call example

```js
import { recommend } from './engine.mjs';
import { approvedCatalogFixture } from './catalog.fixture.mjs';

const result = recommend({
  preferences: {
    categoryIds: ['business'],
    goal: 'first_role',
    experience: 'beginner',
    hoursPerWeek: 5,
    budgetGbp: 400,
    regulatedOnly: true
  },
  facts: { minimumAgeConfirmed: true }
}, approvedCatalogFixture, {
  now: '2026-09-09T12:00:00Z',
  allowedUrlHosts: ['example.invalid'] // Test fixture only; never a production destination.
});

console.log(result.status, result.recommendations);
```

Use the verified live catalog instead of the fixture in production. Set `allowedUrlHosts` explicitly to the college's approved exact hostnames, such as `['southlondoncollege.org']`; add `www` or a subdomain only after confirming it is used and owned by the college. The module always rejects HTTP, credentials embedded in URLs and nonstandard HTTPS ports. The allowlist is optional only for reference evaluation, which produces a warning if it is omitted. A production adapter **must fail startup if the allowlist is absent** and must validate redirects at ingestion; this module makes no network requests and cannot inspect a redirect's destination.

## Request contract

`recommend(request, catalog, options)` accepts only `preferences` and `facts` at the request's top level. Unknown keys, including AI-generated scores or prompts, return `invalid_request`. Optional unknown answers can be omitted or set to `null`. Empty strings are treated as missing for preference values. An empty category array means no subject selected.

| Preference | Type and meaning |
| --- | --- |
| `categoryIds` | Up to 10 category identifiers; duplicate selections are removed. At least one selected category must match a course. |
| `goal` | One approved goal identifier. General motivations such as `first_role` and `career_change` require a subject too. A specific goal such as `become_teaching_assistant` can anchor ranking only where the course has that reviewed tag. |
| `experience` | One approved readiness identifier, such as `beginner`. A relevance preference, never an entry requirement by itself. |
| `hoursPerWeek` | Finite number from 0 to 168; learner's available weekly study time. This reference uses it as a relevance preference. |
| `budgetGbp` | Finite number from 0 to 1,000,000; maximum **total** course cost in GBP. It is a hard cap on verified all-inclusive prices. Zero is a real cap, not an unknown answer. |
| `regulatedOnly` | Boolean; `true` requires `qualification_status === 'regulated_verified'`. `false` does not filter. |

Identifiers match `[a-z][a-z0-9_-]{0,63}`. The production adapter must check category, goal and experience identifiers against versioned, approved registries and map questionnaire answers to them. Do not pass free text or model-generated identifiers directly. Goal-only ranking is disabled by default: the server must supply the separate `approvedSpecificGoalIds` option to enable individually reviewed specific goals. A matching catalog tag alone is insufficient. Broad goals in the exported `GENERAL_GOALS` list cannot appear in that allowlist. These include the questionnaire F1 motivations `new_subject`, `prepare_work`, `develop_work_skills`, `further_study`, `specific_requirement`, `personal_interest` and `unsure`; each still needs a subject or an independently captured and approved exact goal.

`facts` is a flat object with at most 100 keys. Keys match `[A-Za-z][A-Za-z0-9_]{0,63}` and cannot be `constructor`, `prototype` or `__proto__`. Values are booleans, finite numbers, nonempty strings of at most 2,048 characters, or `null`/omitted for unknown. No arrays or nested fact objects. Zero and false remain known values. The adapter must enforce each approved fact's type, range, wording and evidence source; for example, relevant qualification level differs from highest qualification level. Do not infer a relevant qualification from an unrelated degree.

`options` permits only `now` (a valid Date or UTC ISO timestamp, default current time), `allowedUrlHosts` (1–20 lowercase exact hostnames), and `approvedSpecificGoalIds` (0–200 specific goal identifiers, default empty). The goal allowlist is server configuration, never part of a learner request. For example, an admissions-approved exact goal mapping can be passed as `approvedSpecificGoalIds: ['become_teaching_assistant']`; that same goal must also match the reviewed course tag. UTC strings use `YYYY-MM-DDTHH:mm:ssZ` or milliseconds. Invalid calendar dates are rejected. The supplied catalog is limited to 10,000 records.

## Approved catalog contract

Each catalog record uses these names:

| Field | Required meaning |
| --- | --- |
| `canonical_id` | Stable nonempty identifier shared by duplicate import rows. |
| `id`, `record_id` | Optional import-row identifiers; these alone may differ between otherwise identical duplicates. |
| `title`, `url` | Reviewed display title and canonical HTTPS course URL. |
| `active` | Must be boolean `true`. Requires its own unexpired review. |
| `review_status` | Must equal `approved`. |
| `qualification_status` | `regulated_verified`, `unregulated` or `unverified`. Verification must come from the catalog approval process, not the course name or an AI claim. |
| `categoryIds` | Nonempty array of approved category identifiers. |
| `entry_policy` | `{ status: 'verified', rule: ... }`, or `{ status: 'unknown' }`. Missing/null policy is also unknown. An unknown policy cannot include a rule. |
| `goals`, `experienceFit` | Optional reviewed nonempty arrays of approved identifiers. |
| `hoursPerWeek` | Optional reviewed nonnegative finite typical weekly workload. A production importer must apply realistic bounds and define the pacing assumption. |
| `priceGbp` | Optional reviewed nonnegative finite **all-inclusive total**, including mandatory assessment, certification and other compulsory fees and applicable tax. Never a deposit, instalment amount, “from” price, expired discount or tuition-only figure with unknown compulsory charges. Use null/omit if total is unknown. |
| `level` | Optional reviewed integer 1–7. Level alone does not determine entry eligibility. |
| `field_reviews` | Field-keyed review objects described below. |

String fields are bounded at 2,048 characters and string arrays at 100 elements in this reference. Production catalog validation should be stricter, include currency and pricing conditions, and validate the full schema before approval. Price reviews must expire when an offer does; do not use the illustrative fixture expiry as an operational review policy.

Each of `active`, `title`, `url`, `categoryIds`, `qualification_status` and `entry_policy` must have a review record. Optional fields must have reviews when supplied. Every additional review supplied is checked too:

```js
field_reviews: {
  active: {
    conflicting: false,
    valid_until: '2026-09-10T12:00:00Z',
    source: 'Approved catalog source record and revision reference'
  }
  // Repeat for every required or populated reviewed field.
}
```

`valid_until` must be a real UTC timestamp strictly later than the evaluation time. Missing, conflicting or expired reviews exclude the course until resolved. Ingestion must keep actual reviewer identity, checked-at date, source URL/record and revision evidence; the `source` string here is a pointer, not verification by this engine. Approval must be revoked and `active` refreshed promptly when a course closes. Review time-to-live and refresh failure behaviour belong to the live catalog service.

Rows with the same `canonical_id` and identical content are deduplicated. Any differing content except `id`/`record_id` quarantines the entire canonical group; ordering cannot hide a conflict. Missing canonical identifiers, inactive courses and unapproved records are excluded.

## Entry rules and unknown facts

Rules are one strict `all`/`any` branch, or one leaf containing exactly `fact`, `op`, `value`:

```js
{
  any: [
    { fact: 'relevantQualificationLevel', op: 'gte', value: 4 },
    { fact: 'relevantExperienceYears', op: 'gte', value: 3 }
  ]
}
```

Supported operators: `eq`, `gte`, `lte`, `in`. Numeric comparisons are inclusive. `in` requires a nonempty list of at most 100 values of one scalar type. Empty branches, unknown operators and malformed leaves fail validation; rules cannot be silently weakened. Rules are limited to depth 12 and 200 nodes.

Evaluation has three values: `met` (true), `not_met` (false), `unknown`. A missing fact or a scalar with the wrong type remains unknown; values are never coerced. `all` fails when any part is false, otherwise is unknown if any part is unknown. `any` succeeds when any part is true, otherwise is unknown if any part is unknown.

| Rule outcome | Eligibility status | Learner wording |
| --- | --- | --- |
| `met` | `appears_to_meet` | “Based on your answers, you appear to meet the listed entry requirements. The college will confirm.” |
| `not_met` | `pathway_needed` | “An entry requirement may need attention. Check a preparation route or speak to an adviser.” |
| `unknown` or unknown policy | `check_needed` | “We need to check an entry requirement before you enrol.” |

The `pathways` list contains relevant courses whose stated requirements are not met; it does **not** contain a verified bridge/preparation course. The UI must label it accordingly and may add only independently verified preparation options. No status means confirmed admission.

## Ranking, budget and returned results

At least a subject match or a matching server-allowlisted specific goal is required. Budget, time, experience and regulated-only answers cannot create ranked results on their own. If a subject is supplied, a nonmatching subject excludes the course even if its other attributes fit. Without a subject, a course must match the allowlisted specific goal. An absent, non-allowlisted or unmatched specific goal triggers `needs_clarification`.

Weights: category 40, goal 25, experience 15, workload 10, budget 10. Missing learner preferences are removed from the denominator. A missing course attribute retains the available dimension's weight and scores zero, with an explicit warning. Categories score the proportion of selected categories matched; other dimensions score 0 or 1. These are **unvalidated starting weights**, not a psychometric model. `relevanceScore` is an internal ranking index, not a suitability probability or a learner-facing “match percentage”. Validate the design with learners and advisers before tuning the weights.

A known all-inclusive price above `budgetGbp` excludes the course from both result lists, regardless of other fit. Unknown price is retained only with `budgetCheck.status: 'check_needed'`, zero budget points and an explicit warning; never call it affordable or within budget. A known total at or below the cap returns `within_cap`. If the learner supplied no cap, `budgetCheck.status` is `not_requested`. Entry eligibility and budget checks are separate; meeting entry rules does not resolve an unknown price.

The response includes `engineVersion`, `evaluatedAt` (for valid requests), `status`, `recommendations`, `pathways`, `excluded`, `warnings`, `totalDirectMatches` and `totalPathwayMatches`. Invalid requests also include `errors`. Result statuses:

- `invalid_request`: reject and correct the request contract.
- `needs_clarification`: ask for an interest/subject or a specific goal.
- `results`: one or more direct candidates; some may still require entry or price checks.
- `no_direct_match`: only relevant courses requiring entry/pathway attention exist.
- `no_match`: no approved matching candidates remain after filters, including budget.

Each recommended item includes canonical ID, title, URL, qualification status, score dimensions/warnings, entry checks and the budget check. At most three items are returned in each list; totals count all matches before truncation. Ties use entry status and then canonical ID. This deterministic tie-break is for reproducibility; the production experience should ask a discriminating follow-up where too many courses tie. Do not secretly break ties using margin or popularity.

## Production boundary and limitations

1. Expose this only behind a server adapter that accepts parsed JSON, applies a body-size limit (for example 64 KB), validates approved answer identifiers and fact ranges, rate-limits requests and keeps the catalog server-owned. Do not accept a client-supplied catalog, rules, allowlist or evaluation clock. Arbitrary JavaScript objects and proxies are not a supported public input surface. Request accessors are rejected as a precaution; this is not a sandbox for untrusted executable JavaScript.
2. Validate the complete catalog at ingestion. The reference checks its essential serving fields but intentionally does not enforce an exhaustive catalog schema or implement a live source-of-truth pipeline. Its `regulated_verified` string and source pointers are assertions from an approved importer, not independent evidence.
3. Add an explicit result-presentation adapter. Do not expose internal facts, rule diagnostics, scores or exclusion reasons verbatim to learners. Escape all catalog text; never insert it as HTML. Show entry/price checks visibly and distinguish matched courses, courses needing an entry discussion and genuine preparation options.
4. Keep AI optional. It can phrase explanations from approved result facts, subject to a constrained schema and deterministic fallback; it cannot alter exclusions, eligibility, prices, URLs or regulated status. This package implements no AI layer.
5. Add user sessions, consent, retention, analytics, accessibility, admin review, adviser routing, observability, refresh jobs, secrets management and deployment separately. This package is reviewable reference logic, not a production-ready service or an AWS/Railway application.

Human acceptance work is still required: check mappings against real approved course records; review entry wording and exception routes with admissions staff; test relevance and confidence with beginners; check accessibility; and evaluate meaningful choice/enrolment outcomes without pressuring uncertain learners.
