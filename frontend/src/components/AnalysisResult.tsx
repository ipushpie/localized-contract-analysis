'use client';

import { FieldValue, SpecialFieldEntry, SpecialFieldsData } from '@/lib/api';

interface AnalysisResultProps {
  fixedFields: Record<string, FieldValue> | { fixed_fields: Record<string, FieldValue> } | null;
  dynamicFields:
    | Record<string, Record<string, FieldValue>>
    | { dynamic_fields: Record<string, Record<string, FieldValue>> }
    | null;
  specialFields: SpecialFieldsData | { special_fields: SpecialFieldsData } | null;
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

export function AnalysisResultView({ fixedFields, dynamicFields, specialFields }: AnalysisResultProps) {
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

  return (
    <div>
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
                <h3>{category}</h3>
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
              <h3 style={{ textTransform: 'capitalize', marginBottom: '0.75rem' }}>
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
        (!special || Object.keys(special).length === 0) && (
          <div className="empty-state">
            <p>No analysis results available.</p>
          </div>
        )}
    </div>
  );
}
