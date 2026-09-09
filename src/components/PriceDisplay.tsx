import styles from './PriceDisplay.module.css';
import type { BudgetCheck } from '@/types/results';

/**
 * Price presentation.
 *
 * An unknown price is stated as unknown. It is never rendered as £0, never described
 * as free, and never described as within budget. A verified total is labelled as the
 * full compulsory cost so an instalment cannot be mistaken for it.
 */
export function PriceDisplay({
  priceGbp, budgetCheck
}: { priceGbp: number | null; budgetCheck?: BudgetCheck }) {
  if (priceGbp === null) {
    return (
      <div className={styles.wrap}>
        <span className={styles.label}>Total price</span>
        <span className={styles.unknown}>Not confirmed yet</span>
        <span className={styles.note}>
          {budgetCheck?.status === 'check_needed'
            ? `We hold no verified total for this course, so we cannot compare it with your £${budgetCheck.capGbp?.toLocaleString('en-GB')} limit.`
            : 'We hold no verified total for this course. Check the price on the course page before you enrol.'}
        </span>
      </div>
    );
  }
  const formatted = priceGbp.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 });
  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Total price</span>
      <span className={styles.amount}>{formatted}</span>
      <span className={styles.note}>
        Full compulsory cost, not a monthly instalment.
        {budgetCheck?.status === 'within_cap' && budgetCheck.capGbp !== undefined
          ? ` Within the £${budgetCheck.capGbp.toLocaleString('en-GB')} limit you set.`
          : ''}
      </span>
    </div>
  );
}
