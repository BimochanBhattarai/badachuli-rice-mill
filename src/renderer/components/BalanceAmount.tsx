import { useLanguage } from '../i18n'

const EPS = 0.005

/**
 * The single rendering for a customer balance.
 *
 * Previously each screen formatted this itself and they disagreed: the Reports
 * Customer Balance table rendered any non-positive balance as "—", which made a
 * customer holding credit look identical to one at zero and hid real liability.
 *
 * Positive = customer owes (red). Negative = customer in credit (green).
 * Zero = a dash.
 */
export function BalanceAmount({ value }: { value: number }) {
  const { t, fmtAmt } = useLanguage()

  if (value > EPS) {
    return <span className="stock-zero">{fmtAmt(value)}</span>
  }
  if (value < -EPS) {
    return (
      <span style={{ color: '#15803d', fontWeight: 700 }}>
        {t('customer.credit')}: {fmtAmt(Math.abs(value))}
      </span>
    )
  }
  return <span className="text-muted">—</span>
}
