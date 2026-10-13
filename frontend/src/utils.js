/**
 * Utility functions for FundFlow UI.
 */

/**
 * Format a number as USD currency string.
 * @param {string|number} value
 * @returns {string}
 */
export function formatMoney(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Math.abs(num));
}

/**
 * Format an ISO date string as a readable date.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Get the dot indicator and label for a transaction status.
 */
export function statusMeta(status) {
  const map = {
    suggested: { icon: '●', label: 'Suggested', cls: 'badge-suggested' },
    needs_review: { icon: '◉', label: 'Needs Review', cls: 'badge-needs_review' },
    reconciled: { icon: '✓', label: 'Reconciled', cls: 'badge-reconciled' },
    ignored: { icon: '○', label: 'Ignored', cls: 'badge-ignored' },
  };
  return map[status] || { icon: '?', label: status, cls: 'badge-ignored' };
}

/**
 * Get badge metadata for a line item status.
 */
export function lineItemStatusMeta(status) {
  const map = {
    open: { icon: '○', label: 'Open', cls: 'badge-open' },
    partially_funded: { icon: '◑', label: 'Partial', cls: 'badge-partially_funded' },
    funded: { icon: '●', label: 'Funded', cls: 'badge-funded' },
  };
  return map[status] || { icon: '?', label: status, cls: 'badge-open' };
}

/**
 * Compute funded percentage for progress bar.
 */
export function fundedPercent(called, funded) {
  const c = parseFloat(called);
  const f = parseFloat(funded);
  if (!c) return 0;
  return Math.min(100, (f / c) * 100);
}
