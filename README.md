# South London College — Career & Course Finder

A guided service with two starts, **Explore career ideas** and **Find a course**, plus a
full course catalogue. It helps a learner reach an understandable next step, and it says
plainly what it does not know.

Built from the supplied SLC developer package: `questionnaire.json` (content version
`2026-09-08.2`) is the authority for every question, answer identifier, selection limit
and reuse rule, and the reference recommendation engine (`0.2.0`) is used unmodified as
the only ranking authority.

---

## 1. Project overview

| | |
| --- | --- |
| Routes | `/` · `/guide/career` · `/guide/course` · `/guide/results` · `/courses` · `/courses/[id]` · `/about` · `/adviser` |
| API | `/api/v1/recommendations`, `/questionnaires/:journey`, `/subjects`, `/courses/search`, `/health/live`, `/health/ready` |
| Catalogue | 393 published courses across 16 subject areas, 1 canonical group quarantined |
| Tests | 34 reference-engine tests + 662 application tests, including 82 regression fixtures |
| AI | Off. The service is complete without it |
| Account required | No. No email address, no telephone number, no lead gate |

What the service will not do: show a match percentage, claim a learner is eligible,
describe an unknown price as free or affordable, invent a course fact, or let an AI change
an order, a price or a requirement.

## 2. Requirements

- Node.js 20 or later (developed on 24)
- npm 10 or later

No database, no external service and no API key. The application makes no outbound
network requests.

## 3. Installation

```sh
npm install
```

## 4. Running locally

```sh
npm run dev
```

Open http://localhost:3000.

`npm run dev` and `npm run build` both need a published catalogue release. `npm run build`
generates it; if you are starting with `npm run dev` on a clean checkout, run the
publication step once first:

```sh
npm run prepare:catalogue
npm run dev
```

Production build, served locally:

```sh
npm run build
npm run start
```

## 5. Environment variables

Everything has a safe default and the service runs with no configuration at all. Copy
`.env.example` to `.env.local` to change anything. There are no secrets in the default
configuration.

| Variable | Default | Meaning |
| --- | --- | --- |
| `QUESTIONNAIRE_VERSION` | `2026-09-08.2` | The only content version the API accepts |
| `SLC_COURSE_ORIGIN` | `https://southlondoncollege.org` | Where course links point |
| `ALLOWED_COURSE_URL_HOSTS` | `southlondoncollege.org` | Exact lowercase hostnames the engine may serve. **Must be set explicitly in production** |
| `CAREER_C7_ENABLED` | `false` | Optional career comparison. Needs reviewed scenario pairs (AR-007) |
| `COURSE_F6_ENABLED` | `false` | Optional requirement check. Needs reviewed rules (AR-007) |
| `AI_EXPLANATIONS_ENABLED` | `false` | AI wording. Cannot alter order, eligibility or facts |
| `SESSION_RESTORE_ENABLED` | `false` | Session restoration, pending privacy approval |
| `SAVED_RESULTS_ENABLED` | `false` | Saved result links, pending storage and retention controls |
| `CONTACT_REQUESTS_ENABLED` | `false` | Adviser requests, pending a durable queue |
| `MARKETING_OPT_IN_ENABLED` | `false` | Separate marketing consent |
| `NONESSENTIAL_ANALYTICS_ENABLED` | `false` | Non-essential analytics |

## 6. Tests

```sh
npm test              # everything
npm run test:reference # the 34 supplied reference-engine tests, unmodified
npm run test:app      # 662 application tests
npm run test:watch
```

| Suite | Covers |
| --- | --- |
| `src/lib/engine/engine.test.mjs` | The supplied reference tests, byte-identical, run against the byte-identical engine |
| `tests/questionnaire.test.ts` | Every question, every answer identifier, limits, exclusivity, detail fields, submission contract |
| `tests/flow.test.ts` | Multi-select transitions, selection limits, Back and Continue, screen counting |
| `tests/reuse.test.ts` | All C1→F1 and C5→F3 mappings and every invalidation rule |
| `tests/career.test.ts` | The scoring formula, ties, C7 behaviour, and that the editorial content makes no occupational claims |
| `tests/course-edge-cases.test.ts` | The twenty critical course edge cases and three-valued entry logic |
| `tests/publication.test.ts` | Release integrity, conflict quarantine, and that nothing absent from the source appears in the release |
| `tests/presenter.test.ts` | Display groups, the diversity rule, and that no internal score reaches the interface |
| `tests/service.test.ts` | The adapter mapping and the recommendation service end to end |
| `tests/regression.test.ts` | 82 reviewed scenario fixtures |

## 7. Build

```sh
npm run build     # publishes the catalogue, then builds
npm run start
```

The build prerenders 393 course detail pages and the static routes. Journey and results
routes render on the client from in-memory state; the API is server-side and never cached.

## 8. Architecture

```
data/source/            The supplied package, unmodified
  questionnaire.json    Authoritative question content
  catalog_staging.json  395 immutable import rows
  catalog_audit.json    Source counts

scripts/
  editorial-rules.mjs   Every derivation the pipeline may make, isolated for review
  publish-catalogue.mjs import -> validate -> conflict detection -> approve -> release

data/generated/         Published, immutable releases + the manifest pointer

src/lib/
  engine/               The reference engine, byte-identical, plus its type surface
  questionnaire/        Loader, validation, flow, reuse
  career/               Matrix, scoring, editorial content
  catalogue/            Release loading, search
  adapter/              Answers -> engine request; engine result -> display
  state/                In-memory journey state
  config/               Feature flags and server configuration

src/components/         The component system
src/app/                Routes and API
public/brand/           The college shield
public/fonts/           Jost and Open Sans, self-hosted
tests/                  Application tests and regression fixtures
```

Data flows one way and is validated at every hop:

```
visible answer -> canonical answer id -> journey state -> validated request
  -> engine preferences -> reference engine -> result ids -> display facts -> interface
```

### Branding

The palette, the typefaces and the shield come from the college's own site,
southlondoncollege.org, so the service reads as part of it rather than beside it.

| | Published value | Used here for |
| --- | --- | --- |
| Green | `#00a56f` | The right-hand end of the call-to-action gradient |
| Blue | `#1191d0` | The left-hand end of the rule above the header and below the footer |
| Deep blue | `#0a82bd` | The left-hand end of the call-to-action gradient |
| Lime | `#8cc540` | The right-hand end of that rule |
| Body ink | `#313b3d` | Body text |
| Display face | Jost | Headings, the service name, the shield's neighbours |
| Text face | Open Sans | Everything else |

Both typefaces are served from `public/fonts/` as latin-subset variable WOFF2. Nothing is
fetched from Google Fonts at runtime, because the content security policy in
`next.config.mjs` allows `font-src 'self'` only and the application makes no outbound
request. The shield is `public/brand/slc-logo.png`.

Anything carrying text uses a darkened derivative rather than the published literal. White
on `#00a56f` is 3.18:1 and white on `#8cc540` is 2.06:1, both below the WCAG 2.2 AA
threshold of 4.5:1. The call-to-action gradient is darkened to `#0e74a6` to `#008459`,
whose worst point measures 4.72:1, and the full-strength blue-to-lime gradient appears
only as a four-pixel rule that carries nothing. The derivation is recorded at the top of
`src/app/globals.css`.

## 9. Questionnaire architecture

`data/source/questionnaire.json` is loaded directly. No question, answer identifier,
label, limit or reuse rule is restated in code.

- **One question at a time.** Nothing advances on selection; the learner presses Continue.
- **Native controls.** Radios and checkboxes, so keyboard and screen-reader behaviour comes
  from the browser rather than from re-implemented ARIA.
- **Exclusive answers.** Choosing "I'm not sure" clears everything else, and choosing
  anything else clears it. There is no state in which both survive, on the client or the
  server.
- **Selection limits.** Enforced, with the remaining count stated in text, not by colour.
- **Optional detail fields** stay inline on their question's screen, so the displayed
  question count stays truthful. A field whose trigger answer is deselected is cleared,
  and the server rejects a value for an inactive field rather than ignoring it.
- **Back preserves everything.** Changing an answer invalidates only what depended on it.
- **Back is reachable without scrolling.** It appears as a link above the question as well
  as a button beside Continue, because a question with a dozen options pushes the footer
  below the fold on a phone.
- **The browser's Back button stays inside the journey.** Each question gets its own
  history entry, so the back button and a phone's back gesture step through the questions
  rather than leaving the guide and discarding every answer. Only the position is written
  to history. Answers are never put in the address bar or in a history entry, and pressing
  Back from the first question leaves the guide as it should.
- **Reuse** applies only the two configured mappings. Reused answers are shown with a
  Change action, and they reduce the displayed question count while they apply.
- **Both optional branches (C7, F6) are suppressed** because no reviewed content exists.
  They are implemented and tested; see AR-007.

## 10. Recommendation architecture

**Courses.** `src/lib/engine/engine.mjs` is the supplied reference engine, byte-identical
to the package. There is no second algorithm. `src/lib/adapter/preferences.ts` maps
questionnaire answers to engine preferences using the handoff's registry mapping, and
`src/lib/adapter/presenter.ts` turns the engine's output into cards. The presenter never
re-ranks: it groups by entry state, applies a diversity rule that only *selects* from the
order the engine chose, and never exposes a score.

Weights are the engine's own (subject 40, purpose 25, experience 15, workload 10,
budget 10). They are an internal ranking index and are never shown.

**Careers.** A separate reviewed matrix, not a query over the catalogue.
`src/lib/career/matrix.ts` transcribes the handoff's activity-to-family table verbatim,
and `src/lib/career/engine.ts` implements its formula exactly:

```
activity(f) = 0 when A is empty, else 2 x SUM association(f,a) / |A|
daily(f)    = 0 when D is empty, else 1 x SUM compatibility(f,d) / |D|
score(f)    = activity(f) + daily(f)
```

`activity(f) > 0` is required before a direction is ranked, so C4 alone can never create
one. Ties stay visible and are labelled as ties. C1, C5 and C6 choose next-step wording;
C3 chooses the thing to investigate. None of them establishes ability.

**Unknown handling.** Unknown is not true, false, zero, affordable, eligible or suitable.
An unknown learner preference is omitted from the request rather than defaulted. An
unknown course fact scores zero, keeps its weight in the denominator, and produces a
visible warning. An unknown price is never `within_cap`.

**Eligibility** is separate from relevance and stays three-valued. A known failure means
incompatible; unknown never becomes success. High relevance never overrides a known
failure.

## 11. Catalogue architecture

The supplied ZIP is source material. It is never unpacked at runtime.

```
source import -> staging -> validation -> duplicate/conflict detection
  -> review -> approval -> versioned release -> atomic publication -> rollback
```

`scripts/publish-catalogue.mjs` runs the offline half and writes an immutable release
plus a manifest. The application reads only the release the manifest points at, and
verifies its checksum before serving it. Publication changes one pointer; rollback points
it back. An emergency suppression list is applied at read time, so a rollback cannot
resurrect a withdrawn course.

Every derivation the pipeline is permitted to make lives in `scripts/editorial-rules.mjs`.
It may read only explicit structured source columns. It may not read a title, description
or URL to infer a level, a regulated status, a price, a workload or an entry rule.

From 395 source rows: 395 validated, 394 canonical groups, 1 quarantined for a URL
conflict at master rows 205 and 206, 393 published. This reconciles with the supplied
audit.

## 12. AWS architecture

CloudFront in front of S3 for static assets and Lambda on arm64 for server execution, in
`eu-west-2`. No ECS, Fargate, App Runner, RDS, Aurora, DSQL or Amplify. Full detail,
including the release and rollback procedure, is in
[`docs/AWS-DEPLOYMENT.md`](docs/AWS-DEPLOYMENT.md).

## 13. Deployment

Localhost first. `npm test`, `npm run build` and a manual pass through both journeys all
have to succeed before any deployment step. The runbook is in
[`docs/AWS-DEPLOYMENT.md`](docs/AWS-DEPLOYMENT.md).

## 14. Known limitations

These are properties of the supplied data, not defects in the application. Each is
recorded with an owner in [`docs/AMBIGUITY-REGISTER.md`](docs/AMBIGUITY-REGISTER.md).

1. **No prices.** The snapshot carries none. Every course shows "Not confirmed yet". A
   budget question is still answerable, and an unknown price is never called affordable.
2. **No entry requirements.** Every course is "Entry requirements to check". The interface
   never tells a learner they are eligible, and the "Appears to meet the listed checks"
   state is implemented and tested but cannot occur with this release.
3. **No verified regulated status.** "Regulated qualifications only" returns nothing, and
   says why.
4. **No reviewed goal or readiness tags.** Within one subject every course scores
   identically, so the top three are decided by the engine's tie-break. The results page
   states this and offers subject and level refinements.
5. **No study time.** Workload is unknown throughout. The interval comparison for F4 bands
   is implemented and tested but has no course data to compare against.
6. **Both optional branches are off.** No reviewed scenario pairs or requirement rules
   exist.
7. **Career content is provisional** and needs sign-off from an educator and a career
   adviser.
8. **Adviser requests, saved results, email copies and analytics are off** until their
   privacy and delivery controls exist.
9. **Session restoration is off**, so refreshing a journey starts it again.
10. **Automated accessibility checks are not a conformance audit.** Contrast, keyboard
    operation, reflow at 320 pixels, 200% zoom, focus visibility, labelling, heading order,
    touch targets and reduced motion are all verified automatically; testing with real
    assistive technology and real learners is still required.

## 15. Data and update workflow

To publish a new catalogue snapshot:

1. Replace `data/source/catalog_staging.json` and `catalog_audit.json`.
2. Run `npm run prepare:catalogue`.
3. Read the console summary, then inspect `quarantined` and `rejected` in the generated
   release. Resolve conflicts with the course owner; do not merge them away.
4. Run `npm test`. The publication tests will fail if the release stops reconciling with
   its source audit, or if a fact absent from the source starts appearing in the release.
5. Commit the generated release and the updated manifest.
6. Deploy, confirm `/api/v1/health/ready` names the new release, then shift traffic.

To change what the pipeline is allowed to derive, edit `scripts/editorial-rules.mjs`. It
is deliberately the only place such a change can be made, and every rule in it carries the
ambiguity-register entry it stands in for.

---

## Supplied material

`docs/` holds the supplied package documents unchanged: the service blueprint, the
developer handoff, the questionnaire notes, the verification record and the reference
engine's own README. `data/source/` holds the supplied data unchanged.
