import { useState, useRef } from 'react';
import { importCSV } from '../api';

/**
 * CSV upload widget with drag-and-drop, file selection, and import summary display.
 */
export default function UploadSection({ onImported }) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
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
      onImported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-section">
      <div className="upload-card">
        <div className="section-header" style={{ marginBottom: '12px' }}>
          <span className="section-title">📂 Import Bank Statement</span>
        </div>

        {/* Drop zone */}
        <div
          className={`upload-area ${dragging ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="upload-input"
            id="csv-upload-input"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <div className="upload-icon">📄</div>
          <div className="upload-text">
            <strong>Drop a CSV file here</strong> or click to browse
          </div>
          <div className="upload-hint">Columns required: date, description, amount, type, reference</div>
        </div>

        {/* Controls */}
        <div className="upload-controls">
          {selectedFile && (
            <span className="selected-file">
              📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          )}
          <button
            className="btn btn-primary"
            id="upload-btn"
            onClick={handleUpload}
            disabled={!selectedFile || loading}
            style={{ marginLeft: 'auto' }}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 12, height: 12 }} />
                Importing…
              </>
            ) : (
              '⬆ Import CSV'
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error" style={{ marginTop: '12px' }}>
            ⚠ {error}
          </div>
        )}

        {/* Import summary */}
        {result && (
          <div className="import-summary">
            <div className="summary-stats">
              <div className="summary-stat success">
                <span className="label">Imported:</span>
                <span className="value">{result.imported}</span>
              </div>
              <div className="summary-stat warning">
                <span className="label">Duplicates:</span>
                <span className="value">{result.duplicates}</span>
              </div>
              <div className={`summary-stat ${result.errors.length > 0 ? 'danger' : 'success'}`}>
                <span className="label">Row errors:</span>
                <span className="value">{result.errors.length}</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="import-errors">
                <div className="import-errors-title">⚠ Row Errors</div>
                {result.errors.map((err, i) => (
                  <div className="import-error-item" key={i}>
                    <span className="error-line">Line {err.line}</span>
                    <span className="error-msg">{err.message}</span>
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
