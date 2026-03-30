'use client';

import { FieldValue, SpecialFieldEntry, SpecialFieldsData, Summary } from '@/lib/api';

interface AnalysisResultProps {
  fixedFields: Record<string, FieldValue> | { fixed_fields: Record<string, FieldValue> } | null;
  dynamicFields:
    | Record<string, Record<string, FieldValue>>
    | { dynamic_fields: Record<string, Record<string, FieldValue>> }
    | null;
  specialFields: SpecialFieldsData | { special_fields: SpecialFieldsData } | null;
  summary?: Summary | { summary: Summary } | null;
}

function ConfidenceDot({ confidence }: { confidence?: number }) {
  if (confidence === undefined || confidence === null) return null;
  // Normalize confidence to 0.0 - 1.0 if caller provided 0-100 scale
  let conf = confidence;
  if (conf > 1) conf = Math.min(conf / 100, 1);
  let cls = 'confidence-dot ';
  if (conf >= 0.8) cls += 'confidence-high';
  else if (conf >= 0.5) cls += 'confidence-medium';
  else cls += 'confidence-low';
  return (
    <span title={`Confidence: ${(conf * 100).toFixed(0)}%`}>
      <span className={cls} />
      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
        {(conf * 100).toFixed(0)}%
      </span>
    </span>
  );
}

function FieldRow({ label, field }: { label: string; field: FieldValue }) {
  return (
    <div className="field-grid" style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
      <div className="field-label">{label.replace(/_/g, ' ')}</div>
      <div className="field-value">{field.value || 'N/A'}</div>
      <div><ConfidenceDot confidence={field.confidence} /></div>
    </div>
  );
}

export function AnalysisResultView({ fixedFields, dynamicFields, specialFields, summary }: AnalysisResultProps) {
  // Unwrap nested structure from LLM response
  // Unwrap nested structure from API/LLM and normalize confidences (accept 0..1 or 0..100)
  const normalizeField = (f: FieldValue | SpecialFieldEntry) => {
    if (!f) return f;
    const out = { ...f } as any;
    if (typeof out.confidence === 'number') {
      if (out.confidence > 1) out.confidence = Math.min(out.confidence / 100, 1);
    }
    return out;
  };

  const fixedRaw = fixedFields
    ? (fixedFields as { fixed_fields?: Record<string, FieldValue> }).fixed_fields || fixedFields
    : null;
  const fixed = fixedRaw
    ? Object.fromEntries(Object.entries(fixedRaw as Record<string, FieldValue>).map(([k, v]) => [k, normalizeField(v)]))
    : null;

  const dynamicRaw = dynamicFields
    ? (dynamicFields as { dynamic_fields?: Record<string, Record<string, FieldValue>> }).dynamic_fields || dynamicFields
    : null;
  const dynamic = dynamicRaw
    ? Object.fromEntries(
        Object.entries(dynamicRaw as Record<string, Record<string, FieldValue>>).map(([cat, fields]) => [
          cat,
          Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, normalizeField(v)])),
        ])
      )
    : null;

  const specialRaw = specialFields
    ? (specialFields as { special_fields?: SpecialFieldsData }).special_fields || (specialFields as SpecialFieldsData)
    : null;
  const special = specialRaw
    ? Object.fromEntries(
        Object.entries(specialRaw as SpecialFieldsData).map(([supplier, fields]) => [
          supplier,
          Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, normalizeField(v)])),
        ])
      )
    : null;

  // Summary (normalized)
  const summaryRaw = summary
    ? ((summary as any).summary || summary)
    : null;

  return (
    <div>
      {/* Summary */}
      {summaryRaw && (
        <div className="card" style={{ borderLeft: '4px solid var(--success)', background: 'rgba(var(--success-rgb), 0.03)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>📋</span> Executive Summary
          </h2>
          {summaryRaw.narrativeSummary && (
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: '1.6', fontWeight: 500 }}>
                {summaryRaw.narrativeSummary}
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {summaryRaw.coreIdentification && Object.keys(summaryRaw.coreIdentification).length > 0 && (
              <div>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>Core Identification</h3>
                {Object.entries(summaryRaw.coreIdentification).map(([k, v]) => (
                  <div key={k} className="field-grid" style={{ padding: '0.4rem 0', borderBottom: '1px dotted var(--border)' }}>
                    <div className="field-label" style={{ fontSize: '0.8rem' }}>{k.replace(/_/g, ' ')}</div>
                    <div className="field-value" style={{ fontSize: '0.85rem' }}>{typeof v === 'string' ? v : JSON.stringify(v)}</div>
                    <div />
                  </div>
                ))}
              </div>
            )}

            {summaryRaw.termAndDates && Object.keys(summaryRaw.termAndDates).length > 0 && (
              <div>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>Term & Dates</h3>
                {Object.entries(summaryRaw.termAndDates).map(([k, v]) => (
                  <div key={k} className="field-grid" style={{ padding: '0.4rem 0', borderBottom: '1px dotted var(--border)' }}>
                    <div className="field-label" style={{ fontSize: '0.8rem' }}>{k.replace(/_/g, ' ')}</div>
                    <div className="field-value" style={{ fontSize: '0.85rem' }}>{typeof v === 'string' ? v : JSON.stringify(v)}</div>
                    <div />
                  </div>
                ))}
              </div>
            )}

            {summaryRaw.financials && Object.keys(summaryRaw.financials).length > 0 && (
              <div>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>Financials</h3>
                {Object.entries(summaryRaw.financials).map(([k, v]) => (
                  <div key={k} className="field-grid" style={{ padding: '0.4rem 0', borderBottom: '1px dotted var(--border)' }}>
                    <div className="field-label" style={{ fontSize: '0.8rem' }}>{k.replace(/_/g, ' ')}</div>
                    <div className="field-value" style={{ fontSize: '0.85rem' }}>{typeof v === 'string' ? v : JSON.stringify(v)}</div>
                    <div />
                  </div>
                ))}
              </div>
            )}

            {summaryRaw.riskAndLiability && Object.keys(summaryRaw.riskAndLiability).length > 0 && (
              <div>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>Risk & Liability</h3>
                {Object.entries(summaryRaw.riskAndLiability).map(([k, v]) => (
                  <div key={k} className="field-grid" style={{ padding: '0.4rem 0', borderBottom: '1px dotted var(--border)' }}>
                    <div className="field-label" style={{ fontSize: '0.8rem' }}>{k.replace(/_/g, ' ')}</div>
                    <div className="field-value" style={{ fontSize: '0.85rem' }}>{typeof v === 'string' ? v : JSON.stringify(v)}</div>
                    <div />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {Array.isArray(summaryRaw.criticalProvisions) && summaryRaw.criticalProvisions.length > 0 && (
              <div>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>Critical Provisions</h3>
                <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }}>
                  {summaryRaw.criticalProvisions.map((p: any, idx: number) => (
                    <li key={idx} style={{ marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                      {typeof p === 'string' ? p : (
                        <span><strong>{p.name}:</strong> {p.summary}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(summaryRaw.analystNotations) && summaryRaw.analystNotations.length > 0 && (
              <div>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>Analyst Notations</h3>
                <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }}>
                  {summaryRaw.analystNotations.map((n: any, idx: number) => (
                    <li key={idx} style={{ marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                      {typeof n === 'string' ? n : (
                        <span><strong>{n.title}:</strong> {n.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Fixed Fields */}
      {fixed && Object.keys(fixed).length > 0 && (
        <div className="card">
          <h2>Fixed Fields</h2>
          {Object.entries(fixed as Record<string, FieldValue>).map(([key, field]) => (
            <FieldRow key={key} label={key} field={field} />
          ))}
        </div>
      )}

      {/* Dynamic Fields */}
      {dynamic && Object.keys(dynamic).length > 0 && (
        <div className="card">
          <h2>Dynamic Fields</h2>
          {Object.entries(dynamic as Record<string, Record<string, FieldValue>>).map(
            ([category, fields]) => (
              <div key={category} style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>{category}</h3>
                {fields && typeof fields === 'object' && Object.keys(fields).length > 0 ? (
                  Object.entries(fields).map(([key, field]) => (
                    <FieldRow key={key} label={key} field={field} />
                  ))
                ) : (
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                    No fields extracted
                  </p>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* Special Fields */}
      {special && Object.keys(special).length > 0 && (
        <div className="card">
          <h2>Supplier-Specific Fields</h2>
          {Object.entries(special as SpecialFieldsData).map(([supplierName, fields]) => (
            <div key={supplierName} style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ textTransform: 'capitalize', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>
                {supplierName} Entitlement Fields
              </h3>
              {fields && typeof fields === 'object' && Object.keys(fields).length > 0 ? (
                Object.entries(fields).map(([key, field]) => {
                  const f = field as SpecialFieldEntry;
                  return (
                    <div
                      key={key}
                      className="field-grid"
                      style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}
                    >
                      <div className="field-label">{key.replace(/_/g, ' ')}</div>
                      <div className="field-value">
                        {f.value !== null && f.value !== undefined && f.value !== ''
                          ? String(f.value)
                          : 'N/A'}
                        {f.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                            {f.description}
                          </div>
                        )}
                      </div>
                      <div><ConfidenceDot confidence={f.confidence} /></div>
                    </div>
                  );
                })
              ) : (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                  No supplier-specific fields extracted
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {(!fixed || Object.keys(fixed).length === 0) &&
        (!dynamic || Object.keys(dynamic).length === 0) &&
        (!special || Object.keys(special).length === 0) &&
        (!summaryRaw) && (
          <div className="empty-state card">
            <p>No analysis results available yet.</p>
          </div>
        )}
    </div>
  );
}
