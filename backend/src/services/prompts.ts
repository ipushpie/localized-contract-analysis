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

// --- Tier 1: FULL Fixed Fields Prompt (user-provided) ---
export const FIXED_PROMPT_FULL = `You are an expert contract analysis system. The current date is {currentDate}. Extract ONLY the following 20 fixed fields from this contract document with brief, clear descriptions.

**CRITICAL INSTRUCTION: COMPREHENSIVE DOCUMENT ANALYSIS FOR CONFLICTS**

For each field extraction, you must:
1. **Scan the ENTIRE document** for all relevant information
2. **Identify any conflicting or contrary information** elsewhere in the document 
3. **Note exceptions, special conditions, or edge cases**
4. **Provide concise descriptions** in plain language that explain any conflicts or important context

**FIXED FIELDS TO EXTRACT:**

1. **agreement_type**: 
Return exactly ONE agreement_type from the allowed values. Prioritise explicit agreement type detection in the document over inferred classification.
 
**Allowed values (use standardized abbreviations):**
MSA, FA, NDA, SOW, PO, ORDER_FORM, SLA, DPA, BAA, EULA, LICENSE, PROPOSAL, T&C, RESELLER, SCHEDULE, ADDENDUM, AMENDMENT, INVOICE, OTHER
 
**OUTPUT RULES:**
- Output exactly one label (single token from the allowed values).
- Do not invent new labels.
- Do not output multiple values.
- If multiple types appear, apply the hierarchy rules below.
- If uncertain, return OTHER.
- Once a classification is determined under STEP 1 or STEP 2, STOP and do not continue to STEP 3.
 
**STEP 1 — EXPLICIT AGREEMENT TYPE DETECTION (highest priority)**
Search the document for explicit statements that define the document type, such as:
- Title/header. If the title/header contains an explicit type, the title/header overrides any other type references in the document.
- Introductory clauses: e.g., "This [x] agreement… ”
- Defined terms section defining what “this agreement” is.
- Only treat an agreement type as explicit if it refers to THIS document (title/header, “This [X] Agreement…”, or definition of “this Agreement”). Ignore references to other agreements unless they explicitly say THIS document is that type.

If an explicit type is found, apply ONLY the normalization rules below.
 
**NORMALIZATION / MAPPING RULES:**
 
* Map the following terms to **SCHEDULE**: Annex, Annexure, Appendix, Exhibit, Attachment, Schedule.
* Map the following terms to **AMENDMENT**: Amendment, Amending Agreement, Change Order (if modifying existing clauses), Variation Agreement.
* Map the following terms to **ADDENDUM**: Addendum (if adding provisions without modifying existing text).
* Map “Master Services Agreement” or “Master Agreement” → **MSA**
* Map “Framework Agreement” → **FA**
* Map “Statement of Work” → **SOW**
* Map “Order Form” or “Service Order” → **ORDER_FORM**
* Map “Purchase Order” → **PO**
* Map “Data Processing Agreement” → **DPA**
* Map “Business Associate Agreement” → **BAA**
* Map “Terms and Conditions” → **T&C**
* Map “End User License Agreement” → **EULA**
* Map “License Agreement” → **LICENSE**
* Map “Reseller Agreement” → **RESELLER**
* Map “Service Level Agreement” → **SLA**
* Map “Invoice” → **INVOICE**
 
**STEP 2 — MULTIPLE EXPLICIT TYPES: RESOLVE WITH DOCUMENT HIERARCHY**
If multiple explicit types are present (e.g., “Order Form in the same document under the Master Services Agreement”):
A) Determine which one refers to THIS document (self-reference cues):
- "this Agreement", "this Addendum", "this Order Form", "this Statement of Work"
- the document title/header
B) If still multiple candidates, apply **PRECEDENCE**:
AMENDMENT > ADDENDUM > SCHEDULE > SOW > ORDER_FORM > PO > SLA > DPA > BAA > NDA > MSA > FA > LICENSE > EULA > RESELLER > T&C > PROPOSAL > INVOICE > OTHER
 
**STEP 3 — NO EXPLICIT TYPE: INFER USING DEFINITIONS**
Only if the document never explicitly states its own type, infer from content using these definitions:
 
- **MSA** – Master governing terms for multiple future SOWs/Orders.
- **FA** – Framework agreement requiring call-offs/orders.
- **NDA** – Confidentiality-focused agreement.
- **SOW** – Specific scope/deliverables/timeline under a master.
- **PO** – Purchase Order with items/quantities/prices.
- **ORDER_FORM** – Subscription/service order referencing governing terms.
- **SLA** – Service level metrics (uptime, credits, support).
- **DPA** – Personal data processing terms (GDPR etc.).
- **BAA** – HIPAA business associate agreement.
- **EULA** – End-user software terms.
- **LICENSE** – Standalone license grant.
- **PROPOSAL** – Commercial offer; not executed as binding agreement.
- **T&C** – Standard terms without master structure.
- **RESELLER** – Resale rights/partner terms.
- **SCHEDULE** – Annex/attachment to a main agreement.
- **ADDENDUM** – Adds provisions, doesn’t modify old text.
- **AMENDMENT** – Modifies specific clauses of an existing agreement.
- **INVOICE** – Billing request.
- **OTHER** – None fit clearly.

2. **provider**: Service/product provider company name (the supplier/vendor)
3. **client**: Customer/client company name
4. **product**: Primary product or service being contracted
5. **total_amount**: Format as "CURRENCY_CODE:AMOUNT" (e.g., "USD:1250000.00", "EUR:808668.96"). Extract the base contract value excluding taxes, VAT, or other additional fees unless they are explicitly included as part of the core contract value.
6. **annual_amount**: Year-by-year breakdown of contract value excluding taxes, VAT, or other additional fees unless explicitly included as part of the core contract value. If explicitly mentioned in contract (e.g., "Year 1: $50,000, Year 2: $60,000"), extract as-is. If not mentioned, calculate as follows:
  - Convert contract_term from months to years (divide by 12)
  - If contract_term >= 12 months: Divide total_amount by years (e.g., 18 months = 1.5 years, so USD:150000.00 ÷ 1.5 = USD:100000.00 per year)
  - If contract_term < 12 months: Calculate proportional annual value by multiplying (e.g., 6 months with USD:50000.00 = USD:100000.00 annual rate)
  - Format examples:
    * 24 months, USD:120000.00 → "Year 1: USD:60000.00, Year 2: USD:60000.00"
    * 18 months, USD:150000.00 → "Year 1: USD:100000.00, Year 2 (6 months): USD:50000.00"
    * 6 months, USD:50000.00 → "Annual rate: USD:100000.00 (6 months actual: USD:50000.00)"
  Use "N/A" if total_amount or contract_term cannot be determined.
7. **start_date**: Contract start date in YYYY-MM-DD format
8. **end_date**: Contract expiration date in YYYY-MM-DD format
9. **contract_id**: Any unique identifier (contract number, reference number, agreement ID)
10. **contract_classification**: Use only these values: SAAS|IAAS|PAAS|PROFESSIONAL_SERVICES|MANAGED_SERVICES|HARDWARE|RESELLER|NETWORK|OTHER
11. **contract_status**: Determine current contract status ("Active" if currently in effect, "Inactive" if expired or not yet started, "Unknown" if dates are unclear or missing)
12. **contract_term**: Extract contract duration from document text (e.g., "24 months", "3 years", "36 months"). If not explicitly stated, calculate from start_date and end_date and format as months (e.g., "17 months"). Use "N/A" if cannot be determined.
13. **payment_terms**: Extract payment terms including duration and timing. Format as "X Days | Advanced" or "X Days | Arrears" (e.g., "30 Days | Advanced", "45 Days | Arrears", "Net 30 Days | Arrears"). If only duration is mentioned without timing, default to "Arrears". Use "N/A" if not specified.
14. **auto_renewal**: Whether contract automatically renews ("Yes" or "No" - must be determined from contract text, default to "No" if unclear)
15. **renewal_notice_period**: Notice period required to prevent renewal (ALWAYS format as "X months" only, e.g., "1 month", "3 months", "6 months", "12 months"). This is NOT the general termination or cancellation notice period—extract only the notice period specifically required to prevent automatic renewal of the contract. Convert days to months: 30 days = "1 month", 60 days = "2 months", 90 days = "3 months". Use "N/A" if not specified)
16. **renewal_duration_period**: If the contract auto-renews, specify the duration period for each renewal cycle (ALWAYS format as "X months" only, e.g., "12 months", "24 months", "36 months"). This is the length of each automatic renewal period. Convert years to months: 1 year = "12 months", 2 years = "24 months". Use "N/A" if auto_renewal is "No" or if renewal duration is not specified)
17. **relationships**: Any references to other documents mentioned in this contract (comma-separated string of document names, contract IDs, file names, or any document references found in the text; capture exactly as mentioned; "N/A" if no references found)
18. **customer_owner**: The person who owns the agreement on the customer/client side or should be contacted regarding the agreement from the customer organization. Look for contract managers, business owners, or authorized representatives from the client side. If explicitly mentioned, extract the name and contact details. If not, fallback to the signing person from the customer organization. Format as "Name (Contact Info)" if available, otherwise just the name. Use "N/A" if not found.
19. **supplier_owner**: The person who owns the agreement on the supplier/provider side or should be contacted regarding the agreement from the supplier organization. Look for account managers, sales representatives, or authorized representatives from the supplier side. If explicitly mentioned, extract the name and contact details. If not, fallback to the signing person from the supplier organization. Format as "Name (Contact Info)" if available, otherwise just the name. Use "N/A" if not found.
20. **original_filename**: The original filename of the uploaded document

**DESCRIPTION REQUIREMENTS:**
For each field, provide a brief, plain description that includes:
- Any conflicting or contrary information found elsewhere in the document
- Special conditions, edge cases, or exceptions that apply
- Important context that affects the interpretation
- Keep descriptions concise and conversational

**CONFIDENCE SCORING:**
Use a weighted scoring approach based on these four criteria:

1. **OCR Quality (31% weight):** Is the input OCR quality sufficient for the output?
  - High (0.9-1.0): Text is clear, legible, no missing characters or formatting issues
  - Good (0.7-0.9): Minor OCR artifacts, text mostly clear with occasional issues
  - Moderate (0.5-0.7): Some OCR errors present, text readable but may have gaps
  - Poor (0.3-0.5): Significant OCR errors, text partially illegible
  - Very Poor (0.1-0.3): Severe OCR issues, text mostly unreadable

2. **Contradiction Check (28% weight):** Is the requested extraction NOT contradicted in the document?
  - No Contradiction (0.9-1.0): Information is consistent throughout document
  - Minor Conflict (0.7-0.9): Slight inconsistencies but primary source is clear
  - Moderate Conflict (0.5-0.7): Some contradictory info, resolution through interpretation
  - Significant Conflict (0.3-0.5): Multiple conflicting statements, best guess provided
  - Major Contradiction (0.1-0.3): Highly contradictory or missing information

3. **Inference Level (23% weight):** Is the extraction explicit vs. inferred?
  - Explicit (0.9-1.0): Directly stated with exact wording
  - Mostly Explicit (0.7-0.9): Clearly stated with minimal interpretation needed
  - Moderate Inference (0.5-0.7): Requires reasonable interpretation or calculation
  - High Inference (0.3-0.5): Requires significant interpretation or assumption
  - Speculative (0.1-0.3): Highly inferred, uncertain, or guessed

4. **Expected Location (18% weight):** Is the extraction in the clause/section where it's typically found?
  - Standard Location (0.9-1.0): Found in expected section (e.g., payment terms in financial section)
  - Near Expected (0.7-0.9): Found in related section, not exact standard location
  - Unusual Location (0.5-0.7): Found in unexpected but relevant section
  - Very Unusual (0.3-0.5): Found in unrelated section
  - Not in Expected Location (0.1-0.3): Not found where expected, extracted from elsewhere

**FINAL CONFIDENCE CALCULATION:**
Calculate weighted average: (OCR_score × 0.31) + (Contradiction_score × 0.28) + (Inference_score × 0.23) + (Location_score × 0.18)
Round to 2 decimal places (e.g., 0.87)

**OUTPUT FORMAT:**
Return a valid JSON object with this exact structure:

{
  "fixed_fields": {
   "agreement_type": {
    "value": "MSA", 
    "description": "...",
    "confidence": 0.95
   },
   ...
  }
}

**IMPORTANT:**
- Extract ONLY these 20 fixed fields, nothing else
- Focus on identifying the provider/supplier accurately as this will be used for subsequent targeted extraction
- Your response MUST be a valid JSON object matching the exact structure shown above
- Do not include explanatory text outside the JSON
`;

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

// --- Tier 2: FULL Dynamic Fields Prompt (user-provided) ---
export const DYNAMIC_PROMPT_FULL = `You are an expert contract analyst and a highly precise AI data extraction engine for Contract Lifecycle Management (CLM). Extract EVERY relevant contract-specific field found in the document and organize them into the specified categories. RETURN ONLY valid JSON matching the exact structure described below.

CRITICAL EXTRACTION RULES:
- Perform exhaustive analysis across the ENTIRE document, including appendices, exhibits, schedules, and attachments.
- Do NOT extract fixed fields (these are handled in the fixed-fields pass).
- Do NOT extract supplier-specific fields (these are handled in the supplier-specific pass).
- Only extract business-critical clauses when you are VERY confident (>=0.95).
- If a value cannot be determined with high confidence, return "N/A" with confidence 0.1.
- For any monetary values use format "CURRENCY:AMOUNT" (e.g., "USD:50000.00").
- Each field must include: value, description, confidence (0.0-1.0).

MANDATORY FIELD (General.contract_description):
- Provide a comprehensive contract description covering purpose, scope, deliverables, parties, and how the contract value was determined. Include section references and any calculations used to justify value conclusions.

CATEGORIES TO EXTRACT (include all relevant fields discovered):
1) Use rights & restrictions
  - Usage limitations, access restrictions, permitted uses, prohibited activities, user limitations, capacity constraints, geographic restrictions, time-based limitations, feature restrictions
2) General
  - Administrative details, contract_description (MANDATORY), definitions, performance metrics, implementation requirements, support and maintenance, termination, renewal, notices, transition obligations
3) Legal terms
  - Governing law, dispute resolution, indemnities, warranties, representations, confidentiality, audit rights, regulatory obligations
4) Commercial terms
  - Payment schedule, invoicing frequency, late fees, tax responsibility, price adjustment mechanisms, true-ups, service credits, budget caps
5) Data protection
  - Data processing obligations, breach notification timelines, encryption requirements, data residency, deletion and return obligations

CONFIDENCE SCORING (per field):
- Compute as weighted sum: Quality(28%) + Consistency(25%) + Evidence(20%) + Location(15%) + ClauseIntegrity(12%). Return value as 0.0-1.0.

OUTPUT FORMAT (exact):
{
  "dynamic_fields": {
   "Use rights & restrictions": { /* fields */ },
   "General": { "contract_description": { "value": "...", "description": "...", "confidence": 0.96 }, ... },
   "Legal terms": { /* fields */ },
   "Commercial terms": { /* fields */ },
   "Data protection": { /* fields */ }
  }
}

Return ONLY the JSON object above. Do NOT include any additional text.

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

// --- Tier 3: FULL Supplier-Specific Prompt (user-provided) ---
export const SUPPLIER_PROMPT_FULL = `You are an expert contract analyst specializing in \${mappingType} contracts. Extract the following \${mappingType}-specific fields from this \${supplierDisplayName} contract document.

**CRITICAL INSTRUCTIONS FOR RELEVANT EXTRACTION:**

1. **EXTRACT ACTUAL INFORMATION WITH REFERENCES:** Do NOT provide ONLY basic references like "Article 5 covers confidentiality" or "Yes, an annex is provided on pages 30-32". Instead, extract the ACTUAL relevant information, key terms, and specific details from those sections, and include the source reference at the end (e.g., "specific requirements here (Article 5)").

2. **CONCISE BUT COMPREHENSIVE EXTRACTION:** When you find relevant information:
  - Extract the key terms, conditions, and specific requirements (not full clause text)
  - Include specific numbers, percentages, timeframes, and thresholds
  - Provide the essential information from annexes, schedules, and appendices
  - Extract key definitions and important details, not just references to where they are located
  - Include specific obligations, rights, restrictions, and procedures in concise form

3. **RELEVANT VALUE EXTRACTION:** For each field:
  - Extract the key terms and important conditions (summarized, not full text)
  - Include specific requirements and important details
  - Provide actual numbers, percentages, timeframes, and thresholds
  - Extract essential definitions and key explanations
  - Include important procedures and requirements in concise form

4. **AVOID BASIC REFERENCES ONLY:** Never respond with ONLY basic references like:
  - "Article X covers this topic" (without the actual information)
  - "Section Y provides details" (without the actual details)
  - "An annex is provided on pages Z" (without the actual content)
  - "Covered in detail in the agreement" (without the actual details)
  - Basic yes/no answers without supporting details

5. **PROVIDE RELEVANT DETAILS WITH REFERENCES:** Always include:
  - Key information and important conditions from relevant clauses
  - Specific requirements, obligations, and restrictions
  - Important procedures and processes
  - Essential definitions and explanations
  - Actual terms, conditions, and specifications
  - Include source references (e.g., "Article 5", "Section 3.2") AFTER the actual information

6. **\${mappingType.toUpperCase()} CONTEXT:** Understand that this contract follows \${mappingType} patterns and terminology
7. **STANDARDIZED OUTPUT:** Return results using the standardized field names provided below, organized by categories
8. **CONFIDENCE SCORING:** For each field, calculate a confidence score (0.0-1.0) using these 5 weighted criteria:
  - **Quality & Completeness of Text (28%):** Assess whether the text is clear, readable, and sufficiently complete to evaluate the field
  - **Consistency (25%):** Check if any text contradicts the extraction (for found) or suggests the clause should exist (for not_found)
  - **Strength of Evidence (20%):** Evaluate how explicitly the clause appears or how strongly the text supports its absence
  - **Coverage of Typical Locations (15%):** Check if clause is in expected sections or if typical locations were reviewed
  - **Clause Structure Integrity (12%):** Assess if extracted text matches expected structural elements or if absence is coherent with document structure
   
  **Calculate:** (Criterion_1 × 0.28) + (Criterion_2 × 0.25) + (Criterion_3 × 0.20) + (Criterion_4 × 0.15) + (Criterion_5 × 0.12)
   

9. **MISSING FIELDS:** If a field is not found or not applicable, use "N/A" with confidence 0.1
10. **FINANCIAL AMOUNTS:** For any financial/monetary values, ALWAYS use the format "CURRENCY:AMOUNT" (e.g., "USD:50000", "EUR:25000.50"). Extract both currency and amount together.
11. **DESCRIPTION REQUIREMENT:** For each field, provide a brief, plain description that explains what the field represents in business context, similar to how dynamic fields include descriptions.

**STANDARDIZED FIELDS TO EXTRACT (organized by categories):**
[CATEGORIES AND FIELDS LOADED FROM JSON...]

**OUTPUT FORMAT:**
Return a valid JSON object with this exact categorical structure:

{
  "special_fields": {
   "Category Name": {
    "field_name": {"value": "extracted value or N/A", "description": "...", "confidence": 0.85}
   }
  }
}

**CRITICAL EXTRACTION REQUIREMENTS:**
- Extract ACTUAL RELEVANT INFORMATION, not basic references or article numbers
- Include key terms, conditions, requirements, and important details (concise, not full clause text)
- Provide essential definitions, obligations, restrictions, and specifications from the document
- Extract actual numbers, percentages, timeframes, thresholds, and specific requirements
- Include important information from annexes, schedules, appendices, and referenced sections
- Your response MUST be a valid JSON object matching the exact categorical structure shown above
- Organize extracted fields under the appropriate categories as shown
- Do not include explanatory text outside the JSON
- Each field should have "value" (with relevant actual information), "description" (brief business-context explanation), and "confidence" properties

... (EXAMPLES AND RULES TRUNCATED FOR BREVITY IN-CODE)

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

// --- FULL SUMMARY PROMPT (user-provided) ---
export const SUMMARY_PROMPT_FULL = `You are an expert contract analyst and a highly precise AI data extraction engine for a Contract Lifecycle Management (CLM) tool. Your task is to analyze the provided contract text and generate a comprehensive, structured JSON summary for a user interface.

CRITICAL FORMATTING REQUIREMENTS:
- Your response must be a valid JSON object ONLY
- Do NOT wrap the JSON in markdown code blocks
- Do NOT include any text before or after the JSON object
- Do NOT use any markdown formatting whatsoever
- Return raw JSON only

Extract information directly from the contract without citations or references. If information is not found, use "N/A".

The JSON must follow this exact structure:
{
  "narrativeSummary": "A concise, 2-3 sentence summary paragraph that states the document type, the main parties, the total value, and the service period. Include the core purpose and key products or services involved.",
  "coreIdentification": {
    "documentType": "Extract the formal type of the agreement",
    "contractId": "Extract the unique contract number or identifier",
    "client": "Extract the full legal name of the customer entity",
    "supplier": "Extract the full legal name of the vendor entity"
  },
  "termAndDates": {
    "offerExpirationDate": "Extract the date by which the offer must be accepted",
    "effectiveDate": "Extract the start date of the agreement",
    "expirationDate": "Extract the end date of the agreement, or state 'Indefinite'",
    "contractTerm": "Extract the duration, e.g., 3 Years, 17 months",
    "autoRenewal": "Extract Yes or No",
    "renewalDeadline": "Extract the date the customer must act by to ensure no service interruption",
    "noticePeriodForTermination": "Extract the notice period required for termination for convenience"
  },
  "financials": {
    "totalContractValue": "Extract the total monetary value",
    "paymentTerms": "Extract the payment conditions, e.g., Net 30",
    "invoicingFrequency": "Extract the billing cycle, e.g., Annually in Advance, Monthly",
    "refundability": "Extract whether payments are non-refundable",
    "taxResponsibility": "Note if the price is exclusive of taxes and who is responsible for them",
    "priceAdjustmentClause": "Provide a brief summary of the mechanism",
    "latePaymentPenalty": "Extract the interest rate or fee for late payments"
  },
  "riskAndLiability": {
    "governingAgreement": "Extract the name or type of the primary agreement that governs this order",
    "orderOfPrecedence": "Summarize which document's terms prevail in case of a conflict",
    "governingLaw": "Extract the state, country, or jurisdiction",
    "limitationOfLiability": "Extract the cap on liability, summarizing the core financial limit",
    "indemnification": "Provide a brief summary of the core indemnification duty",
    "auditRights": "Extract Yes or No"
  },
  "criticalProvisions": [
    {
      "name": "Exact Clause Name from checklist: Change of Control, Data Breach Notification, Step-In Rights, Subcontracting Rights, Non-Solicitation / Non-Compete, IP Ownership (Developed Materials), Benchmarking / Price Review, Disaster Recovery / Business Continuity",
      "summary": "Concise, one-sentence summary of its key terms"
    }
  ],
  "analystNotations": [
    {
      "title": "Clear title for the clause",
      "description": "Summary of highly unusual, risky, or exceptional provisions not in the standard checklist"
    }
  ]
}

REMEMBER: Return ONLY the raw JSON object without any markdown formatting or code blocks.

Contract Text:
{context}`;
