'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { fetchDocument, fetchAnalysis, triggerAnalysis, reanalyseDocument, DocumentItem, AnalysisResult } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { AnalysisResultView } from '@/components/AnalysisResult';

export default function DocumentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reanalysing, setReanalysing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [docData, analysisData] = await Promise.all([
        fetchDocument(id),
        fetchAnalysis(id),
      ]);
      setDoc(docData);
      setAnalysis(analysisData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll while analysis is RUNNING or document is PROCESSING
  useEffect(() => {
    const shouldPoll =
      analysis?.status === 'RUNNING' ||
      analysis?.status === 'PENDING' ||
      analysis?.status === 'PARTIAL' ||
      doc?.status === 'QUEUED' ||
      doc?.status === 'PROCESSING';

    if (!shouldPoll) return;

    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [analysis, doc, loadData]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      await triggerAnalysis(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  // Trigger analysis on the backend but do NOT refresh the currently-displayed analysis.
  const handleReanalyse = async () => {
    setReanalysing(true);
    setError(null);
    try {
      // Call the reanalyse endpoint which removes previous analysis data then starts fresh analysis.
      await reanalyseDocument(id);
      // Immediately clear displayed analysis so UI reflects deletion of previous results.
      setAnalysis(null);

      // Poll for a new analysis row to appear (status RUNNING or DONE). When found, reload full data.
      const start = Date.now();
      const timeoutMs = 120000; // 2 minutes
      const pollInterval = 2000;
      let found = false;
      while (Date.now() - start < timeoutMs) {
        try {
          const a = await fetchAnalysis(id);
          if (a && (a.status === 'RUNNING' || a.status === 'PARTIAL' || a.status === 'DONE' || a.status === 'FAILED')) {
            found = true;
            break;
          }
        } catch (e) {
          // fetchAnalysis throws on network error; ignore and retry
        }
        // Wait before next poll
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, pollInterval));
      }

      // If a new analysis was detected, refresh the document+analysis view
      if (found) await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start reanalysis');
    } finally {
      setReanalysing(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" />
          <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="container">
        <div className="error-box">Document not found</div>
        <a href="/" className="back-link">← Back to documents</a>
      </div>
    );
  }

  return (
    <div className="container">
      <a href="/" className="back-link">← Back to documents</a>

      {/* Document info */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>{doc.filename}</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Uploaded {new Date(doc.createdAt).toLocaleString()}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <StatusBadge status={doc.status} />
            {doc.status === 'READY' && (!analysis || analysis.status === 'FAILED') && (
              <button
                className="btn btn-success"
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? 'Starting...' : 'Analyze'}
              </button>
            )}
            {doc.status === 'READY' && analysis && analysis.status === 'DONE' && (
              <button
                className="btn btn-secondary"
                onClick={handleReanalyse}
                disabled={reanalysing}
                title="Re-run analysis on the backend (will not refresh current view)"
              >
                {reanalysing ? 'Re-starting...' : 'Reanalyse'}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar for document processing */}
        {(doc.status === 'QUEUED' || doc.status === 'PROCESSING') && (
          <div>
            <div className="progress-bar" style={{ marginBottom: '0.5rem' }}>
              <div className="progress-fill" style={{ width: `${doc.progress}%` }} />
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              Processing document... {doc.progress}%
            </p>
          </div>
        )}

        {doc.errorMessage && (
          <div className="error-box" style={{ marginTop: '0.75rem' }}>
            {doc.errorMessage}
          </div>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {/* Analysis section */}
      {analysis && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Analysis</h2>
            <StatusBadge status={analysis.status} />
            {analysis.modelName && (
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                Model: {analysis.modelName}
              </span>
            )}
          </div>

          

          {(analysis.status === 'RUNNING' || analysis.status === 'PARTIAL') && (
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="spinner" style={{ flexShrink: 0 }} />
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                {analysis.status === 'RUNNING'
                  ? 'Running pre-analysis across the retrieved chunks, then fixed, supplier-specific, and dynamic extraction passes.'
                  : 'Pre-analysis, fixed fields, and dynamic fields are available. Supplier-specific extraction is still being finalized.'}
              </p>
            </div>
          )}

          {analysis.status === 'FAILED' && analysis.errorMessage && (
            <div className="error-box">{analysis.errorMessage}</div>
          )}

          {(analysis.fixedFields || analysis.dynamicFields || analysis.specialFields || analysis.summary) && (
            <AnalysisResultView
              fixedFields={analysis.fixedFields}
              dynamicFields={analysis.dynamicFields}
              specialFields={analysis.specialFields}
              summary={analysis.summary}
            />
          )}
        </div>
      )}

      {/* No analysis yet + document is ready */}
      {!analysis && doc.status === 'READY' && (
        <div className="card empty-state">
          <p>No analysis yet. Click &quot;Analyze&quot; to run the pre-analysis and staged extraction flow.</p>
        </div>
      )}
    </div>
  );
}
