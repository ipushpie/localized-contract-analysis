# Bugfix Requirements Document

## Introduction

The RAG pipeline in `backend/src/services/extraction.ts` retrieves up to 15 chunks per LLM pass using a single broad cosine-similarity query. Many of those chunks are semantically irrelevant to the specific field being extracted, bloating the context window and causing the LLM to produce inaccurate or hallucinated values. Extraction accuracy is currently ~60–70%. The fix replaces the retrieval layer with a LangChain-based pipeline (MultiQueryRetriever + ContextualCompressionRetriever) and introduces per-field targeted retrieval, reducing the chunks sent to the LLM to k=3–5 highly relevant ones per field. The Ollama LLM integration itself is not changed.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a document is analysed and `runPass` is called with a broad query string THEN the system retrieves up to 15 chunks ordered only by cosine similarity to that single query, regardless of how many are actually relevant to the target fields.

1.2 WHEN multiple extraction passes (fixed fields, dynamic fields, supplier fields) are executed THEN the system uses the same pool of up to 15 chunks for every pass, with no per-field targeting, causing irrelevant chunks to dominate the context.

1.3 WHEN the assembled context is sent to the Ollama LLM THEN the system includes duplicate or near-duplicate chunk content across passes because no deduplication step exists, further inflating the prompt size.

1.4 WHEN a field-specific value (e.g. `renewal_notice_period`, `payment_terms`) is extracted THEN the system provides the LLM with chunks that may contain unrelated clauses from other sections of the contract, reducing extraction precision.

### Expected Behavior (Correct)

2.1 WHEN a document is analysed THEN the system SHALL retrieve k=3–5 chunks per field using a LangChain retriever backed by the existing pgvector store, replacing the current single broad query that returns up to 15 chunks.

2.2 WHEN retrieval is performed for a given field or pass THEN the system SHALL use a MultiQueryRetriever to generate multiple query variations from the field-specific query, improving recall without increasing k.

2.3 WHEN chunks are retrieved for a field THEN the system SHALL apply a ContextualCompressionRetriever to strip irrelevant passages from within each chunk before the content is included in the LLM prompt.

2.4 WHEN each of the ~20 fixed fields (and dynamic/supplier fields) is extracted THEN the system SHALL generate a field-specific query and retrieve a dedicated set of chunks for that field, with no chunk reuse across fields within the same pass.

2.5 WHEN the final context is assembled before the LLM call THEN the system SHALL deduplicate chunks by content hash and concatenate only the unique, compressed results, keeping total context minimal.

2.6 WHEN the LangChain retrieval layer is integrated THEN the system SHALL expose modular functions `createRetriever()`, `getRelevantChunks(query, documentId)`, and `buildContext(docs)` so each concern is independently testable and replaceable.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the Ollama LLM is called for generation THEN the system SHALL CONTINUE TO use the existing `ollamaGenerate` / `ollamaGenerateWithRetry` functions without modification.

3.2 WHEN a document has been ingested and its chunks stored in the `Chunk` table with pgvector embeddings THEN the system SHALL CONTINUE TO use those same embeddings as the vector source for retrieval.

3.3 WHEN extraction passes complete THEN the system SHALL CONTINUE TO persist `fixedFields`, `dynamicFields`, and `specialFields` to `DocumentAnalysis` in the same JSON shape expected by the frontend.

3.4 WHEN a supplier-specific pass (Pass 3) is executed THEN the system SHALL CONTINUE TO resolve the supplier key from `fixedFields.provider` and apply the corresponding mapping from `mapping.json`.

3.5 WHEN the combined Pass 1+2 optimisation path is taken THEN the system SHALL CONTINUE TO attempt a single LLM call for both fixed and dynamic fields before falling back to separate passes.

3.6 WHEN chunk ingestion runs THEN the system SHALL CONTINUE TO produce the same chunk count and embedding vectors in the `Chunk` table — the ingestion pipeline is not modified.

3.7 WHEN the total number of chunks retrieved per field is determined THEN the system SHALL NOT exceed the current maximum of 15 chunks in aggregate, keeping context size equal to or smaller than today.
