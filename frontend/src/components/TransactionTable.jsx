import React, { useState, useMemo } from 'react';
import { approveMatch, rejectMatch, ignoreTransaction } from '../api';
import { formatMoney, formatDate, statusMeta } from '../utils';
import {
  IconCheck,
  IconX,
  IconEyeOff,
  IconSearch,
  IconAlertTriangle,
  IconFileText,
  IconSparkles,
} from './Icons';

export default function TransactionTable({ transactions, loading, error, onRefresh, onToast }) {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // { type, id }

  const isLoading = (type, id) =>
    pendingAction?.type === type && pendingAction?.id === id;

  // Counts for tabs
  const counts = useMemo(() => {
    const list = transactions || [];
    return {
      all: list.length,
      suggested: list.filter(t => t.status === 'suggested').length,
      needs_review: list.filter(t => t.status === 'needs_review').length,
      reconciled: list.filter(t => t.status === 'reconciled').length,
      ignored: list.filter(t => t.status === 'ignored').length,
    };
  }, [transactions]);

  // Filtered transactions
  const filtered = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(tx => {
      // Tab filter
      if (activeTab !== 'all' && tx.status !== activeTab) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = tx.description?.toLowerCase().includes(q);
        const matchesRef = tx.bank_reference?.toLowerCase().includes(q);
        const matchesInvestor = tx.suggested_investor?.toLowerCase().includes(q);
        const matchesWire = tx.suggested_reference?.toLowerCase().includes(q);
        const matchesAmount = tx.amount?.toString().includes(q);
        return matchesDesc || matchesRef || matchesInvestor || matchesWire || matchesAmount;
      }
      return true;
    });
  }, [transactions, activeTab, searchQuery]);

  const handleApprove = async (matchId, investorName, amount) => {
    setPendingAction({ type: 'approve', id: matchId });
    try {
      await approveMatch(matchId);
      onToast?.({
        type: 'success',
        title: 'Match Reconciled',
        message: `Approved payment for ${investorName || 'LP'} (${formatMoney(amount)})`,
      });
      onRefresh?.();
    } catch (err) {
      onToast?.({
        type: 'error',
        title: 'Approval Failed',
        message: err.message,
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleReject = async (matchId) => {
    setPendingAction({ type: 'reject', id: matchId });
    try {
      await rejectMatch(matchId);
      onToast?.({
        type: 'info',
        title: 'Match Rejected',
        message: 'Transaction returned to unmatched status.',
      });
      onRefresh?.();
    } catch (err) {
      onToast?.({
        type: 'error',
        title: 'Reject Failed',
        message: err.message,
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleIgnore = async (txId) => {
    setPendingAction({ type: 'ignore', id: txId });
    try {
      await ignoreTransaction(txId);
      onToast?.({
        type: 'info',
        title: 'Transaction Ignored',
        message: 'Marked as non-capital-call line item.',
      });
      onRefresh?.();
    } catch (err) {
      onToast?.({
        type: 'error',
        title: 'Action Failed',
        message: err.message,
      });
    } finally {
      setPendingAction(null);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="state-container">
          <div className="spinner" />
          <span className="state-title">Retrieving transactions…</span>
          <span className="state-desc">Fetching scoped tenant ledger from database</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="state-container">
          <div className="state-icon-box" style={{ color: 'var(--rose-400)' }}>
            <IconAlertTriangle size={24} />
          </div>
          <span className="state-title">Failed to load transactions</span>
          <span className="state-desc">{error}</span>
          <button className="btn btn-primary" onClick={onRefresh} style={{ marginTop: '6px' }}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="card">
        <div className="state-container">
          <div className="state-icon-box">
            <IconFileText size={24} />
          </div>
          <span className="state-title">No transactions imported yet</span>
          <span className="state-desc">Drop your bank statement CSV above to generate automated suggestions</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Toolbar: Filters & Search */}
      <div className="table-toolbar">
        <div className="filter-tabs">
          <button
            className={`filter-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All <span className="tab-count">{counts.all}</span>
          </button>
          <button
            className={`filter-tab ${activeTab === 'suggested' ? 'active' : ''}`}
            onClick={() => setActiveTab('suggested')}
          >
            Suggested <span className="tab-count">{counts.suggested}</span>
          </button>
          <button
            className={`filter-tab ${activeTab === 'needs_review' ? 'active' : ''}`}
            onClick={() => setActiveTab('needs_review')}
          >
            Needs Review <span className="tab-count">{counts.needs_review}</span>
          </button>
          <button
            className={`filter-tab ${activeTab === 'reconciled' ? 'active' : ''}`}
            onClick={() => setActiveTab('reconciled')}
          >
            Reconciled <span className="tab-count">{counts.reconciled}</span>
          </button>
          <button
            className={`filter-tab ${activeTab === 'ignored' ? 'active' : ''}`}
            onClick={() => setActiveTab('ignored')}
          >
            Ignored <span className="tab-count">{counts.ignored}</span>
          </button>
        </div>

        <div className="search-box">
          <IconSearch size={14} />
          <input
            type="text"
            className="search-input"
            placeholder="Filter payments…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Wire Description / Ref</th>
              <th>Amount</th>
              <th>Status</th>
              <th>LP Allocation</th>
              <th>Reconciliation Intelligence</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  No transactions match the selected filter criteria.
                </td>
              </tr>
            ) : (
              filtered.map((tx) => {
                const meta = statusMeta(tx.status);
                const proposed = tx.matches?.filter(m => m.status === 'proposed') || [];
                const isPositive = parseFloat(tx.amount) >= 0;

                return (
                  <tr key={tx.id}>
                    {/* Date */}
                    <td className="date-cell">{formatDate(tx.date)}</td>

                    {/* Description */}
                    <td className="desc-cell">
                      <div className="desc-text" title={tx.description}>
                        {tx.description}
                      </div>
                      <div className="bank-ref">{tx.bank_reference}</div>
                    </td>

                    {/* Amount */}
                    <td className="amount-cell">
                      <span className={isPositive ? 'amount-positive' : 'amount-negative'}>
                        {isPositive ? '+' : '-'}{formatMoney(tx.amount)}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`badge ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </td>

                    {/* LP Allocation */}
                    <td>
                      {tx.suggested_investor ? (
                        <div>
                          <div className="investor-title" title={tx.suggested_investor}>
                            {tx.suggested_investor}
                          </div>
                          <span className="wire-ref">{tx.suggested_reference}</span>
                        </div>
                      ) : proposed.length > 1 ? (
                        <span className="badge badge-needs_review">
                          {proposed.length} Candidates
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>Unassigned</span>
                      )}
                    </td>

                    {/* Match Reason */}
                    <td>
                      <div className="reason-box" title={tx.match_reason || tx.review_reason}>
                        {tx.match_reason || tx.review_reason || 'Manual review required'}
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td style={{ textAlign: 'right' }}>
                      <ActionButtons
                        tx={tx}
                        proposed={proposed}
                        pendingAction={pendingAction}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onIgnore={handleIgnore}
                        isLoading={isLoading}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionButtons({ tx, proposed, pendingAction, onApprove, onReject, onIgnore, isLoading }) {
  const isBusy = pendingAction !== null;

  if (tx.status === 'reconciled') {
    return (
      <span style={{ color: 'var(--emerald-400)', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <IconCheck size={14} /> Reconciled
      </span>
    );
  }

  if (tx.status === 'ignored' || tx.transaction_type === 'debit') {
    return (
      <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
        Ignored
      </span>
    );
  }

  if (tx.status === 'suggested' && proposed.length === 1) {
    const match = proposed[0];
    return (
      <div className="actions-group" style={{ justifyContent: 'flex-end' }}>
        <button
          id={`approve-${match.id}`}
          className="btn btn-approve"
          disabled={isBusy}
          onClick={() => onApprove(match.id, tx.suggested_investor, tx.amount)}
        >
          {isLoading('approve', match.id) ? (
            <span className="spinner" style={{ width: 10, height: 10 }} />
          ) : (
            <IconCheck size={13} />
          )}
          Approve
        </button>
        <button
          id={`reject-${match.id}`}
          className="btn btn-reject"
          disabled={isBusy}
          onClick={() => onReject(match.id)}
        >
          {isLoading('reject', match.id) ? (
            <span className="spinner" style={{ width: 10, height: 10 }} />
          ) : (
            <IconX size={13} />
          )}
          Reject
        </button>
        <button
          id={`ignore-${tx.id}`}
          className="btn btn-ignore"
          disabled={isBusy}
          onClick={() => onIgnore(tx.id)}
          title="Ignore transaction"
        >
          <IconEyeOff size={13} />
        </button>
      </div>
    );
  }

  if (tx.status === 'needs_review' && proposed.length > 1) {
    return (
      <div className="actions-group" style={{ justifyContent: 'flex-end' }}>
        <button
          id={`ignore-${tx.id}`}
          className="btn btn-ignore"
          disabled={isBusy}
          onClick={() => onIgnore(tx.id)}
        >
          Ignore
        </button>
      </div>
    );
  }

  return (
    <div className="actions-group" style={{ justifyContent: 'flex-end' }}>
      <button
        id={`ignore-${tx.id}`}
        className="btn btn-ignore"
        disabled={isBusy}
        onClick={() => onIgnore(tx.id)}
      >
        Ignore
      </button>
    </div>
  );
}
