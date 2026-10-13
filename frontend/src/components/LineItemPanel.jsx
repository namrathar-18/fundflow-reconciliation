import { formatMoney, lineItemStatusMeta, fundedPercent } from '../utils';

/**
 * Line items panel showing funded progress per LP.
 */
export default function LineItemPanel({ lineItems, loading, error, onRefresh }) {
  if (loading) {
    return (
      <div className="card line-items-panel">
        <div className="state-container" style={{ padding: '2rem' }}>
          <div className="spinner" />
          <span className="state-title" style={{ fontSize: '0.82rem' }}>Loading…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card line-items-panel">
        <div className="state-container" style={{ padding: '1.5rem' }}>
          <div className="state-icon" style={{ fontSize: '1.5rem' }}>⚠</div>
          <span className="state-title">Error loading line items</span>
          <button className="btn btn-primary" onClick={onRefresh} style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!lineItems || lineItems.length === 0) {
    return (
      <div className="card line-items-panel">
        <div className="state-container" style={{ padding: '2rem' }}>
          <div className="state-icon" style={{ fontSize: '1.5rem' }}>📋</div>
          <span className="state-title">No line items</span>
          <span className="state-desc" style={{ fontSize: '0.75rem' }}>
            Run seed_demo to load sample data
          </span>
        </div>
      </div>
    );
  }

  // Group line items by capital_call_id
  const grouped = {};
  for (const li of lineItems) {
    const key = li.capital_call_id;
    if (!grouped[key]) grouped[key] = { callDate: li.call_date, dueDate: li.due_date, items: [] };
    grouped[key].items.push(li);
  }

  return (
    <div className="card line-items-panel">
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div className="section-header" style={{ marginBottom: 0 }}>
          <span className="section-title">
            📋 Line Items
          </span>
          <span className="section-badge">{lineItems.length}</span>
        </div>
      </div>

      {/* Grouped by capital call */}
      {Object.entries(grouped).map(([callId, { callDate, dueDate, items }]) => (
        <div key={callId}>
          <div className="call-group">
            <div className="call-group-label">
              Call #{callId} · {callDate} → {dueDate}
            </div>
          </div>
          {items.map(li => (
            <LineItemRow key={li.id} li={li} />
          ))}
        </div>
      ))}
    </div>
  );
}

function LineItemRow({ li }) {
  const meta = lineItemStatusMeta(li.status);
  const pct = fundedPercent(li.amount_called, li.amount_funded);

  return (
    <div className="line-item-card">
      <div className="line-item-header">
        <div>
          <div className="line-item-investor">{li.investor_name}</div>
          <div className="line-item-ref">{li.wire_reference}</div>
        </div>
        <span className={`badge ${meta.cls}`} style={{ flexShrink: 0 }}>
          {meta.icon} {meta.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar-wrap">
        <div
          className={`progress-bar-fill ${li.status}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Amounts */}
      <div className="line-item-amounts">
        <div className="amount-group">
          <span className="label">Called</span>
          <span className="value amount-called-val">{formatMoney(li.amount_called)}</span>
        </div>
        <div className="amount-group">
          <span className="label">Funded</span>
          <span className="value amount-funded-val">{formatMoney(li.amount_funded)}</span>
        </div>
        <div className="amount-group">
          <span className="label">Remaining</span>
          <span className="value amount-remaining-val">{formatMoney(li.amount_remaining)}</span>
        </div>
      </div>
    </div>
  );
}
