import { config } from '../utils/config';
import { prisma } from '../utils/database';
import { embed } from './embedding';
import { logger } from '../utils/logger';

const TAG = 'Chat';

const SYSTEM_PROMPT =
  'You are a Contract Assistant for MAIT, a contract intelligence platform. ' +
  'You help procurement, legal, and finance teams understand the contract they are reviewing. ' +
  'Answer questions based ONLY on the contract excerpts and key facts provided in each user message. ' +
  'If the answer is not present in the provided context, say clearly: "I don\'t see that information in the available contract excerpts." ' +
  'Be concise and direct. Use plain language unless the user asks for legal specificity. ' +
  'When quoting contract language, use quotation marks and note the section if available. ' +
  'For financial figures, always include the currency as it appears in the contract. ' +
  'Do not give legal advice. You are a contract data assistant, not a lawyer. ' +
  'Respond in the same language the user wrote their question in.';

export class DocumentNotFoundError extends Error {
  status = 404;
  constructor(id: string) {
    super(`Document ${id} not found`);
    this.name = 'DocumentNotFoundError';
  }
}

export class AnalysisNotReadyError extends Error {
  status = 409;
  constructor(status: string) {
    super(`Analysis is not DONE (current status: ${status})`);
    this.name = 'AnalysisNotReadyError';
  }
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function chatWithDocument(
  documentId: string,
  message: string,
  history: ChatTurn[]
): Promise<string> {
  // 1. Validate document and analysis
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true },
  });
  if (!doc) throw new DocumentNotFoundError(documentId);

  const analysis = await prisma.documentAnalysis.findUnique({
    where: { documentId },
    select: { status: true, fixedFields: true, dynamicFields: true, sources: true },
  });
  if (!analysis) throw new AnalysisNotReadyError('NOT_FOUND');
  if (analysis.status !== 'DONE') throw new AnalysisNotReadyError(analysis.status);

  // 2. Embed the user message
  logger.info(TAG, 'Embedding user message', { documentId, messageLength: message.length });
  const queryVector = await embed(message);

  // 3. Semantic search — top 6 most relevant chunks
  const chunks = await prisma.$queryRawUnsafe<{
    id: string;
    content: string;
    chunkIndex: number;
    pageStart: number | null;
    sectionTitle: string | null;
  }[]>(
    `SELECT id, content, "chunkIndex", "pageStart", "sectionTitle"
     FROM "Chunk"
     WHERE "documentId" = $1
     ORDER BY embedding <=> $2::vector
     LIMIT 6`,
    documentId,
    `[${queryVector.join(',')}]`
  );

  if (chunks.length === 0) {
    throw new Error('No document chunks found. The document may not have been processed correctly.');
  }

  logger.info(TAG, 'Chunks retrieved', { documentId, count: chunks.length });

  // 4. Build context block from chunks
  const chunksBlock = chunks
    .map((c: { id: string; content: string; chunkIndex: number; pageStart: number | null; sectionTitle: string | null }, i: number) => {
      const section = c.sectionTitle || 'Unknown';
      const page = c.pageStart != null ? ` | Page ${c.pageStart}` : '';
      const content = c.content.length > 600 ? c.content.slice(0, 600) + '…' : c.content;
      return `[Excerpt ${i + 1} | Section: ${section}${page}]\n${content}`;
    })
    .join('\n\n');

  // 5. Extract key facts from analysis
  const fixed = (analysis.fixedFields as Record<string, { value?: string }> | null) ?? {};
  const summary = (analysis.sources as any)?.summary?.narrativeSummary ?? null;

  const KEY_FIELDS = [
    'provider', 'client', 'agreement_type', 'effective_date', 'total_amount', 'annual_amount',
    'start_date', 'end_date', 'contract_status', 'product', 'contract_term', 'payment_terms',
  ];
  const NA_VALUES = new Set(['n/a', 'not available', 'n.a.', 'none', '', 'null', 'undefined']);

  const keyFactLines: string[] = [];
  for (const key of KEY_FIELDS) {
    const val = fixed[key]?.value;
    if (val && !NA_VALUES.has(val.toLowerCase().trim())) {
      keyFactLines.push(`${key}: ${val}`);
    }
  }

  // Also include the narrative summary of the scope if available from dynamic fields
  const dynamic = (analysis.dynamicFields as Record<string, any> | null) ?? {};
  const description = dynamic['General']?.['contract_description']?.value 
                   || dynamic['general']?.['contract_description']?.value;

  if (description && !NA_VALUES.has(description.toLowerCase().trim())) {
    keyFactLines.push(`Scope Overview: ${description}`);
  }

  const keyFacts = keyFactLines.length > 0
    ? keyFactLines.join('\n')
    : 'No structured key facts available.';

  // 6. Build contextual user message
  const contextualMessage = [
    'RELEVANT CONTRACT EXCERPTS:',
    chunksBlock,
    '',
    'KEY CONTRACT FACTS:',
    keyFacts,
    ...(summary ? ['', 'CONTRACT SUMMARY:', summary] : []),
    '',
    'USER QUESTION:',
    message,
  ].join('\n');

  // 7. Cap history at last 10 turns to avoid context window overflow
  const cappedHistory = history.slice(-10);

  // 8. Build messages array for Ollama
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...cappedHistory,
    { role: 'user', content: contextualMessage },
  ];

  // 9. Call Ollama — natural language output (no format: 'json')
  logger.info(TAG, 'Calling Ollama for chat response', { documentId, historyTurns: cappedHistory.length });

  const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.generationModel,
      messages,
      stream: false,
      keep_alive: -1,
      options: {
        temperature: 0.1,
        num_ctx: config.llmNumCtx,
        num_predict: 1024,
      },
    }),
    signal: AbortSignal.timeout(config.llmTimeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Ollama chat failed: ${response.status} ${response.statusText} - ${body}`);
  }

  const data = (await response.json()) as { message?: { content: string }; response?: string };
  const reply = (data.message?.content || data.response || '').trim();

  if (!reply) {
    throw new Error('Ollama returned an empty response');
  }

  logger.info(TAG, 'Chat response generated', { documentId, replyLength: reply.length });
  return reply;
}
