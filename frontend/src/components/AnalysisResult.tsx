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
    <div className="field-grid" style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
      <div className="field-label" style={{ fontWeight: 600 }}>{label.replace(/_/g, ' ')}</div>
      <div className="field-value">
        <div style={{ fontWeight: 500 }}>{field.value || 'N/A'}</div>
        {field.description && (
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem', lineHeight: '1.4' }}>
            {field.description}
          </div>
        )}
      </div>
      <div><ConfidenceDot confidence={field.confidence} /></div>
    </div>
  );
}

export function AnalysisResultView({ fixedFields, dynamicFields, specialFields, summary }: AnalysisResultProps) {
  // Normalize field/special functions
  const normalizeField = (f: FieldValue | SpecialFieldEntry) => {
    if (!f) return f;
    const out = { ...f } as any;
    if (typeof out.confidence === 'number') {
      if (out.confidence > 1) out.confidence = Math.min(out.confidence / 100, 1);
    }
    return out;
  };

  const isNotNA = (val: any) => {
    if (val === undefined || val === null) return false;
    const v = typeof val === 'object' && 'value' in val ? val.value : val;
    if (v === null || v === undefined) return false;
    const s = String(v).trim().toUpperCase();
    return s !== 'N/A' && s !== 'NOT AVAILABLE' && s !== 'N.A.' && s !== 'NONE' && s !== '';
  };

  const fixedRaw = fixedFields
    ? (fixedFields as { fixed_fields?: Record<string, FieldValue> }).fixed_fields || fixedFields
    : null;
  const fixed = fixedRaw
    ? Object.fromEntries(
        Object.entries(fixedRaw as Record<string, FieldValue>)
          .map(([k, v]) => [k, normalizeField(v)])
          .filter(([_, v]) => isNotNA(v))
      )
    : null;

  const dynamicRaw = dynamicFields
    ? (dynamicFields as { dynamic_fields?: Record<string, Record<string, FieldValue>> }).dynamic_fields || dynamicFields
    : null;
  const dynamic = dynamicRaw
    ? Object.fromEntries(
        Object.entries(dynamicRaw as Record<string, Record<string, FieldValue>>).map(([cat, fields]) => [
          cat,
          Object.fromEntries(
            Object.entries(fields || {})
              .map(([k, v]) => [k, normalizeField(v)])
              .filter(([_, v]) => isNotNA(v))
          ),
        ]).filter(([_, fields]) => Object.keys(fields).length > 0)
      )
    : null;

  const specialRaw = specialFields
    ? (specialFields as { special_fields?: SpecialFieldsData }).special_fields || (specialFields as SpecialFieldsData)
    : null;
  const special = specialRaw
    ? Object.fromEntries(
        Object.entries(specialRaw as SpecialFieldsData).map(([supplier, fields]) => [
          supplier,
          Object.fromEntries(
            Object.entries(fields || {})
              .map(([k, v]) => [k, normalizeField(v)])
              .filter(([_, v]) => isNotNA(v))
          ),
        ]).filter(([_, fields]) => Object.keys(fields).length > 0)
      )
    : null;

  const summaryRaw = (summary as any)?.summary || summary || null;

  const hasSummary = summaryRaw && Object.keys(summaryRaw).length > 0;
  const hasFixed = fixed && Object.keys(fixed).length > 0;
  const hasDynamic = dynamic && Object.keys(dynamic).length > 0;
  const hasSpecial = special && Object.keys(special).length > 0;

  if (!hasSummary && !hasFixed && !hasDynamic && !hasSpecial) {
    return (
      <div className="empty-state card">
        <p>No analysis results available yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Summary Section */}
      {hasSummary && (
        <div className="fade-in" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          <div className="card" style={{ borderLeft: '6px solid var(--green)', background: 'white' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', fontSize: '1.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>📋</span> Executive Summary
            </h2>
            {isNotNA(summaryRaw.narrativeSummary) && (
              <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                <p style={{ margin: 0, fontSize: '1.125rem', lineHeight: '1.7', fontWeight: 500, color: '#1e293b' }}>
                  {summaryRaw.narrativeSummary}
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
              {summaryRaw.coreIdentification && Object.entries(summaryRaw.coreIdentification).some(([_, v]) => isNotNA(v)) && (
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <h3 style={{ borderBottom: '2px solid #3b82f6', display: 'inline-block', paddingBottom: '0.25rem', marginBottom: '1.25rem', color: '#1e293b', fontSize: '0.9rem' }}>Core Identification</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem 2rem' }}>
                    {Object.entries(summaryRaw.coreIdentification)
                      .filter(([_, v]) => isNotNA(v))
                      .map(([k, v]: [string, any]) => (
                        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div className="field-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                          <div className="field-value" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                            {v && typeof v === 'object' ? v.value : String(v)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {summaryRaw.termAndDates && Object.entries(summaryRaw.termAndDates).some(([_, v]) => isNotNA(v)) && (
                  <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3 style={{ borderBottom: '2px solid #64748b', display: 'inline-block', paddingBottom: '0.25rem', marginBottom: '1.25rem', color: '#1e293b', fontSize: '0.9rem' }}>Terms & Dates</h3>
                    {Object.entries(summaryRaw.termAndDates)
                      .filter(([_, v]) => isNotNA(v))
                      .map(([k, v]: [string, any]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                          <div className="field-label" style={{ fontSize: '0.8rem' }}>{k.replace(/_/g, ' ')}</div>
                          <div className="field-value" style={{ fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>
                            {v && typeof v === 'object' ? v.value : String(v)}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {summaryRaw.financials && Object.entries(summaryRaw.financials).some(([_, v]) => isNotNA(v)) && (
                  <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3 style={{ borderBottom: '2px solid var(--green)', display: 'inline-block', paddingBottom: '0.25rem', marginBottom: '1.25rem', color: '#1e293b', fontSize: '0.9rem' }}>Financials</h3>
                    {Object.entries(summaryRaw.financials)
                      .filter(([_, v]) => isNotNA(v))
                      .map(([k, v]: [string, any]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                          <div className="field-label" style={{ fontSize: '0.8rem' }}>{k.replace(/_/g, ' ')}</div>
                          <div className="field-value" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--green)', textAlign: 'right' }}>
                            {v && typeof v === 'object' ? v.value : String(v)}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {summaryRaw.riskAndLiability && Object.entries(summaryRaw.riskAndLiability).some(([_, v]) => isNotNA(v)) && (
                  <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3 style={{ borderBottom: '2px solid var(--red)', display: 'inline-block', paddingBottom: '0.25rem', marginBottom: '1.25rem', color: '#1e293b', fontSize: '0.9rem' }}>Risk & Liability</h3>
                    {Object.entries(summaryRaw.riskAndLiability)
                      .filter(([_, v]) => isNotNA(v))
                      .map(([k, v]: [string, any]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                          <div className="field-label" style={{ fontSize: '0.8rem' }}>{k.replace(/_/g, ' ')}</div>
                          <div className="field-value" style={{ fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>
                            {v && typeof v === 'object' ? v.value : String(v)}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
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
        </div>
      )}

      {/* Fixed Fields Section */}
      {hasFixed && (
        <div className="fade-in" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          <div className="card">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>📌</span> Fixed Fields
            </h2>
            {Object.entries(fixed as Record<string, FieldValue>).map(([key, field]) => (
              <FieldRow key={key} label={key} field={field} />
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Fields Section */}
      {hasDynamic && (
        <div className="fade-in" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          <div className="card">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⚡</span> Dynamic Fields
            </h2>
            {Object.entries(dynamic as Record<string, Record<string, FieldValue>>).map(
              ([category, fields]) => (
                <div key={category} style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', color: 'var(--accent)' }}>{category}</h3>
                  {Object.entries(fields).map(([key, field]) => (
                    <FieldRow key={key} label={key} field={field} />
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Special Fields Section */}
      {hasSpecial && (
        <div className="fade-in" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          <div className="card">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🛡️</span> Supplier-Specific Fields
            </h2>
            {Object.entries(special as SpecialFieldsData).map(([supplierName, fields]) => (
              <div key={supplierName} style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ textTransform: 'capitalize', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', color: 'var(--green)' }}>
                  {supplierName} Entitlement Fields
                </h3>
                {Object.entries(fields).map(([key, field]) => {
                  const f = field as SpecialFieldEntry;
                  return (
                    <FieldRow key={key} label={key} field={{ value: String(f.value), description: f.description, confidence: f.confidence }} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
