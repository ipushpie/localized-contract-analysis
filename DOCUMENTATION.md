# Contract RAG MVP: Complete Technical Documentation

This document provides a comprehensive explanation of every component, algorithm, and flow within the Contract RAG MVP project.

---

## 1. Project Overview
The **Contract RAG MVP** is an automated contract analysis platform. It allows users to upload documents (PDF, DOCX, TXT), extracts their content into a vector database, and uses **Retrieval-Augmented Generation (RAG)** powered by local **Ollama** models to perform deep legal and commercial analysis.

### High-Level Architecture
```
┌──────────────┐     ┌──────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│   Frontend   │────▶│   Backend    │────▶│ PostgreSQL 16      │     │  Ollama Server   │
│   (Next.js)  │     │  (Express)   │     │ (pgvector + HNSW)   │     │ (nomic-embed +   │
│    :3000     │     │    :8000     │     │ :5432               │     │  gpt-oss)        │
└──────────────┘     └──────┬───────┘     └─────────────────────┘     └────────┬─────────┘
                            │                                                  │
                            │  HTTP (Embeddings / Generation)                  │
                            └──────────────────────────────────────────────────┘
```

---

## 2. System Flow
The application follows a linear processing flow from document upload to final analysis.

### Flow Step-by-Step:
1.  **Upload**: User uploads a file. The Backend stores the raw bytes in the `Document` table and returns a `202 Accepted` response.
2.  **Ingestion (Async)**:
    *   **Text Extraction**: Extracts text using `@kreuzberg/node`. If the text is empty, it falls back to OCR via `ocrmypdf`.
    *   **Chunking**: Splits text into semantic chunks using `RecursiveCharacterTextSplitter`.
    *   **Embedding**: Each chunk is converted into a 768-dimension vector via Ollama's `nomic-embed-text` model.
    *   **Vector Storage**: Chunks and their embeddings are stored in PostgreSQL using `pgvector`.
3.  **Ready State**: User sees the document status change from `QUEUED` → `PROCESSING` → `READY`.
4.  **Analysis (On-Demand)**: User clicks "Analyze". The system runs a multi-pass RAG algorithm:
    *   **Pass 1 (Fixed Fields)**: Basic metadata (Parties, Dates, Amounts).
    *   **Pass 2 (Dynamic Fields)**: Legal/Commercial clauses.
    *   **Pass 3 (Supplier-Specific)**: Targeted extraction based on the detected provider (e.g., Oracle, Microsoft, SAP).
    *   **Pass 4 (Summary)**: Narrative and structured UI summary.
5.  **Visualization**: Final results are displayed in categorized cards with confidence scores. The UI supports **Incremental Loading** (showing results as they are saved via `PARTIAL` status) and a **Re-analyse** feature to refresh results.

---

## 3. Core Algorithms & Logic

### A. Document Ingestion Algorithm (`ingestion.ts`)
The ingestion pipeline converts a binary file into a searchable vector index.

*   **Extraction & OCR Fallback**:
    *   `extractBytes(buffer, mimeType)`: Uses native bindings for high-performance text extraction from PDF/DOCX.
    *   **Fallback Logic**: If the resulting `rawText` is empty or null after initial extraction, and `OCR_ENABLED` is set:
        1.  Writes the buffer to a temporary file.
        2.  Executes `ocrmypdf` with `--deskew` and `--output-type pdf`.
        3.  Reads the OCR-processed PDF and re-runs `extractBytes`.

*   **Step-by-Step Dynamic Chunking Algorithm**:
    Unlike static chunking, this system adapts to the document length to ensure optimal RAG performance within LLM context limits:
    1.  **Read Target**: Fetches `targetChunks` from the config (default: **15**).
    2.  **Size Estimation**: Calculates `estimatedChunkSize = Math.max(200, Math.floor(rawText.length / targetChunks))`. This ensures the model receives a fixed number of context pieces regardless of document size.
    3.  **Overlap Calculation**: Sets `chunkOverlap = Math.min(Math.floor(estimatedChunkSize * 0.15), 200)`. A 15% overlap ensures semantic continuity across chunks.
    4.  **Recursive Split**: Uses LangChain's `RecursiveCharacterTextSplitter`. It attempts to split on the following delimiters in order: `"\n\n"`, `"\n"`, `" "`, and `""`. This keeps paragraphs and sentences intact wherever possible while respecting the dynamic `chunkSize`.

*   **Embedding & Parallelization**:
    *   **Batching**: Chunks are processed in batches of **8** (`BATCH = 8`).
    *   **Parallel Execution**: The `embedBatch` helper sends 8 concurrent requests to the Ollama `/api/embeddings` endpoint. 
    *   **Retry Logic**: The embedding service implements a retry mechanism to handle transient network or Ollama server errors.

*   **Bulk Vector Storage (Raw SQL)**:
    Since Prisma does not natively support the `vector` type, the system bypasses the ORM for the final insertion:
    1.  Generates a batch of UUIDs and parameters.
    2.  Constructs a raw SQL query: `INSERT INTO "Chunk" (id, "documentId", "chunkIndex", content, embedding) VALUES ($1,$2,$3,$4,$5::vector), ...`
    3.  The vector is formatted as a stringified array: `"[0.123, -0.456, ...]"`.
    4.  Executes `prisma.$executeRawUnsafe` to commit the batch. This is significantly faster than row-by-row updates.

### B. Retrieval Algorithm (Vector Search)
When analyzing, the system needs the most relevant context. It uses **Cosine Similarity** search:

```sql
SELECT id, content FROM "Chunk"
WHERE "documentId" = $1
ORDER BY embedding <=> $2::vector  -- <=> is the Cosine Distance operator
LIMIT 15
```

### C. Multi-Pass RAG Analysis (`extraction.ts`)
To maintain high accuracy and handle long documents within model context limits, the analysis is split into specific "Passes".

#### Pass 1: Fixed Field Identification
*   **Query**: Focuses on parties, types, and amounts.
*   **Mechanism**: Retrieves the top-N chunks related to "start date", "provider", etc.
*   **Logic**: Maps the raw LLM output to 20 standardized fields (agreement_type, provider, client, etc.).
*   **Post-Processing**: Enriches results (e.g., computing `contract_status` based on dates).

#### Pass 2: Dynamic Clause Extraction
*   **Query**: Focuses on clauses, liability, and data protection.
*   **Logic**: Organizes findings into 5 categories:
    1.  Use rights & restrictions
    2.  General (includes mandatory `contract_description`)
    3.  Legal terms
    4.  Commercial terms
    5.  Data protection

#### Pass 3: Supplier-Specific (Conditional)
*   **Logic**: Checks the `provider` from Pass 1.
*   **Mapping**: Uses `mapping.json` to lookup specific field definitions for recognized suppliers (Oracle, Microsoft, SAP, Red Hat, Salesforce, ServiceNow).
*   **Example**: If "Oracle" is detected, it specifically asks for "ULA enrollment", "CSI number", and "Support level".

#### Pass 4: Narrative Summary
*   **Logic**: Generates a 2-3 sentence overview and populates a UI-friendly structure for the dashboard.

### D. Robust JSON Parsing & Repair
LLMs often include extra text or markdown like ` ```json `. 
*   **Stripping**: Automatically removes `<think>` blocks (for reasoning models) and markdown fences.
*   **Matching**: Scans for the outermost `{` and `}` to isolate the JSON object.
*   **Repair**: If parsing fails twice, the system sends the malformed output back to the LLM with a "Repair Prompt" to reformat it into valid JSON.

### E. Advanced Extraction Logic
The platform uses several procedural layers to ensure output accuracy and completeness.

*   **Extraction Fallback Mechanism (`runPassWithFallback`)**:
    The system automatically detects "Weak Extractions" and retries with a broader context:
    1.  **Check Criteria**: After a pass (e.g., Fixed Fields), the system checks if the result is "weak" (e.g., fewer than 5 meaningful fields found).
    2.  **Recursive Retry**: If weak, it re-runs the LLM prompt, but this time it includes **100% of the document chunks** (ordered by index) instead of just the top-N retrieved chunks. 
    3.  **Context Expansion**: This ensures that even if the vector search missed relevant sections (due to poor semantic overlap), the LLM still has a chance to find the information.

*   **Manual Field Enrichment (`enrichFixedFields`)**:
    After the LLM returns its findings, the backend runs a deterministic enrichment layer:
    1.  **Hierarchy Resolution**: If keywords like "Order Form" or "SOW" are found in the filename or header, they override the LLM's `agreement_type` classification with fixed confidence.
    2.  **Date-Based Status**: Automatically computes `contract_status` (Active/Inactive/Pending) by comparing extracted dates with the execution timestamp.
    3.  **Data Standardisation**: Normalizes booleans (Yes/No) and ensures monetary fields match the `CURRENCY:AMOUNT` pattern.

*   **Holistic Search & Stricter "N/A" Policy**:
    The latest prompt engineering enforces an exhaustive search protocol to minimize missed data:
    1.  **Anti-Lazy Search**: Models are forbidden from returning "N/A" until they have scanned signature blocks, tables, appendices, and referenced exhibits.
    2.  **Explicit Verification**: The model must confirm information is genuinely absent or unsupportable before defaulting to "N/A".
    3.  **Cross-Ref Check**: Prompts now explicitly mention checking "related clauses" and "signature sections" for metadata traditionally found outside the main body text.

---

## 4. Frontend Features

### A. Incremental Loading & Staged Feedback
The UI reflects the multi-pass nature of the backend analysis:
*   **Polling Logic**: Every 3 seconds, the frontend polls `/documents/:id` and `/documents/:id/analysis` during `QUEUED`, `PROCESSING`, `RUNNING`, or `PARTIAL` states.
*   **Staged Visibility**: As soon as `Pass 1` (Fixed Fields) completes, the analysis moves to `PARTIAL` status, and the frontend renders the available data even while `Pass 3` and `Pass 4` are still executing.
*   **Dynamic UX**: Status-specific spinners and progress bars provide real-time feedback on document ingestion and analysis passes.

### B. Comprehensive Summary View
In the latest update, analysis results include a specialized Summary section targeting executive-level visibility:
*   **Narrative Summary**: A concise, 2-3 sentence overview of the document's purpose.
*   **Core Identification**: Standardized identifiers, legal parties, and agreement type.
*   **Term & Dates**: Key dates, contract duration, and auto-renewal deadlines.
*   **Financials**: Total contract value, invoicing frequency, and payment penalties.
*   **Risk & Liability**: Governing law, liability caps, and indemnity scope.
*   **Critical Provisions**: Checklists for high-impact clauses (e.g., Data Breach Notification).
*   **Analyst Notations**: Manual or exceptional risk assessments found during extraction.

### C. Re-analysis Orchestration
For documents with a `DONE` status, users can trigger a fresh analysis:
1.  **Deletion**: Clears previous analysis records from the database.
2.  **State Reset**: The UI immediately wipes the dashboard and returns to an analyzing state.
3.  **Fresh Sweeps**: Re-triggers the staged RAG flow, often used after updating prompts or model configurations.

---

## 5. Examples

### Example: Pass 1 Prompt (Fixed Fields)
The prompt includes the current date and strict rules for normalization.

```text
You are an expert contract analysis system. The current date is 2024-03-30.
Extract ONLY the following 20 fixed fields:
1. agreement_type (MSA, SOW, PO, etc.)
2. provider (Supplier name)
3. client (Customer name)
...
**Important**: Use "N/A" ONLY after searching full text, related clauses, tables, and signature blocks. Do not return "N/A" early.

Return this exact shape:
{ "fixed_fields": { "provider": { "value": "Acme Corp", "confidence": 0.98 } } }

Context:
[1] This Master Services Agreement is between Acme Corp and Globex...
```

### Example: Analysis Output (JSON Shape)
```json
{
  "status": "DONE",
  "fixedFields": {
    "agreement_type": { "value": "MSA", "confidence": 0.99 },
    "provider": { "value": "Microsoft", "confidence": 0.98 },
    "start_date": { "value": "2023-01-01", "confidence": 0.95 }
  },
  "dynamicFields": {
    "General": {
      "contract_description": { "value": "Enterprise software license agreement...", "confidence": 0.96 }
    },
    "Legal terms": {
      "liability_cap": { "value": "Limited to 12 months fees", "confidence": 0.92 }
    }
  },
  "specialFields": {
    "microsoft": {
      "Microsoft Business Agreement": { "value": "MBA-123", "confidence": 0.9 }
    }
  }
}
```

---

## 6. Database Schema (Prisma)

### `Document`
Stores the file binary and its processing metadata.
*   `id`: UUID
*   `fileData`: Bytes (raw file content)
*   `status`: QUEUED | PROCESSING | READY | FAILED
*   `progress`: 0-100

### `Chunk`
Stores the fragmented text and the vector embedding.
*   `content`: Text string
*   `embedding`: `vector(768)` (managed via raw SQL)
*   `chunkIndex`: Order in the document

### `DocumentAnalysis`
Stores the RAG results.
*   `fixedFields`: JSONB (Metadata)
*   `dynamicFields`: JSONB (Clauses)
*   `specialFields`: JSONB (Supplier fields)
*   `sources`: JSONB (Citations)

---

## 7. Setup & Operations

### Deployment
Uses Docker Compose to orchestrate:
1.  **Postgres 16 + pgvector**: Core vector storage.
2.  **Backend**: Express API, handles file logic and RAG orchestration.
3.  **Frontend**: Next.js dashboard.

### Commands
```bash
# Start the whole stack
docker compose up --build -d

# Check live logs for analysis debugging
docker compose logs -f backend

# Re-run migrations and vector setup manually
cd backend
npx prisma migrate deploy
```

---

*This documentation reflects the system implementation as of March 2026.*
