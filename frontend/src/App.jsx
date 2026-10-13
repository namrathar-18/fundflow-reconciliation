import React, { useState, useEffect, useCallback } from 'react';
import './index.css';
import {
  fetchOrganizations,
  fetchTransactions,
  fetchLineItems,
  setOrganization,
} from './api';
import UploadSection from './components/UploadSection';
import TransactionTable from './components/TransactionTable';
import LineItemPanel from './components/LineItemPanel';
import Toast from './components/Toast';
import {
  IconBolt,
  IconBuilding,
  IconRefresh,
  IconChevronDown,
} from './components/Icons';

export default function App() {
  const [organizations, setOrganizations] = useState([]);
  const [currentOrg, setCurrentOrg] = useState('northwind');

  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState(null);

  const [lineItems, setLineItems] = useState([]);
  const [liLoading, setLiLoading] = useState(false);
  const [liError, setLiError] = useState(null);

  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Load organizations on mount
  useEffect(() => {
    fetchOrganizations()
      .then((orgs) => {
        setOrganizations(orgs);
      })
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
    addToast({
      type: 'info',
      title: 'Tenant Switched',
      message: `Active organization context changed to ${slug}.`,
    });
  };

  // Load transactions
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
  }, []);

  // Load line items
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
  }, []);

  const refreshAll = useCallback(() => {
    loadTransactions();
    loadLineItems();
  }, [loadTransactions, loadLineItems]);

  useEffect(() => {
    refreshAll();
  }, [currentOrg, refreshAll]);

  // Live KPI Summary
  const suggestedCount = transactions.filter((t) => t.status === 'suggested').length;
  const needsReviewCount = transactions.filter((t) => t.status === 'needs_review').length;
  const reconciledCount = transactions.filter((t) => t.status === 'reconciled').length;

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="brand-icon-box">
            <IconBolt size={20} />
          </div>
          <div>
            <div className="brand-title">
              FundFlow
              <span className="brand-badge">PRO</span>
            </div>
            <div className="brand-tagline">Capital Call Reconciliation</div>
          </div>
        </div>

        {/* Live KPI Indicators */}
        <div className="header-stats">
          {suggestedCount > 0 && (
            <div className="stat-pill">
              <span className="stat-dot blue" />
              <span className="num">{suggestedCount}</span>
              <span className="label">suggested</span>
            </div>
          )}
          {needsReviewCount > 0 && (
            <div className="stat-pill">
              <span className="stat-dot amber" />
              <span className="num">{needsReviewCount}</span>
              <span className="label">needs review</span>
            </div>
          )}
          {reconciledCount > 0 && (
            <div className="stat-pill">
              <span className="stat-dot green" />
              <span className="num">{reconciledCount}</span>
              <span className="label">reconciled</span>
            </div>
          )}
        </div>

        {/* Right side: Refresh & Org switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn btn-ghost"
            onClick={refreshAll}
            disabled={txLoading || liLoading}
            title="Refresh current ledger"
          >
            {txLoading || liLoading ? (
              <span className="spinner" style={{ width: 12, height: 12 }} />
            ) : (
              <IconRefresh size={14} />
            )}
            Sync
          </button>

          <div className="org-switcher-wrap">
            <span className="org-switcher-icon">
              <IconBuilding size={16} />
            </span>
            <select
              id="org-switcher"
              className="org-select-custom"
              value={currentOrg}
              onChange={(e) => switchOrg(e.target.value)}
            >
              {organizations.map((org) => (
                <option key={org.slug} value={org.slug}>
                  {org.name}
                </option>
              ))}
            </select>
            <IconChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="main">
        {/* Bank Statement Upload Card */}
        <UploadSection onImported={refreshAll} onToast={addToast} />

        {/* Two-Column Grid */}
        <div className="content-grid">
          {/* Left Column: Bank Transactions Table */}
          <div>
            <TransactionTable
              transactions={transactions}
              loading={txLoading}
              error={txError}
              onRefresh={refreshAll}
              onToast={addToast}
            />
          </div>

          {/* Right Column: Capital Call Line Items */}
          <div>
            <LineItemPanel
              lineItems={lineItems}
              loading={liLoading}
              error={liError}
              onRefresh={loadLineItems}
            />
          </div>
        </div>
      </main>

      {/* Floating Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
