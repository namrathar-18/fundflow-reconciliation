/**
 * API client for FundFlow backend.
 * All requests include X-Organization header.
 */

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:8000/api'
    : '/api');

let currentOrg = 'northwind';

export function setOrganization(slug) {
  currentOrg = slug;
}

export function getOrganization() {
  return currentOrg;
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'X-Organization': currentOrg,
    ...options.headers,
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch (_) {}
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

// Organizations
export async function fetchOrganizations() {
  // Organizations endpoint doesn't need X-Organization strictly,
  // but we send it anyway (will still work as long as org exists)
  const url = `${BASE_URL}/organizations/`;
  const res = await fetch(url, {
    headers: { 'X-Organization': currentOrg },
  });
  if (!res.ok) throw new Error('Failed to load organizations');
  return res.json();
}

// Import
export async function importCSV(file) {
  const form = new FormData();
  form.append('file', file);
  return request('/import/', { method: 'POST', body: form });
}

// Transactions
export async function fetchTransactions() {
  return request('/transactions/');
}

// Line Items
export async function fetchLineItems() {
  return request('/line-items/');
}

// Match actions
export async function approveMatch(matchId) {
  return request(`/matches/${matchId}/approve/`, { method: 'POST' });
}

export async function rejectMatch(matchId) {
  return request(`/matches/${matchId}/reject/`, { method: 'POST' });
}

// Transaction actions
export async function ignoreTransaction(txId) {
  return request(`/transactions/${txId}/ignore/`, { method: 'POST' });
}
