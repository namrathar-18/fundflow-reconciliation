import React from 'react';
import { formatMoney, lineItemStatusMeta, fundedPercent } from '../utils';
import { IconFileText, IconCalendar, IconAlertTriangle } from './Icons';

export default function LineItemPanel({ lineItems, loading, error, onRefresh }) {
  if (loading) {
    return (
      <div className="card line-items-panel">
        <div className="state-container">
          <div className="spinner" />
          <span className="state-title">Loading LP Allocations…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card line-items-panel">
        <div className="state-container">
          <div className="state-icon-box" style={{ color: 'var(--rose-400)' }}>
            <IconAlertTriangle size={24} />
          </div>
          <span className="state-title">Failed to load line items</span>
          <span className="state-desc">{error}</span>
          <button className="btn btn-primary" onClick={onRefresh} style={{ marginTop: '6px' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!lineItems || lineItems.length === 0) {
    return (
      <div className="card line-items-panel">
        <div className="state-container">
          <div className="state-icon-box">
            <IconFileText size={24} />
          </div>
          <span className="state-title">No Capital Call Line Items</span>
          <span className="state-desc">No active capital calls found for this organization.</span>
        </div>
      </div>
    );
  }

  // Group line items by capital_call_id
  const grouped = {};
  for (const li of lineItems) {
    const key = li.capital_call_id;
    if (!grouped[key]) {
      grouped[key] = {
        callId: key,
        callDate: li.call_date,
        dueDate: li.due_date,
        items: [],
      };
    }
    grouped[key].items.push(li);
  }

  return (
    <div className="card line-items-panel">
      <div className="card-header">
        <div className="card-header-left">
          <span className="card-title">
            <span className="card-title-icon"><IconFileText size={18} /></span>
            LP Capital Call Ledger
          </span>
        </div>
        <span className="badge-counter">{lineItems.length} Allocations</span>
      </div>

      {/* Grouped by capital call */}
      {Object.values(grouped).map(({ callId, callDate, dueDate, items }) => (
        <div key={callId}>
          <div className="call-group-header">
            <span className="call-group-tag">Capital Call #{callId}</span>
            <span className="call-dates-badge">
              Issued: {callDate} · Due: {dueDate}
            </span>
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
  const pct = Math.round(fundedPercent(li.amount_called, li.amount_funded));
  const isFullyFunded = li.status === 'funded' || pct >= 100;

  return (
    <div className="lp-row-card">
      <div className="lp-meta-row">
        <div>
          <div className="lp-name">{li.investor_name}</div>
          <span className="wire-ref">{li.wire_reference}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`badge ${meta.cls}`}>
            {meta.label}
          </span>
          <div className="num-mono" style={{ fontSize: '0.72rem', color: isFullyFunded ? 'var(--emerald-400)' : 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
            {pct}% funded
          </div>
        </div>
      </div>

      {/* Progress track */}
      <div className="progress-track">
        <div
          className={`progress-fill ${li.status}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 3-tier financial breakdown */}
      <div className="amounts-breakdown">
        <div className="amount-unit">
          <span className="sub-label">Called</span>
          <span className="sub-val">{formatMoney(li.amount_called)}</span>
        </div>
        <div className="amount-unit funded">
          <span className="sub-label">Funded</span>
          <span className="sub-val">{formatMoney(li.amount_funded)}</span>
        </div>
        <div className="amount-unit remaining">
          <span className="sub-label">Remaining</span>
          <span className="sub-val">{formatMoney(li.amount_remaining)}</span>
        </div>
      </div>
    </div>
  );
}
