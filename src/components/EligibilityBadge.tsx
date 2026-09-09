import type { EntryCheckState } from '@/types/results';

/**
 * The three entry states from the blueprint. These describe the information supplied
 * so far. None of them is an admission decision, and none says a learner is eligible.
 */
const STATES: Record<EntryCheckState, { label: string; className: string; detail: string }> = {
  appears_to_meet: {
    label: 'Appears to meet the listed checks',
    className: 'badge badge--meet',
    detail: 'Based on your answers you appear to meet the entry requirements we hold. The college confirms this.'
  },
  check_needed: {
    label: 'Entry requirements to check',
    className: 'badge badge--check',
    detail: 'We need to check an entry requirement with you before enrolment.'
  },
  pathway_needed: {
    label: 'Another step is needed first',
    className: 'badge badge--pathway',
    detail: 'An entry requirement is not met yet. Check a preparation route or speak to an adviser.'
  }
};

export function EligibilityBadge({ state, showDetail = false }: { state: EntryCheckState; showDetail?: boolean }) {
  const config = STATES[state];
  return (
    <>
      <span className={config.className}>
        <span className="badge__dot" aria-hidden="true" />
        {config.label}
      </span>
      {showDetail ? <p className="note">{config.detail}</p> : null}
    </>
  );
}

export function entryStateDetail(state: EntryCheckState): string {
  return STATES[state].detail;
}
