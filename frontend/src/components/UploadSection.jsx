import React, { useState, useRef } from 'react';
import { importCSV } from '../api';
import { IconUploadCloud, IconFileText, IconAlertTriangle, IconCheck } from './Icons';

export default function UploadSection({ onImported, onToast }) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      onToast?.({
        type: 'error',
        title: 'Invalid File',
        message: 'Please select a valid .csv bank statement file.',
      });
      return;
    }
    setSelectedFile(file);
    setResult(null);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await importCSV(selectedFile);
      setResult(data);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      
      onToast?.({
        type: 'success',
        title: 'Import Complete',
        message: `Successfully processed ${data.imported} transactions (${data.duplicates} duplicates skipped).`,
      });

      onImported?.();
    } catch (err) {
      setError(err.message);
      onToast?.({
        type: 'error',
        title: 'Import Failed',
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-left">
          <span className="card-title">
            <span className="card-title-icon"><IconUploadCloud size={18} /></span>
            Bank Statement Import
          </span>
        </div>
        <span className="badge-counter">CSV · RFC 4180</span>
      </div>

      <div className="upload-card-inner">
        {/* Drop zone */}
        <div
          className={`upload-area ${dragging ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            id="csv-upload-input"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <div className="upload-icon-circle">
            <IconUploadCloud size={22} />
          </div>
          <div className="upload-title">
            <strong>Drag & drop statement CSV</strong> or click to browse
          </div>
          <div className="upload-subtitle">
            Expected headers: date, description, amount, type, reference
          </div>
        </div>

        {/* Controls */}
        <div className="upload-controls">
          {selectedFile ? (
            <div className="file-selected-badge">
              <IconFileText size={16} />
              <span>{selectedFile.name}</span>
              <span className="num-mono" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              No statement file queued
            </div>
          )}

          <button
            className="btn btn-primary"
            id="upload-btn"
            onClick={handleUpload}
            disabled={!selectedFile || loading}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 12, height: 12 }} />
                Processing Wires…
              </>
            ) : (
              <>
                <IconUploadCloud size={14} />
                Import & Reconcile
              </>
            )}
          </button>
        </div>

        {/* Inline error if any */}
        {error && (
          <div className="error-row" style={{ marginTop: '8px' }}>
            <IconAlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Import summary chips */}
        {result && (
          <div className="import-summary-wrap">
            <div className="summary-chips">
              <div className="summary-chip success">
                <IconCheck size={14} />
                <span>Imported:</span>
                <span className="summary-chip-val">{result.imported}</span>
              </div>
              <div className="summary-chip warning">
                <span>Duplicates Skipped:</span>
                <span className="summary-chip-val">{result.duplicates}</span>
              </div>
              {result.errors?.length > 0 && (
                <div className="summary-chip danger">
                  <IconAlertTriangle size={14} />
                  <span>Validation Warnings:</span>
                  <span className="summary-chip-val">{result.errors.length}</span>
                </div>
              )}
            </div>

            {result.errors?.length > 0 && (
              <div className="error-accordion">
                {result.errors.map((err, i) => (
                  <div className="error-row" key={i}>
                    <span className="error-line-badge">Line {err.line}</span>
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
