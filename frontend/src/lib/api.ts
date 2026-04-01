const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface DocumentItem {
  id: string;
  filename: string;
  mimeType: string;
  status: string;
  progress: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisResult {
  id: string;
  documentId: string;
  status: string;
  errorMessage: string | null;
  fixedFields: Record<string, FieldValue> | { fixed_fields: Record<string, FieldValue> } | null;
  dynamicFields: Record<string, Record<string, FieldValue>> | { dynamic_fields: Record<string, Record<string, FieldValue>> } | null;
  specialFields: SpecialFieldsData | { special_fields: SpecialFieldsData } | null;
  documentSummary?: Summary | { summary: Summary } | null;
  sources: unknown;
  modelName: string | null;
  processingTimeMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Summary {
  narrativeSummary?: string;
  coreIdentification?: Record<string, any>;
  termAndDates?: Record<string, any>;
  financials?: Record<string, any>;
  riskAndLiability?: Record<string, any>;
  criticalProvisions?: any[];
  analystNotations?: any[];
}

export interface FieldValue {
  value: string;
  description?: string;
  confidence?: number;
}

export interface SpecialFieldEntry {
  value: string | null;
  description?: string;
  confidence?: number;
}

export type SpecialFieldsData = Record<string, Record<string, SpecialFieldEntry>>;

export async function fetchDocuments(): Promise<DocumentItem[]> {
  const res = await fetch(`${API_URL}/documents`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function uploadDocument(file: File): Promise<{ id: string }> {
  const formData = new FormData();
  formData.append('files', file);
  const res = await fetch(`${API_URL}/documents`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

export async function uploadDocuments(files: FileList | File[]): Promise<{ id: string }[]> {
  const formData = new FormData();
  const list = Array.from(files as any as File[]);
  for (const f of list) formData.append('files', f);
  const res = await fetch(`${API_URL}/documents`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

export async function triggerAnalysis(documentId: string, force = false): Promise<void> {
  const url = `${API_URL}/documents/${documentId}/analyze${force ? '?force=true' : ''}`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start analysis');
  }
}

export async function reanalyseDocument(documentId: string): Promise<void> {
  const res = await fetch(`${API_URL}/documents/${documentId}/reanalyse`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start reanalysis');
  }
}

export async function fetchAnalysis(documentId: string): Promise<AnalysisResult | null> {
  const res = await fetch(`${API_URL}/documents/${documentId}/analysis`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch analysis');
  return res.json();
}

export async function fetchDocument(id: string): Promise<DocumentItem> {
  const res = await fetch(`${API_URL}/documents/${id}`);
  if (!res.ok) throw new Error('Failed to fetch document');
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/documents/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete document');
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendChatMessage(
  documentId: string,
  message: string,
  history: ChatMessage[]
): Promise<string> {
  const res = await fetch(`${API_URL}/documents/${documentId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Chat request failed');
  }
  const data = await res.json();
  return data.reply as string;
}
