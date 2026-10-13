import { useState } from 'react';
import { approveMatch, rejectMatch, ignoreTransaction } from '../api';
import { formatMoney, formatDate, statusMeta } from '../utils';

/**
 * Transaction table with match actions.
 */
export default function TransactionTable({ transactions, loading, error, onRefresh }) {
  const [pendingAction, setPendingAction] = useState(null); // { type, id }

  const isLoading = (type, id) =>
    pendingAction?.type === type && pendingAction?.id === id;

  const handleApprove = async (matchId) => {
    setPendingAction({ type: 'approve', id: matchId });
    try {
      await approveMatch(matchId);
      onRefresh?.();
    } catch (err) {
      alert(`Approve failed: ${err.message}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleReject = async (matchId) => {
    setPendingAction({ type: 'reject', id: matchId });
    try {
      await rejectMatch(matchId);
      onRefresh?.();
    } catch (err) {
      alert(`Reject failed: ${err.message}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleIgnore = async (txId) => {
    setPendingAction({ type: 'ignore', id: txId });
    try {
      await ignoreTransaction(txId);
      onRefresh?.();
    } catch (err) {
      alert(`Ignore failed: ${err.message}`);
    } finally {
      setPendingAction(null);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="state-container">
          <div className="spinner" />
          <span className="state-title">Loading transactions…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="state-container">
          <div className="state-icon">⚠</div>
          <span className="state-title">Failed to load transactions</span>
          <span className="state-desc">{error}</span>
          <button className="btn btn-primary" onClick={onRefresh}>Retry</button>
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="card">
        <div className="state-container">
          <div className="state-icon">📭</div>
          <span className="state-title">No transactions yet</span>
          <span className="state-desc">Import a bank statement CSV to get started</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description / Ref</th>
              <th className="text-right">Amount</th>
              <th>Status</th>
              <th>Investor / Wire Ref</th>
              <th>Match Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const meta = statusMeta(tx.status);
              const proposed = tx.matches?.filter(m => m.status === 'proposed') || [];
              const isCredit = tx.transaction_type === 'credit';

              return (
                <tr key={tx.id}>
                  {/* Date */}
                  <td className="date-cell">{formatDate(tx.date)}</td>

                  {/* Description */}
                  <td className="description-cell">
                    <div className="description-text" title={tx.description}>
                      {tx.description}
                    </div>
                    <div className="bank-ref">{tx.bank_reference}</div>
                  </td>

                  {/* Amount */}
                  <td className="amount-cell">
                    <span className={tx.amount >= 0 ? 'amount-positive' : 'amount-negative'}>
                      {tx.amount < 0 ? '-' : '+'}{formatMoney(tx.amount)}
                    </span>
                  </td>

                  {/* Status */}
                  <td>
                    <span className={`badge ${meta.cls}`}>
                      {meta.icon} {meta.label}
                    </span>
                  </td>

                  {/* Investor / Reference */}
                  <td className="investor-cell">
                    {tx.suggested_investor ? (
                      <>
                        <div className="investor-name" title={tx.suggested_investor}>
                          {tx.suggested_investor}
                        </div>
                        <div className="wire-ref">{tx.suggested_reference}</div>
                      </>
                    ) : proposed.length > 1 ? (
                      <span className="badge badge-needs_review">
                        {proposed.length} candidates
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                    )}
                  </td>

                  {/* Match reason */}
                  <td className="reason-cell" title={tx.match_reason || tx.review_reason}>
                    {tx.match_reason || tx.review_reason || '—'}
                  </td>

                  {/* Actions */}
                  <td>
                    <ActionButtons
                      tx={tx}
                      proposed={proposed}
                      isCredit={isCredit}
                      pendingAction={pendingAction}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onIgnore={handleIgnore}
                      isLoading={isLoading}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionButtons({ tx, proposed, isCredit, pendingAction, onApprove, onReject, onIgnore, isLoading }) {
  const anyBusy = pendingAction !== null;

  // Reconciled → no actions
  if (tx.status === 'reconciled') {
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>✓ Done</span>;
  }

  // Ignored / debit → no actions
  if (tx.status === 'ignored' || tx.transaction_type === 'debit') {
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>;
  }

  // suggested → one clear proposed match
  if (tx.status === 'suggested' && proposed.length === 1) {
    const match = proposed[0];
    return (
      <div className="actions-cell">
        <button
          id={`approve-${match.id}`}
          className="btn btn-approve"
          disabled={anyBusy}
          onClick={() => onApprove(match.id)}
        >
          {isLoading('approve', match.id) ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '✓'}
          {' '}Approve
        </button>
        <button
          id={`reject-${match.id}`}
          className="btn btn-reject"
          disabled={anyBusy}
          onClick={() => onReject(match.id)}
        >
          {isLoading('reject', match.id) ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '✕'}
          {' '}Reject
        </button>
        <button
          id={`ignore-${tx.id}`}
          className="btn btn-ignore"
          disabled={anyBusy}
          onClick={() => onIgnore(tx.id)}
        >
          Ignore
        </button>
      </div>
    );
  }

  // needs_review with multiple proposed matches
  if (tx.status === 'needs_review' && proposed.length > 1) {
    return (
      <div className="match-actions-list">
        {proposed.map(m => (
          <div key={m.id} className="match-action-row">
            <span className="match-ref">{m.wire_reference}</span>
            <button
              id={`approve-${m.id}`}
              className="btn btn-approve"
              disabled={anyBusy}
              onClick={() => onApprove(m.id)}
              style={{ fontSize: '0.7rem', padding: '3px 6px' }}
            >
              {isLoading('approve', m.id) ? <span className="spinner" style={{ width: 8, height: 8 }} /> : '✓'}
            </button>
            <button
              id={`reject-${m.id}`}
              className="btn btn-reject"
              disabled={anyBusy}
              onClick={() => onReject(m.id)}
              style={{ fontSize: '0.7rem', padding: '3px 6px' }}
            >
              {isLoading('reject', m.id) ? <span className="spinner" style={{ width: 8, height: 8 }} /> : '✕'}
            </button>
          </div>
        ))}
        <button
          id={`ignore-${tx.id}`}
          className="btn btn-ignore"
          disabled={anyBusy}
          onClick={() => onIgnore(tx.id)}
          style={{ fontSize: '0.7rem', padding: '3px 6px', marginTop: '2px' }}
        >
          Ignore all
        </button>
      </div>
    );
  }

  // needs_review with no matches → only ignore
  if (tx.status === 'needs_review') {
    return (
      <div className="actions-cell">
        <button
          id={`ignore-${tx.id}`}
          className="btn btn-ignore"
          disabled={anyBusy}
          onClick={() => onIgnore(tx.id)}
        >
          {isLoading('ignore', tx.id) ? <span className="spinner" style={{ width: 10, height: 10 }} /> : null}
          Ignore
        </button>
      </div>
    );
  }

  return null;
}
