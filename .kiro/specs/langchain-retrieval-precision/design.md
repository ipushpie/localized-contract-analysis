# LangChain Retrieval Precision Bugfix Design

## Overview

The RAG pipeline in `extraction.ts` currently retrieves up to 15 chunks per LLM pass using a
single broad cosine-similarity query. Because the same chunk pool is reused for every field in a
pass, irrelevant clauses dominate the context window and the LLM produces inaccurate or
hallucinated values (~60–70% extraction accuracy).

The fix introduces a new `backend/src/services/retrieval.ts` module that wraps the existing
pgvector store in a LangChain `MultiQueryRetriever` + `ContextualCompressionRetriever` pipeline.
`extraction.ts` is updated to call `getRelevantChunks(query, documentId)` once per field instead
of the current single broad `runPass` query. All Ollama call sites, the ingestion pipeline, the
DB schema, and the persisted JSON shapes are left completely unchanged.

## Glossary

- **Bug_Condition (C)**: A `runPass` invocation where a single broad query is used for an entire
  pass, returning up to 15 chunks with no per-field targeting and no deduplication.
- **Property (P)**: For any field retrieval, `getRelevantChunks` returns k=3–5 compressed,
  deduplicated chunks whose content is directly relevant to that field's query.
- **Preservation**: All behaviors not related to chunk retrieval — Ollama generation, ingestion,
  DB persistence, JSON output shapes, supplier pass logic — must remain byte-for-byte identical.
- **`runPass`**: The function in `extraction.ts` that embeds a query, fetches chunks from
  pgvector, assembles a context string, and calls the Ollama LLM.
- **`createRetriever(documentId)`**: New function in `retrieval.ts` that builds a
  `MultiQueryRetriever` wrapping a `PGVectorStore` filtered to a single document.
- **`getRelevantChunks(query, documentId)`**: New function in `retrieval.ts` that runs the full
  retrieval pipeline (multi-query → compression → dedup) for one field query.
- **`buildContext(docs)`**: New function in `retrieval.ts` that deduplicates by content hash and
  concatenates the final context string passed to the LLM prompt.
- **`isBugCondition`**: Pseudocode predicate that identifies the defective retrieval pattern.
- **PGVectorStore**: `@langchain/community` class backed by the existing `Chunk` table and its
  `embedding` vector column.
- **MultiQueryRetriever**: LangChain retriever that generates N query variations from a single
  input query to improve recall without increasing k.
- **ContextualCompressionRetriever**: LangChain retriever that post-processes each retrieved
  document through an `LLMChainExtractor`, stripping irrelevant passages.

## Bug Details

### Bug Condition

The bug manifests when `runPass` is called with a pass-level broad query string (e.g.
`FIXED_QUERY`, `DYNAMIC_QUERY`) and fetches up to 15 chunks via a single cosine-similarity
search. Every field in that pass receives the same chunk pool, so field-irrelevant clauses
inflate the prompt and confuse the LLM.

**Formal Specification:**
```
FUNCTION isBugCondition(invocation)
  INPUT: invocation — a call to runPass(documentId, queryText, promptTemplate, options)
  OUTPUT: boolean

  RETURN queryText IS a pass-level broad query (not field-specific)
         AND options.chunkLimit >= 15 (or default 15 applies)
         AND no per-field retrieval is performed before the LLM call
         AND no deduplication of chunk content is applied
END FUNCTION
```

### Examples

- **Fixed fields pass**: `runPass(docId, FIXED_QUERY, FIXED_PROMPT)` fetches 15 chunks covering
  the entire contract. Fields like `renewal_notice_period` receive chunks about payment terms,
  liability caps, and unrelated clauses → LLM hallucinates or picks wrong value.
- **Dynamic fields pass**: Same 15-chunk pool reused for all dynamic clause extraction → clauses
  from unrelated sections appear in context for every field.
- **Supplier pass**: `runPass(docId, SUPPLIER_QUERIES['oracle'], SUPPLIER_PROMPT)` fetches 15
  chunks; many are generic boilerplate unrelated to Oracle license metrics → supplier-specific
  fields are inaccurate.
- **Edge case — short document**: A document with only 3 chunks still goes through the broad
  query path; no harm but the new pipeline handles this correctly (k=min(3,available)).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `ollamaGenerate` and `ollamaGenerateWithRetry` are called with the same prompt structure and
  return the same JSON shapes — no changes to generation logic.
- `normalizeFixedFields`, `normalizeDynamicFields`, and the `DocumentAnalysis` upsert logic
  persist `fixedFields`, `dynamicFields`, and `specialFields` in the same JSON shape expected
  by the frontend.
- The combined Pass 1+2 optimisation path (`runCombinedPass`) continues to be taken when
  neither `fixedFields` nor `dynamicFields` exist on the prior analysis row.
- Pass 3 supplier logic continues to resolve the supplier key from `fixedFields.provider`,
  look up `SUPPLIER_QUERIES[key]`, and apply the `mapping.json` data.
- The `Chunk` table, its `embedding` vector column, and all ingestion logic in `ingestion.ts`
  and `embedding.ts` are not modified.
- The `embed()` function in `embedding.ts` continues to be used for query embedding inside the
  new `PGVectorStore` (via a thin `OllamaEmbeddings`-compatible adapter or direct call).

**Scope:**
All inputs that do NOT involve the chunk retrieval step — i.e. everything after `buildContext`
returns a string — are completely unaffected by this fix. This includes:
- The Ollama HTTP call and its retry logic
- JSON parsing and repair logic (`parseLLMJson`)
- DB reads/writes for `DocumentAnalysis`
- The ingestion and embedding pipelines

## Hypothesized Root Cause

1. **Single broad query per pass**: `runPass` uses one query string for an entire pass covering
   ~20 fields. A single embedding cannot be simultaneously close to all field-specific clauses,
   so the top-15 results are biased toward the most prominent topic in the query.

2. **No per-field retrieval loop**: There is no mechanism to issue a separate vector search for
   each field. All fields share the same `context` string assembled once before the LLM call.

3. **No compression step**: Retrieved chunks are included verbatim (truncated at 800 chars).
   Irrelevant sentences within a chunk are not stripped, wasting context budget.

4. **No deduplication**: Across multiple passes (Pass 1, Pass 2, Pass 3) the same chunks can
   appear repeatedly. Within a single pass there is also no dedup guard.

5. **Fixed k=15 regardless of document size or field count**: The limit is a static config
   value with no adaptive logic based on how many fields are being extracted or how long the
   document is.

## Correctness Properties

Property 1: Bug Condition - Per-Field Retrieval Returns k=3–5 Relevant Chunks

_For any_ field extraction call where `isBugCondition` holds on the original code (i.e. a
broad pass-level query would have been used), the fixed `getRelevantChunks(query, documentId)`
function SHALL return between 1 and 5 documents whose content is targeted to that specific
field query, replacing the broad 15-chunk pool with a focused, compressed result set.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Non-Retrieval Behavior Unchanged

_For any_ input that does NOT involve the chunk retrieval step (Ollama generation calls, DB
persistence, JSON normalization, supplier pass logic, ingestion pipeline), the fixed code SHALL
produce exactly the same result as the original code, preserving all existing behavior for
everything downstream of `buildContext`.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

Property 3: Deduplication - No Duplicate Chunks in Assembled Context

_For any_ set of retrieved documents passed to `buildContext(docs)`, the returned context
string SHALL contain each unique chunk content at most once, identified by a SHA-256 hash of
the trimmed content string.

**Validates: Requirements 2.5, 3.7**

## Fix Implementation

### Changes Required

**New File**: `backend/src/services/retrieval.ts`

Implements the three modular functions:

1. **`createRetriever(documentId, query)`**: Instantiates a `PGVectorStore` using the existing
   Postgres connection (via `pg` pool wrapping the same `DATABASE_URL`), filtered to
   `documentId`. Wraps it in a `MultiQueryRetriever` (using the Ollama LLM via
   `ChatOllama` or a thin wrapper) with `queryCount=3` and base `k=5`. Then wraps that in a
   `ContextualCompressionRetriever` with `LLMChainExtractor` using the same Ollama LLM.

2. **`getRelevantChunks(query, documentId)`**: Calls `createRetriever(documentId, query)` and
   invokes `.getRelevantDocuments(query)`. Returns the compressed `Document[]` array. Caps
   results at 5 documents.

3. **`buildContext(docs)`**: Accepts `Document[]`, deduplicates by `SHA-256(doc.pageContent)`,
   and concatenates the unique page contents into a numbered context string matching the
   existing `[N] content` format used in `runPass`.

**Modified File**: `backend/src/services/extraction.ts`

4. **`runPass` updated**: Replace the pgvector raw SQL block with a call to
   `getRelevantChunks(queryText, documentId)` and `buildContext(docs)`. The assembled `context`
   string is then used in the prompt template exactly as before. All code after context
   assembly (prompt building, `ollamaGenerateWithRetry`, `parseLLMJson`, retry logic) is
   unchanged.

5. **Import addition**: Add `import { getRelevantChunks, buildContext } from './retrieval'` at
   the top of `extraction.ts`. Remove the now-unused `embed` import and `getCachedEmbedding`
   helper (the embedding is handled internally by the LangChain `PGVectorStore`).

**New Dependencies** (to add to `backend/package.json`):
- `@langchain/community` — PGVectorStore, LLMChainExtractor
- `@langchain/core` — Document, BaseRetriever types
- `@langchain/ollama` — ChatOllama for MultiQueryRetriever and LLMChainExtractor
- `langchain` — MultiQueryRetriever, ContextualCompressionRetriever
- `pg` — Postgres pool for PGVectorStore connection

### Specific Changes

```
retrieval.ts
├── createRetriever(documentId, query)
│   ├── new Pool({ connectionString: process.env.DATABASE_URL })
│   ├── new PGVectorStore(embeddings, { pool, tableName: 'Chunk', filter: { documentId } })
│   ├── new MultiQueryRetriever({ retriever: vectorStoreRetriever, llm, queryCount: 3 })
│   └── new ContextualCompressionRetriever({ baseRetriever, baseCompressor: LLMChainExtractor })
├── getRelevantChunks(query, documentId) → Document[]  (max 5)
└── buildContext(docs) → string  (dedup by SHA-256, format "[N] content")

extraction.ts (delta only)
├── REMOVE: embed import, getCachedEmbedding, raw SQL pgvector block
├── ADD: import { getRelevantChunks, buildContext } from './retrieval'
└── REPLACE in runPass: chunk fetch block → getRelevantChunks + buildContext
```

## Testing Strategy

### Validation Approach

Two-phase approach: first surface counterexamples on unfixed code to confirm the root cause,
then verify the fix satisfies all correctness properties and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Demonstrate the bug on unfixed code — confirm that `runPass` returns 15 broad chunks
with no per-field targeting and no deduplication.

**Test Plan**: Instrument `runPass` to capture the chunk IDs and content returned for two
different field queries on the same document. Assert that the chunk sets are identical (proving
no per-field targeting) and that the count equals 15. Run on unfixed code to observe failures
when we assert they should differ.

**Test Cases**:
1. **Broad query returns 15 chunks**: Call `runPass` with `FIXED_QUERY` on a test document with
   20+ chunks; assert `chunks.length === 15` (will pass on unfixed code, confirming the bug).
2. **Same chunks for different fields**: Call `runPass` twice with different field-specific
   queries; assert the returned chunk ID sets are identical (will pass on unfixed code,
   confirming no per-field targeting).
3. **No deduplication across passes**: Run Pass 1 and Pass 2 on the same document; collect all
   chunk IDs used; assert there are duplicates (will pass on unfixed code, confirming the bug).
4. **Irrelevant chunk included**: For a document where `renewal_notice_period` is in section 5,
   assert that chunks from section 1 (payment terms) appear in the `FIXED_QUERY` result (will
   pass on unfixed code).

**Expected Counterexamples**:
- `runPass` with `FIXED_QUERY` returns chunks from unrelated contract sections
- Two different field queries return identical chunk ID arrays
- Possible causes: single embedding query, no field-specific retrieval loop, no compression

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, `getRelevantChunks` returns
k=3–5 targeted, compressed chunks.

**Pseudocode:**
```
FOR ALL (query, documentId) WHERE isBugCondition(originalRunPass(documentId, query)) DO
  docs := getRelevantChunks(query, documentId)
  ASSERT len(docs) >= 1 AND len(docs) <= 5
  ASSERT docs are field-relevant (content contains terms from query)
  ASSERT no two docs have the same SHA-256(pageContent)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (everything
downstream of context assembly), the fixed code produces the same result as the original.

**Pseudocode:**
```
FOR ALL prompt WHERE prompt = buildContext(docs) + promptTemplate DO
  ASSERT ollamaGenerate_original(prompt) = ollamaGenerate_fixed(prompt)
  ASSERT normalizeFixedFields_original(llmOutput) = normalizeFixedFields_fixed(llmOutput)
  ASSERT DocumentAnalysis shape is identical
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many prompt/output combinations automatically
- It catches edge cases in JSON normalization that manual tests miss
- It provides strong guarantees that the Ollama call sites and DB persistence are unchanged

**Test Cases**:
1. **Ollama call preservation**: Mock `ollamaGenerate`; verify it is called with the same
   prompt structure (template + context string) before and after the fix.
2. **JSON shape preservation**: For a fixed set of LLM outputs, verify `normalizeFixedFields`
   and `normalizeDynamicFields` produce identical results before and after the fix.
3. **Supplier pass preservation**: Run `runSupplierPass` with `provider='oracle'`; verify the
   supplier key resolution and `mapping.json` lookup are unchanged.
4. **Combined pass path preservation**: Verify `runCombinedPass` still calls
   `runPassWithAutoExpand` with `PRE_ANALYSIS_QUERY` when no prior results exist.

### Unit Tests

- Test `buildContext` deduplication: provide docs with duplicate content hashes, assert output
  contains each unique chunk exactly once.
- Test `getRelevantChunks` cap: mock the retriever to return 10 docs, assert only 5 are
  returned.
- Test `createRetriever` filter: verify the `PGVectorStore` is instantiated with the correct
  `documentId` filter so cross-document chunks are never returned.
- Test `runPass` with zero chunks available: verify the existing `'No chunks found'` error is
  still thrown when `getRelevantChunks` returns an empty array.

### Property-Based Tests

- Generate random sets of `Document[]` with varying duplicate rates; verify `buildContext`
  always returns a string with no duplicate content blocks (Property 3).
- Generate random `(query, documentId)` pairs against a seeded test DB; verify
  `getRelevantChunks` always returns 1–5 documents (Property 1).
- Generate random LLM JSON outputs; verify `normalizeFixedFields` / `normalizeDynamicFields`
  produce the same result when called from the fixed `extraction.ts` as from the original
  (Property 2).

### Integration Tests

- Full analysis run on a seeded test document: verify `DocumentAnalysis.fixedFields` shape is
  identical to a baseline captured on the unfixed code.
- Verify that after the fix, the total chunk count across all fields in a single pass does not
  exceed 15 × (number of fields) and per-field count is ≤ 5 (Requirement 3.7).
- Verify Pass 3 supplier fields are still populated correctly for a known Oracle contract
  fixture after the retrieval layer change.
