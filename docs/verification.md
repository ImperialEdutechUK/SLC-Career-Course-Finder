# Verification record

Checked 9 September 2026.

## Completed

- Read-only extraction and audit of the supplied workbook. Master rows 4–398 yield 395 records, 394 distinct URLs and 388 distinct titles. All rows have a source course hyperlink. Counts reconcile to 16 primary categories. Both duplicate-URL records retain their original awarding-body labels and row locations.
- Visually inspected all six pages of the supplied Coursera PDF. It is an image capture, so text extraction alone could not represent its content.
- Read current public benchmark, UK learner research, SLC course examples and official deployment/privacy/accessibility sources. Publication scope and method limitations appear in the report. Authenticated competitor assessments were not completed.
- Reference engine version 0.2.0: **34 automated tests passed**. Tests cover budget caps including zero, missing price/requirements, three-valued AND/OR logic, higher-level prerequisites, duplicate quarantine, approved/active/expiry checks, regulated-only filtering, strict requests, approved specific goals, HTTPS/host validation, deterministic ordering and non-mutation.
- Interactive concept: both routes, required-answer errors, exclusive uncertainty choices, conservative purpose reuse, zero budget, subject filtering, Back, optional skipping and all-unknown career results were exercised. Light/dark layouts at 360 and 736 pixels were checked for horizontal overflow. No JavaScript page errors were observed.
- Report: all 17 rendered PDF pages visually inspected. Tables, typography, source links and pagination checked. Source entries are split across two readable pages.
- Package integrity: JSON files parsed, record/identifier counts checked, no original source files modified, and archive contents inspected.

## Not established by these checks

- No complete live catalogue, current 500+ course count, qualification-register audit or final admissions policy is verified.
- No learner or adviser validation of the proposed weights, question wording, career map or ranking thresholds has been performed.
- No end-to-end production application, hosting, database, live CMS/API, CRM/email delivery, consent system or AI explanation service is implemented or deployed.
- Prototype browser checks are not a WCAG conformance audit or assistive-technology evaluation.
- Passing reference tests does not prove course suitability, regulatory accuracy, security of a future application, or improved enrolment/completion outcomes.

The report and developer specification define the additional launch evidence required.
