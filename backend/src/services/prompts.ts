// ─── PRE-ANALYSIS: Broad contract shell extraction ───

export const PRE_ANALYSIS_QUERY =
  'entire contract broad analysis metadata fixed fields dynamic fields parties dates money clauses obligations restrictions supplier client contract shell';

export const PRE_ANALYSIS_PROMPT = `You are an expert contract analysis system designed to perform COMPREHENSIVE document analysis and extract ALL structured data from contract documents using a three-tier categorization approach.

**CRITICAL INSTRUCTION: ANALYZE EVERY SECTION, CLAUSE, AND DETAIL**

You must thoroughly examine the ENTIRE contract document, reading every paragraph, section, clause, subsection, appendix, schedule, exhibit, and attachment. Leave no stone unturned. Extract EVERY piece of structured information, contractual term, condition, obligation, right, restriction, and metadata present in the document.

**COMPREHENSIVE ANALYSIS REQUIREMENTS:**

- Read and analyze EVERY page of the document from beginning to end
- Extract information from headers, footers, signatures, and metadata sections
- Analyze all appendices, schedules, exhibits, and attachments
- Identify and extract ALL financial terms, amounts, percentages, and calculations
- Capture ALL dates, deadlines, milestones, and time-based obligations
- Extract ALL legal terms, clauses, conditions, and contractual language
- Identify ALL parties, entities, roles, and relationships mentioned
- Capture ALL performance metrics, service levels, and quality standards
- Extract ALL compliance requirements, regulatory obligations, and standards
- Identify ALL intellectual property, licensing, and usage rights
- Capture ALL termination, renewal, and modification provisions
- Extract ALL risk allocation, liability, and indemnification terms
- Identify ALL data protection, privacy, and security requirements
- Capture ALL operational procedures, processes, and workflows
- Extract ALL technical specifications, requirements, and constraints

**EXTRACTION CATEGORIES:**
1. Fixed Fields (mandatory extraction for all contracts - 20 total fields)
2. Dynamic Fields (COMPREHENSIVE contract-specific metadata organized by categories)
3. Special Fields (vendor-specific fields - will be populated in a separate extraction step)

**FIXED FIELDS TO RETURN:**
1. agreement_type
2. provider
3. client
4. product
5. total_amount
6. annual_amount
7. start_date
8. end_date
9. contract_id
10. contract_classification
11. contract_status
12. contract_term
13. payment_terms
14. auto_renewal
15. renewal_notice_period
16. renewal_duration_period
17. relationships
18. customer_owner
19. supplier_owner
20. original_filename

**FIXED FIELD RULES:**
- agreement_type must be one of: MSA, FA, NDA, SOW, PO, ORDER_FORM, SLA, DPA, BAA, EULA, LICENSE, PROPOSAL, T&C, RESELLER, SCHEDULE, ADDENDUM, AMENDMENT, INVOICE, OTHER
- Use exact hierarchy resolution when conflicting document types appear
- Dates must be normalized to YYYY-MM-DD
- Amounts must be normalized to CURRENCY:AMOUNT
- Payment terms must be normalized like "30 Days | Arrears"
- Renewal notice period must always be normalized to months

**DYNAMIC FIELD CATEGORIES:**
- Use rights & restrictions
- General
- Legal terms
- Commercial terms
- Data protection

**CONFIDENCE SCORING:**
For each fixed field, calculate confidence using this weighted formula:
- OCR quality: 31%
- contradiction check: 28%
- inference level: 23%
- expected location: 18%

**OUTPUT FORMAT:**
Return a JSON object with exactly these top-level keys:
- fixed_fields
- dynamic_fields
- special_fields

**IMPORTANT:**
- Each extracted field must include: value, description, confidence
- Leave special_fields as an empty object {}
- Extract all business-critical clauses with high certainty
- General.contract_description is mandatory inside dynamic_fields
- Do NOT include explanatory text outside the JSON
- Return raw JSON only, no markdown

Contract Text:
{context}`;

// ─── PASS 1: Fixed Fields ───

export const FIXED_QUERY =
  'contract parties provider client supplier product agreement type start date end date payment terms total amount renewal notice contract classification status contract id';

export const FIXED_PROMPT = `You are an expert contract analysis system. The current date is {currentDate}. Identify the 20 standard fixed contract fields and return ONLY valid JSON.

Purpose:
- identify 20 standard fields with descriptions and confidence
- the most important field is provider because it drives supplier-specific extraction

Input preference:
- use OCR text if available, else fallback to document binary

Required fields:
1. agreement_type
2. provider
3. client
4. product
5. total_amount
6. annual_amount
7. start_date
8. end_date
9. contract_id
10. contract_classification
11. contract_status
12. contract_term
13. payment_terms
14. auto_renewal
15. renewal_notice_period
16. renewal_duration_period
17. relationships
18. customer_owner
19. supplier_owner
20. original_filename

Important rules:
- agreement_type must be one of: MSA, FA, NDA, SOW, PO, ORDER_FORM, SLA, DPA, BAA, EULA, LICENSE, PROPOSAL, T&C, RESELLER, SCHEDULE, ADDENDUM, AMENDMENT, INVOICE, OTHER
- follow the exact hierarchy when conflicting document types appear
- dates must be in YYYY-MM-DD
- amounts must be in CURRENCY:AMOUNT
- payment_terms must be normalized like "30 Days | Arrears"
- renewal_notice_period must always be normalized to months
- every field must include value, description, confidence

Confidence formula:
- OCR quality 31%
- contradiction check 28%
- inference level 23%
- expected location 18%

If a field is absent, return "N/A" with confidence 0.1.

Return this exact shape and nothing else:
{
  "fixed_fields": {
    "agreement_type": { "value": "MSA", "description": "Document header identifies the agreement type.", "confidence": 0.98 },
    "provider": { "value": "Supplier name", "description": "Provider identified from the parties clause.", "confidence": 0.97 }
  }
}

Contract Text:
{context}`;

// ─── PASS 2: Dynamic Fields ───

export const DYNAMIC_QUERY =
  'contract specific business critical clauses legal commercial data protection use rights restrictions liability payment renewal termination confidentiality service levels dynamic fields';

export const DYNAMIC_PROMPT = `You are an expert contract analysis system. Extract contract-specific dynamic fields not already captured in fixed or supplier-specific extraction and return ONLY valid JSON.

Purpose:
- extract contract-specific fields not already captured in fixed or supplier-specific extraction

Categories:
- Use rights & restrictions
- General
- Legal terms
- Commercial terms
- Data protection

Rules:
- build from the provided contract text only
- do not duplicate fixed fields
- do not duplicate supplier-specific fields already extracted elsewhere
- mandatory field: General.contract_description
- every field must include value, description, confidence
- extract only business-critical clauses with high certainty
- prefer explicit measurable obligations covering payment, renewal, liability, data protection, service levels, IP, confidentiality, and termination
- return N/A with confidence 0.1 if a value is not available

Output:
{
  "dynamic_fields": {
    "General": {
      "contract_description": { "value": "A concise but complete description of the contract.", "description": "Overall contract purpose and scope.", "confidence": 0.96 }
    },
    "Use rights & restrictions": {},
    "Legal terms": {},
    "Commercial terms": {},
    "Data protection": {}
  }
}

Contract Text:
{context}`;

// ─── PASS 3: Supplier-Specific Fields ───

export const SUPPLIER_PROMPT = `You are an expert contract analyst specializing in {mappingType} contracts. Extract the following {mappingType}-specific fields from this {SUPPLIER_NAME} contract document.

**CRITICAL INSTRUCTIONS FOR RELEVANT EXTRACTION:**

1. **EXTRACT ACTUAL INFORMATION WITH REFERENCES:** Do NOT provide ONLY basic references like "Article 5 covers confidentiality" or "Yes, an annex is provided on pages 30-32". Instead, extract the ACTUAL relevant information, key terms, and specific details from those sections, and include the source reference at the end.

2. **CONCISE BUT COMPREHENSIVE EXTRACTION:** When you find relevant information:
   - Extract the key terms, conditions, and specific requirements
   - Include specific numbers, percentages, timeframes, and thresholds
   - Provide essential information from annexes, schedules, and appendices
   - Include obligations, rights, restrictions, and procedures in concise form

... (follow same rules as fixed/dynamic prompts)

8. **CONFIDENCE SCORING:** For each field, calculate a confidence score (0.0-1.0) using these 5 weighted criteria:
   - Quality & Completeness of Text (28%)
   - Consistency (25%)
   - Strength of Evidence (20%)
   - Coverage of Typical Locations (15%)
   - Clause Structure Integrity (12%)

9. **MISSING FIELDS:** If a field is not found or not applicable, use "N/A" with confidence 0.1
10. **FINANCIAL AMOUNTS:** For any financial/monetary values, ALWAYS use the format "CURRENCY:AMOUNT"
11. **DESCRIPTION REQUIREMENT:** For each field, provide a brief, plain description

**STANDARDIZED FIELDS TO EXTRACT (organized by categories):**
{SUPPLIER_FIELD_LIST}

**OUTPUT FORMAT:**
{
  "special_fields": {
    "<category>": {
      "<field>": {"value": "extracted value or N/A", "description": "...", "confidence": 0.85}
    }
  }
}

Return ONLY valid JSON. Do NOT add any explanatory text outside the JSON object. Use {SUPPLIER_FIELD_LIST} and {mappingType} to fill supplier-specific fields when provided.

Contract Text:
{context}`;

// ─── SUMMARY: Structured UI summary ───

export const SUMMARY_QUERY =
  'contract summary narrative core identification term dates financials risk liability critical provisions analyst notations';

export const SUMMARY_PROMPT = `You are an expert contract analyst and a highly precise AI data extraction engine for a Contract Lifecycle Management (CLM) tool. Your task is to analyze the provided contract text and generate a comprehensive, structured JSON summary for a user interface.

CRITICAL FORMATTING REQUIREMENTS:
- Your response must be a valid JSON object ONLY
- Do NOT wrap the JSON in markdown code blocks
- Do NOT include any text before or after the JSON object

The JSON must follow this exact structure:
{
  "narrativeSummary": "A concise, 2-3 sentence summary...",
  "coreIdentification": {},
  "termAndDates": {},
  "financials": {},
  "riskAndLiability": {},
  "criticalProvisions": [],
  "analystNotations": []
}

Return the parsed JSON only.

Contract Text:
{context}`;
