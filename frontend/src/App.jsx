import { useState, useEffect, useCallback } from 'react';
import './index.css';
import {
  fetchOrganizations,
  fetchTransactions,
  fetchLineItems,
  setOrganization,
  getOrganization,
} from './api';
import UploadSection from './components/UploadSection';
import TransactionTable from './components/TransactionTable';
import LineItemPanel from './components/LineItemPanel';

export default function App() {
  const [organizations, setOrganizations] = useState([]);
  const [currentOrg, setCurrentOrg] = useState('northwind');

  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState(null);

  const [lineItems, setLineItems] = useState([]);
  const [liLoading, setLiLoading] = useState(false);
  const [liError, setLiError] = useState(null);

  // Load organizations on mount (with a fallback list if backend is unavailable)
  useEffect(() => {
    fetchOrganizations()
      .then(setOrganizations)
      .catch(() => {
        setOrganizations([
          { slug: 'northwind', name: 'Northwind Ventures' },
          { slug: 'bluebird', name: 'Bluebird Capital' },
        ]);
      });
  }, []);

  // Switch organization
  const switchOrg = (slug) => {
    setOrganization(slug);
    setCurrentOrg(slug);
    setTransactions([]);
    setLineItems([]);
  };

  // Load data for current org
  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    setTxError(null);
    try {
      const data = await fetchTransactions();
      setTransactions(data);
    } catch (err) {
      setTxError(err.message);
    } finally {
      setTxLoading(false);
    }
  }, [currentOrg]);

  const loadLineItems = useCallback(async () => {
    setLiLoading(true);
    setLiError(null);
    try {
      const data = await fetchLineItems();
      setLineItems(data);
    } catch (err) {
      setLiError(err.message);
    } finally {
      setLiLoading(false);
    }
  }, [currentOrg]);

  const refreshAll = useCallback(() => {
    loadTransactions();
    loadLineItems();
  }, [loadTransactions, loadLineItems]);

  useEffect(() => {
    refreshAll();
  }, [currentOrg]);

  // Stats for header
  const needsReview = transactions.filter(t => t.status === 'needs_review').length;
  const suggested = transactions.filter(t => t.status === 'suggested').length;
  const reconciled = transactions.filter(t => t.status === 'reconciled').length;

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="brand-icon">⚡</div>
          <div>
            <div className="brand-name">FundFlow</div>
            <div className="brand-tagline">Capital Call Reconciliation</div>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          {suggested > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#60a5fa' }}>
              <span style={{ fontWeight: 700 }}>{suggested}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>suggested</span>
            </div>
          )}
          {needsReview > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
              <span style={{ fontWeight: 700 }}>{needsReview}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>needs review</span>
            </div>
          )}
          {reconciled > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#34d399' }}>
              <span style={{ fontWeight: 700 }}>{reconciled}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>reconciled</span>
            </div>
          )}
        </div>

        {/* Org switcher */}
        <div className="org-switcher">
          <span className="org-label">Organization</span>
          <select
            id="org-switcher"
            className="org-select"
            value={currentOrg}
            onChange={(e) => switchOrg(e.target.value)}
          >
            {organizations.map(org => (
              <option key={org.slug} value={org.slug}>{org.name}</option>
            ))}
          </select>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="main">
        {/* Upload */}
        <UploadSection onImported={refreshAll} />

        {/* Transactions + Line Items */}
        <div className="content-grid">
          {/* Left: Transactions */}
          <div>
            <div className="section-header">
              <span className="section-title">
                💳 Transactions
                {transactions.length > 0 && (
                  <span className="section-badge">{transactions.length}</span>
                )}
              </span>
              <button
                className="btn btn-ghost"
                id="refresh-btn"
                onClick={refreshAll}
                disabled={txLoading || liLoading}
              >
                {(txLoading || liLoading) ? (
                  <span className="spinner" style={{ width: 10, height: 10 }} />
                ) : '↻'} Refresh
              </button>
            </div>
            <TransactionTable
              transactions={transactions}
              loading={txLoading}
              error={txError}
              onRefresh={refreshAll}
            />
          </div>

          {/* Right: Line Items */}
          <div>
            <div className="section-header">
              <span className="section-title">
                📋 Capital Call Line Items
              </span>
            </div>
            <LineItemPanel
              lineItems={lineItems}
              loading={liLoading}
              error={liError}
              onRefresh={loadLineItems}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
