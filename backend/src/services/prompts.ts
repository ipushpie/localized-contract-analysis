// ─── OLLAMA PROMPTS ───

// ─── Multistrat Tiered Extraction Prompts ───

// PRE-ANALYSIS: Broad contract shell extraction
export const OLLAMA_PRE_ANALYSIS_QUERY =
  'entire contract broad analysis metadata fixed fields dynamic fields parties dates money clauses obligations restrictions supplier client contract shell';

export const OLLAMA_PRE_ANALYSIS_PROMPT = `You are an expert contract analysis system designed to perform COMPREHENSIVE document analysis and extract ALL structured data from contract documents using a three-tier categorization approach. The current date is {currentDate}.

**CRITICAL INSTRUCTION: ANALYZE EVERY SECTION, CLAUSE, AND DETAIL**
You must thoroughly examine the ENTIRE contract document, reading every paragraph, section, clause, subsection, appendix, schedule, exhibit, and attachment. Leave no stone unturned. Extract EVERY piece of structured information, contractual term, condition, obligation, right, restriction, and metadata present in the document.

**COMPREHENSIVE ANALYSIS REQUIREMENTS:**
- Read and analyze EVERY page of the document from beginning to end
- Extract information from headers, footers, signatures, and metadata sections
- Analyze all appendices, schedules, exhibits, and attachments
- Identify and extract ALL financial terms, amounts, percentages, and calculations
- Capture ALL dates, deadlines, milestones, and time-based obligations
- Extract ALL legal terms, clauses, conditions, and contractual language
- Identify and extract ALL conflict and contradiction points in the text

**MISSING DATA RULE:**
If any field or value is not found, not applicable, or cannot be determined with high confidence, you MUST return "N/A" for the value. Do not leave fields empty or provide speculative data.


**EXTRACTION CATEGORIES:**

1. **Fixed Fields** (MANDATORY nested structure for all 24 fields):
Every field in this category MUST be an object: { "value": "...", "description": "...", "confidence": 0.0 }

- **agreement_type**: Return exactly ONE standardized label: ORDER_FORM, MSA, FA, NDA, SOW, PO, SLA, DPA, BAA, EULA, LICENSE, PROPOSAL, T&C, RESELLER, SCHEDULE, ADDENDUM, AMENDMENT, INVOICE, OTHER.
  * *Hierarchy*: Use document title/header first. If multiple, use precedence: AMENDMENT > ADDENDUM > SCHEDULE > SOW > ORDER_FORM > PO > SLA > DPA > BAA > NDA > MSA > FA > LICENSE > EULA > RESELLER > T&C > PROPOSAL > INVOICE > OTHER.
- **provider**: Service/product provider company name.
- **client**: Customer/client company name.
- **contract_classification**: Use: SAAS | IAAS | PAAS | PROFESSIONAL_SERVICES | MANAGED_SERVICES | HARDWARE | RESELLER | NETWORK | OTHER.
- **total_amount**: Format as "CURRENCY:AMOUNT" (e.g., "EUR:803920.18"). Base contract value excluding taxes.
- **annual_amount**: Annualized value breakdown. If term is 18 months and total is 150k, format as: "Year 1: CURRENCY:100000.00, Year 2 (6 months): CURRENCY:50000.00".
- **start_date**: YYYY-MM-DD.
- **end_date**: YYYY-MM-DD.
- **contract_id**: Unique identifier (reference number, contract number).
- **product**: Primary product or service.
- **contract_status**: "Active", "Inactive", or "Unknown" based on {currentDate}.
- **contract_term**: Extract duration (e.g., "12 months", "3 years"). If not explicitly stated, calculate and format as months.
- **payment_terms**: Format as "X Days | Timing" (e.g., "30 Days | Arrears", "45 Days | Advanced").
- **auto_renewal**: "Yes" or "No".
- **safe_auto_renewal**: "Yes" if pricing is capped/notice is short, else "No" or "N/A".
- **renewal_notice_period**: Notice specifically required to prevent auto-renewal (e.g. "3 months"). Convert 90 days to "3 months".
- **renewal_duration_period**: Length of each renewal term (e.g. "12 months").
- **intervention_opportunity**: Specific date or event for renegotiation.
- **relationships**: Any references to other documents (comma-separated).
- **customer_owner**: Name (Contact Info). Fallback to signing person.
- **supplier_owner**: Name (Contact Info). Fallback to account manager.
- **original_filename**: The original filename provided in metadata.

2. **Dynamic Fields** (MANDATORY nested structure organized by categories):
Extract EVERY relevant term found and organize into these categories:
- **Use rights & restrictions**
- **General** (MUST include "contract_description" - a narrative summary of scope and value justification)
- **Legal terms**
- **Commercial terms**
- **Data protection**

**DESCRIPTION REQUIREMENTS:**
For every field, provide a "description" field with:
- Business context and source reference (e.g. "Article 5.1").
- Note any conflicting or contrary information found elsewhere in the document.
- Note exceptions, special conditions, or edge cases.

**CONFIDENCE SCORING:**
Calculate a weighted average (0.0-1.0) using:
- **OCR Quality (31%):** Clarity and legibility of text.
- **Contradiction Check (28%):** Information consistency throughout.
- **Inference Level (23%):** Explicit (1.0) vs. Speculative (0.1).
- **Expected Location (18%):** Found in standard section (1.0) vs unusual (0.1).

**OUTPUT FORMAT:**
Return a valid JSON object with this exact structure:
{
  "fixed_fields": {
    "agreement_type": { "value": "MSA", "description": "Header title identifies this as MSA. Article 1 defines it.", "confidence": 0.95 },
    ...
  },
  "dynamic_fields": {
    "Use rights & restrictions": { "field_name": { "value": "...", "description": "...", "confidence": 0.8 } },
    ...
  }
}

Contract Text:
{context}`;

// FIXED_QUERY & FIXED_PROMPT
export const OLLAMA_FIXED_QUERY =
  'contract parties provider client supplier product agreement type start date end date payment terms total amount renewal notice contract classification status contract id';

export const OLLAMA_FIXED_PROMPT = OLLAMA_PRE_ANALYSIS_PROMPT;
export const OLLAMA_FIXED_PROMPT_FULL = OLLAMA_PRE_ANALYSIS_PROMPT;

// DYNAMIC_QUERY & DYNAMIC_PROMPT
export const OLLAMA_DYNAMIC_QUERY =
  'contract specific business critical clauses legal commercial data protection use rights restrictions liability payment renewal termination confidentiality service levels dynamic fields';

export const OLLAMA_DYNAMIC_PROMPT = `You are an expert contract analysis system. Extract ONLY dynamic contract-specific fields from this contract document and organize them into the specified categories. Do not extract fixed fields or supplier-specific fields.

{exclusionText}

**DYNAMIC FIELDS TO EXTRACT:**
Extract EVERY relevant contract-specific field found in the document and organize them into the following categories:

**Use rights & restrictions:** Usage limitations, access restrictions, permitted uses, prohibited activities, etc.
**General:** MUST include a "contract_description" (narrative of scope, value justification, section references).
**Legal terms:** Liability, indemnification, confidentiality, governing law, IP rights.
**Commercial terms:** Payment schedules, billing, currency, tax, financial penalties.
**Data protection:** GDPR, security measures, retention policies.

**MANDATORY SCHEMA:**
Every field MUST be an object:
- value: Extracted data
- description: EXHAUSTIVE business context + source reference + conflict notes.
- confidence: Score (0.0-1.0)

**⚠️ CRITICAL EXTRACTION RULE: CERTAINTY (>=0.95)**
Only extract business-critical clauses when you are VERY confident. If any value is missing or uncertain, return "N/A" for the value with confidence 0.1.


**OUTPUT FORMAT:**
{
  "dynamic_fields": {
    "Use rights & restrictions": { ... },
    "General": { ... },
    "Legal terms": { ... },
    "Commercial terms": { ... },
    "Data protection": { ... }
  }
}

Contract Text:
{context}`;

export const OLLAMA_DYNAMIC_PROMPT_FULL = OLLAMA_DYNAMIC_PROMPT;

// SUPPLIER_PROMPT
export const OLLAMA_SUPPLIER_PROMPT = `You are an expert contract analyst specializing in {mappingType} contracts. Extract the following {mappingType}-specific fields from this {SUPPLIER_NAME} contract document.

**INSTRUCTIONS:**
1. **EXTRACT ACTUAL INFORMATION:** Provide specifics, not just "Article 5 covers this".
2. **CONCISE BUT COMPREHENSIVE:** Include numbers, percentages, and obligations.
3. **FINANCIAL AMOUNTS:** Use "CURRENCY:AMOUNT".
4. **SCHEMA**: Every field must be { "value": "...", "description": "...", "confidence": 0.8 }.
5. **MISSING FIELDS**: If a field is not present or not applicable, you MUST use "N/A" for the value.


**STANDARDIZED FIELDS TO EXTRACT:**
{SUPPLIER_FIELD_LIST}

**OUTPUT FORMAT:**
{
  "special_fields": {
    "<category>": {
      "<field>": {"value": "...", "description": "...", "confidence": 0.85}
    }
  }
}

Contract Text:
{context}`;

export const OLLAMA_SUPPLIER_PROMPT_FULL = OLLAMA_SUPPLIER_PROMPT;

// SUMMARY
export const OLLAMA_SUMMARY_QUERY =
  'contract summary narrative core identification term dates financials risk liability critical provisions analyst notations';

export const OLLAMA_SUMMARY_PROMPT = `You are an expert contract analyst and a highly precise AI data extraction engine for a CLM tool. Your task is to analyze the text and generate a comprehensive, structured JSON summary for a user interface.

The JSON must follow this exact structure:
{
  "narrativeSummary": "2-3 sentence summary paragraph. Document type, parties, value, service period, purpose.",
  "coreIdentification": {
    "documentType": "...",
    "contractId": "...",
    "client": "...",
    "supplier": "..."
  },
  "termAndDates": {
    "offerExpirationDate": "...",
    "effectiveDate": "...",
    "expirationDate": "...",
    "contractTerm": "...",
    "autoRenewal": "...",
    "renewalDeadline": "...",
    "noticePeriodForTermination": "..."
  },
  "financials": {
    "totalContractValue": "...",
    "paymentTerms": "...",
    "invoicingFrequency": "...",
    "refundability": "...",
    "taxResponsibility": "...",
    "priceAdjustmentClause": "...",
    "latePaymentPenalty": "..."
  },
  "riskAndLiability": {
    "governingAgreement": "...",
    "orderOfPrecedence": "...",
    "governingLaw": "...",
    "limitationOfLiability": "...",
    "indemnification": "...",
    "auditRights": "..."
  },
  "criticalProvisions": [
    { "name": "...", "summary": "..." }
  ],
  "analystNotations": [
    { "title": "...", "description": "..." }
  ]
}

**FINANCIAL VALUE RULE:**
Whenever possible, wrap monetary fields in an object: { "value": "CURRENCY:AMOUNT", "description": "..." }. If not possible, use a clear string. 

**MISSING FIELDS:**
For any field in the JSON structure below that cannot be found or is not present in the text, use "N/A" as the value.

Contract Text:
{context}`;

export const OLLAMA_SUMMARY_PROMPT_FULL = OLLAMA_SUMMARY_PROMPT;


// ─── GEMINI PROMPTS ───

// ─── Multistrat Tiered Extraction Prompts ───

// PRE-ANALYSIS: Broad contract shell extraction
export const GEMINI_PRE_ANALYSIS_QUERY =
  'entire contract broad analysis metadata fixed fields dynamic fields parties dates money clauses obligations restrictions supplier client contract shell';

export const GEMINI_PRE_ANALYSIS_PROMPT = `You are an expert contract analysis system designed to perform COMPREHENSIVE document analysis and extract ALL structured data from contract documents using a three-tier categorization approach.

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

1. **Fixed Fields** (mandatory extraction for all contracts - 20 total fields):
   - agreement_type: Use standardized abbreviations (MSA, NDA, SOW, PO, SLA, DPA, BAA, EULA, SCHEDULE, INVOICE, etc.)
   - provider: Service/product provider company name
   - client: Customer/client company name
   - contract_classification: Contract category classification
   - total_amount: Format as "CURRENCY_CODE:AMOUNT" (e.g., "USD:1250000.00", "EUR:808668.96")
   - start_date: Contract start date in YYYY-MM-DD format
   - end_date: Contract expiration date in YYYY-MM-DD format
   - contract_id: Any unique identifier (contract number, reference number, agreement ID)
   - product: Primary product or service being contracted
   - contract_status: Determine current contract status based on dates and contract text ("Active" if currently in effect, "Inactive" if expired or not yet started, "Unknown" if dates are unclear or missing)
   - contract_term: Extract contract duration from document text (e.g., "24 months", "3 years", "36 months"). If not explicitly stated, calculate from start_date and end_date and format as months (e.g., "17 months"). Use "N/A" if cannot be determined.
   - payment_terms: Extract payment terms including duration and timing. Format as "X Days | Advanced" or "X Days | Arrears" (e.g., "30 Days | Advanced", "45 Days | Arrears", "Net 30 Days | Arrears"). If only duration is mentioned without timing, default to "Arrears". Use "N/A" if not specified.
   - auto_renewal: Whether contract automatically renews ("Yes" or "No" - must be determined from contract text, default to "No" if unclear)
   - renewal_notice_period: Notice period required to prevent renewal (CRITICAL: ALWAYS format as "X months" ONLY. Convert: 30 days = "1 month", 60 days = "2 months", 90 days = "3 months", 180 days = "6 months", 365 days = "12 months", 1 year = "12 months". Use "N/A" if not specified)
   - relationships: Any references to other documents mentioned in this contract (comma-separated string of document names, contract IDs, file names, or any document references found in the text; capture exactly as mentioned; "N/A" if no references found)
   - customer_owner: The person who owns the agreement on the customer/client side or should be contacted regarding the agreement from the customer organization. Look for contract managers, business owners, or authorized representatives from the client side. Format as "Name (Contact Info)" if available, otherwise just the name. Use "N/A" if not found.
   - supplier_owner: The person who owns the agreement on the supplier/provider side or should be contacted regarding the agreement from the supplier organization. Look for account managers, sales representatives, or authorized representatives from the supplier side. Format as "Name (Contact Info)" if available, otherwise just the name. Use "N/A" if not found.
   - original_filename: The original filename of the uploaded document

2. **Dynamic Fields** (COMPREHENSIVE contract-specific metadata organized by categories):
   Extract EVERY relevant contract-specific field found in the document and organize them into the following categories. Perform exhaustive analysis to capture ALL contractual terms, conditions, clauses, and metadata:

   **Use rights & restrictions:** Usage limitations, access restrictions, permitted uses, prohibited activities, user limitations, capacity constraints, geographic restrictions, time-based limitations, scope of use, operational boundaries, service limitations, feature restrictions, and ALL usage-related terms and constraints.

   **General:** General contract terms, basic provisions, standard clauses, administrative details, general obligations, miscellaneous provisions, definitions, interpretations, general conditions, standard terms, boilerplate clauses, general requirements, service level agreements, performance metrics, uptime guarantees, response times, support levels, maintenance schedules, delivery timelines, quality standards, operational commitments, availability requirements, capacity guarantees, throughput specifications, error rates, resolution times, escalation procedures, performance penalties, technical specifications, training provisions, implementation requirements, operational constraints, system requirements, integration specifications, API limitations, bandwidth requirements, security standards, backup procedures, disaster recovery plans, insurance requirements, risk allocation clauses, force majeure provisions, business continuity requirements, security audits, penetration testing, vulnerability assessments, auto-renewal provisions, notice periods, termination rights, cancellation procedures, post-termination obligations, transition requirements, contract continuation terms, renewal pricing, termination fees, wind-down procedures, data return obligations, and ALL other general contractual provisions.

   **Legal terms:** Liability limitations, indemnification clauses, confidentiality periods, data privacy compliance requirements, audit rights, regulatory compliance obligations, legal protections, governing law, jurisdiction, dispute resolution procedures, arbitration clauses, mediation requirements, legal notices, compliance certifications, regulatory reporting, intellectual property rights, warranties, representations, and ALL legal and compliance terms.

   **Commercial terms:** Payment schedules, billing frequencies, late fees, currency provisions, tax responsibilities, pricing models, cost escalation clauses, financial penalties, discounts, rebates, credits, adjustments, true-up provisions, budget caps, spending limits, invoice procedures, payment methods, banking details, financial reporting requirements, audit rights, service level credits, performance bonuses, and ALL other monetary obligations and financial arrangements.

   **Data protection:** Data privacy requirements, data security measures, data retention policies, data processing terms, data transfer restrictions, data subject rights, GDPR compliance, data breach notification procedures, data encryption requirements, data backup procedures, data deletion obligations, data access controls, and ALL data protection and privacy-related terms.

   Use descriptive field names that clearly indicate the nature of each extracted term (e.g., "renewal_notice_period", "liability_cap", "support_response_time", "data_retention_period", "security_audit_frequency", "ip_ownership_rights"). Each dynamic field must include:
   - value: Extracted value from the contract
   - description: Brief explanation of what this field represents in business context
   - confidence: Confidence score (0.0-1.0)

   **MANDATORY DYNAMIC FIELD - Contract Description:**
   Always include a "contract_description" field with:
   - value: Comprehensive description of the contract including its purpose, scope, key obligations, deliverables, and business context. Include specific document section references, calculations that justify the contract value, and detailed supporting information that explains what the contract covers and why it has the stated value.
   - description: "Detailed contract description with supporting information and value justification"
   - confidence: Confidence score based on how well the description can be extracted from the document

3. **Special Fields** (vendor-specific fields - will be populated in a separate extraction step):

   Leave this as an empty object for now. Vendor-specific fields will be extracted in a targeted second pass after supplier identification.

**CONFIDENCE SCORING:**
For each field, calculate a confidence score (0.0-1.0) using these 5 weighted criteria:

1. **Quality & Completeness of Text (28%):** Assess whether the text is clear, readable, and sufficiently complete to evaluate the field. For found values, evaluate the clause text itself. For not_found (N/A) values, evaluate the text covering where this clause would normally appear.

2. **Consistency (25%):** For found values, check if any text contradicts the extraction. For not_found values, check if any text suggests the clause should exist.

3. **Strength of Evidence (20%):** For found values, evaluate how explicitly the clause appears. For not_found values, evaluate how strongly the text supports the conclusion that the clause is legitimately absent.

4. **Coverage of Typical Locations (15%):** For found values, check if the clause appears in expected sections. For not_found values, verify that typical clause locations were reviewed.

5. **Clause Structure Integrity (12%):** For found values, assess if the extracted text matches expected structural elements for this clause type. For not_found values, assess if absence is coherent with the document structure.

**Calculate:** (Criterion_1 × 0.28) + (Criterion_2 × 0.25) + (Criterion_3 × 0.20) + (Criterion_4 × 0.15) + (Criterion_5 × 0.12)


**OUTPUT FORMAT:**
Return a valid JSON object with this exact structure:

{
  "fixed_fields": {
    "agreement_type": {"value": "MSA", "confidence": 0.95},
    "provider": {"value": "Company Name", "confidence": 0.90},
    "client": {"value": "Customer Name", "confidence": 0.85},
    "product": {"value": "Cloud Software Platform", "confidence": 0.88},
    "total_amount": {"value": "USD:1250000.00", "confidence": 0.90},
    "start_date": {"value": "2024-01-01", "confidence": 0.95},
    "end_date": {"value": "2026-12-31", "confidence": 0.90},
    "contract_id": {"value": "MSA-2024-001", "confidence": 0.85},
    "contract_classification": {"value": "SAAS", "confidence": 0.88},
    "contract_status": {"value": "Active", "confidence": 0.90},
    "contract_term": {"value": "36 months", "confidence": 0.85},
    "payment_terms": {"value": "30 Days | Arrears", "confidence": 0.80},
    "auto_renewal": {"value": "No", "confidence": 0.90},
    "renewal_notice_period": {"value": "3 months", "confidence": 0.85},
    "relationships": {"value": "Master Agreement dated Jan 2024,Data Processing Addendum,Schedule A", "confidence": 0.80},
    "customer_owner": {"value": "John Smith (john.smith@customer.com)", "confidence": 0.85},
    "supplier_owner": {"value": "Jane Doe (jane.doe@supplier.com)", "confidence": 0.85},
    "original_filename": {"value": "filename.pdf", "confidence": 1.0}
  },
  "dynamic_fields": {
    "Use rights & restrictions": {
      "user_limitations": {
        "value": "Maximum 500 concurrent users",
        "description": "Limit on number of simultaneous users",
        "confidence": 0.92
      }
    },
    "General": {
      "contract_description": {
        "value": "Detailed summary...",
        "description": "Detailed contract description with supporting information and value justification",
        "confidence": 0.88
      }
    },
    "Legal terms": {
      "governing_law": {
        "value": "State of California",
        "description": "Legal jurisdiction governing the contract",
        "confidence": 0.85
      }
    },
    "Commercial terms": {
      "payment_terms": {
        "value": "Net 30 days from invoice date",
        "description": "Payment due within 30 days of invoice receipt",
        "confidence": 0.90
      }
    },
    "Data protection": {
      "data_retention_period": {
        "value": "7 years after contract termination",
        "description": "Duration for retaining customer data",
        "confidence": 0.88
      }
    }
  },
  "special_fields": {}
}

**COMPREHENSIVE EXTRACTION RULES:**

1. **THOROUGHNESS REQUIREMENT:** Extract EVERY piece of structured information present in the document. Read every section, paragraph, clause, subsection, appendix, schedule, exhibit, and attachment. Do not skip any content.

2. **DYNAMIC FIELDS CATEGORIZATION:** For dynamic_fields, extract EVERY contract-specific term, condition, clause, and metadata element found in the document and organize them into the 5 predefined categories. This should result in 30-100+ dynamic fields for comprehensive contracts.

3. **INDUSTRY-SPECIFIC TERMINOLOGY:** Identify and extract industry-specific language.

4. **COMPREHENSIVE CLAUSE ANALYSIS:** Analyze all clauses.

5. **METADATA EXTRACTION:** Extract ALL document metadata.

6. **FORMATTING RULES:**
   - Use "N/A" for missing fields with appropriate low confidence scores (0.1-0.3)
   - For currency amounts, always use "CURRENCY_CODE:AMOUNT" format
   - For dates, always use YYYY-MM-DD format
   - For agreement types, use standardized abbreviations.
   - For contract_classification, use only these values: SAAS|IAAS|PAAS|PROFESSIONAL_SERVICES|MANAGED_SERVICES|HARDWARE|RESELLER|NETWORK|OTHER

7. **ACCURACY AND COMPLETENESS:** Extract only information explicitly stated or strongly implied.

8. **SPECIAL FIELDS:** Leave special_fields as an empty object {}.

**IMPORTANT:** Your response MUST be a valid JSON object matching the exact structure shown above. Do not include explanatory text outside the JSON.

Contract Text:
{context}
`;

// FIXED_QUERY & FIXED_PROMPT
export const GEMINI_FIXED_QUERY =
  'contract parties provider client supplier product agreement type start date end date payment terms total amount renewal notice contract classification status contract id';

export const GEMINI_FIXED_PROMPT = `You are an expert contract analysis system. The current date is {currentDate}. Extract ONLY the following 20 fixed fields from this contract document with brief, clear descriptions.

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
- Introductory clauses: e.g., "This [x] agreement…”
... (abbreviated rules based on snippet but preserving logic)

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
18. **customer_owner**: The person who owns the agreement on the customer/client side or should be contacted regarding the agreement from the customer organization. Format as "Name (Contact Info)" if available, otherwise just the name. Use "N/A" if not found.
19. **supplier_owner**: The person who owns the agreement on the supplier/provider side or should be contacted regarding the agreement from the supplier organization. Format as "Name (Contact Info)" if available, otherwise just the name. Use "N/A" if not found.
20. **original_filename**: The original filename of the uploaded document

**DESCRIPTION REQUIREMENTS:**
For each field, provide a brief, plain description that includes:
- Any conflicting or contrary information found elsewhere in the document
- Special conditions, edge cases, or exceptions that apply
- Important context that affects the interpretation
- Keep descriptions concise and conversational

**CONFIDENCE SCORING:**
Use a weighted scoring approach based on these four criteria:
... calculate and format as 0.0 - 1.0 (e.g. 0.85).

**OUTPUT FORMAT:**
Return a valid JSON object with this exact structure:

{
  "fixed_fields": {
    "agreement_type": {
      "value": "MSA", 
      "description": "Document header identifies this as a Master Service Agreement. Consistent throughout document.",
      "confidence": 0.95
    },
    ... (all 20 fields)
  }
}

**IMPORTANT:**
- Extract ONLY these 20 fixed fields, nothing else
- Focus on identifying the provider/supplier accurately as this will be used for subsequent targeted extraction
- Your response MUST be a valid JSON object matching the exact structure shown above
- Do not include explanatory text outside the JSON

Contract Text:
{context}
`;

export const GEMINI_FIXED_PROMPT_FULL = GEMINI_FIXED_PROMPT;

// DYNAMIC_QUERY & DYNAMIC_PROMPT
export const GEMINI_DYNAMIC_QUERY =
  'contract specific business critical clauses legal commercial data protection use rights restrictions liability payment renewal termination confidentiality service levels dynamic fields';

export const GEMINI_DYNAMIC_PROMPT = `You are an expert contract analysis system. Extract ONLY dynamic contract-specific fields from this contract document and organize them into the specified categories. Do not extract fixed fields or supplier-specific fields.

{exclusionText}

**DYNAMIC FIELDS TO EXTRACT:**

Extract EVERY relevant contract-specific field found in the document and organize them into the following categories. Perform exhaustive analysis to capture ALL contractual terms, conditions, clauses, and metadata:

**Use rights & restrictions:** Usage limitations, access restrictions, permitted uses, prohibited activities, user limitations, capacity constraints, geographic restrictions, time-based limitations, scope of use, operational boundaries, service limitations, feature restrictions, and ALL usage-related terms and constraints.

**General:** General contract terms, basic provisions, standard clauses, administrative details, general obligations, miscellaneous provisions, definitions, interpretations, general conditions, standard terms, boilerplate clauses, general requirements, service level agreements, performance metrics, uptime guarantees, response times, support levels, maintenance schedules, delivery timelines, quality standards, operational commitments, availability requirements, capacity guarantees, throughput specifications, error rates, resolution times, escalation procedures, performance penalties, technical specifications, training provisions, implementation requirements, operational constraints, system requirements, integration specifications, API limitations, bandwidth requirements, security standards, backup procedures, disaster recovery plans, insurance requirements, risk allocation clauses, force majeure provisions, business continuity requirements, security audits, penetration testing, vulnerability assessments, auto-renewal provisions, notice periods, termination rights, cancellation procedures, post-termination obligations, transition requirements, contract continuation terms, renewal pricing, termination fees, wind-down procedures, data return obligations, and ALL other general contractual provisions.

**Legal terms:** Liability limitations, indemnification clauses, confidentiality periods, data privacy compliance requirements, audit rights, regulatory compliance obligations, legal protections, governing law, jurisdiction, dispute resolution procedures, arbitration clauses, mediation requirements, legal notices, compliance certifications, regulatory reporting, intellectual property rights, warranties, representations, and ALL legal and compliance terms.

**Commercial terms:** Payment schedules, billing frequencies, late fees, currency provisions, tax responsibilities, pricing models, cost escalation clauses, financial penalties, discounts, rebates, credits, adjustments, true-up provisions, budget caps, spending limits, invoice procedures, payment methods, banking details, financial reporting requirements, audit rights, service level credits, performance bonuses, and ALL other monetary obligations and financial arrangements.

**Data protection:** Data privacy requirements, data security measures, data retention policies, data processing terms, data transfer restrictions, data subject rights, GDPR compliance, data breach notification procedures, data encryption requirements, data backup procedures, data deletion obligations, data access controls, and ALL data protection and privacy-related terms.

Use descriptive field names that clearly indicate the nature of each extracted term (e.g., "renewal_notice_period", "liability_cap", "support_response_time", "data_retention_period", "security_audit_frequency", "ip_ownership_rights"). Each dynamic field must include:
- value: Extracted value from the contract
- description: Brief explanation of what this field represents in business context
- confidence: Confidence score (0.0-1.0)

**MANDATORY DYNAMIC FIELD - Contract Description:**
Always include a "contract_description" field in the "General" category with:
- value: Comprehensive description of the contract including its purpose, scope, key obligations, deliverables, and business context. Include specific document section references, calculations that justify the contract value, and detailed supporting information that explains what the contract covers and why it has the stated value.
- description: "Detailed contract description with supporting information and value justification"
- confidence: Confidence score based on how well the description can be extracted from the document

**⚠️ CRITICAL EXTRACTION RULE: ONLY EXTRACT BUSINESS-CRITICAL CLAUSES WITH CERTAINTY**

**ONLY extract fields when ALL of these conditions are met:**
1. **You are VERY CONFIDENT** (95%+ certainty) that this clause actually exists in the document
2. **The clause has significant business impact** - affects time, cost, obligations, or legal risk
3. **Explicitly stated** with clear, unambiguous language in the document
4. **Not speculative or assumed** based on standard practice
5. **Found in expected sections** (not vaguely mentioned in passing)

**DO NOT EXTRACT if:**
- You have any doubt about whether the clause truly exists in the document (even 80-90% confidence is insufficient)
- The clause is only weakly implied or requires interpretation
- The mention is passing/incidental (e.g., "escalation procedure may apply" vs "the escalation procedure is...")
- The clause lacks specific details or values
- It could be inferred or assumed but is not explicitly written
- You would need to read between the lines or make assumptions about what was meant
- The clause is mentioned but has low business impact
- The text is ambiguous about what is actually being committed to

**Business-Critical Clauses Worth Extracting:**
- Payment terms, pricing, and financial obligations
- Term and renewal conditions with specific dates/periods
- Liability caps and indemnification with defined limits
- Data protection requirements with specific standards
- Performance obligations with measurable metrics
- Termination conditions with notice periods
- Service levels with defined uptime/response times
- Usage restrictions with specific limits
- IP ownership with clear assignment
- Confidentiality with defined periods

**Do NOT Extract (Even if Mentioned):**
- Vague references to procedures that may apply
- Standard clauses mentioned but not detailed
- Boilerplate language without specifics
- Procedures mentioned as optional or potential
- References to external standards without specifics
- Anything you're not 95%+ certain about
For any financial/monetary values in the Financial category, ALWAYS use the format "CURRENCY:AMOUNT" (e.g., "USD:50000", "EUR:25000.50"). Extract both currency and amount together.

**OUTPUT FORMAT:**
Return a valid JSON object with this exact structure:

{
  "dynamic_fields": {
    "Use rights & restrictions": {
      "user_limitations": {
        "value": "Maximum 500 concurrent users",
        "description": "Limit on number of simultaneous users",
        "confidence": 0.92
      }
    },
    ... (other categories matching the format)
  }
}

**IMPORTANT:**
- Extract ONLY dynamic fields, not fixed fields or supplier-specific fields
- Focus on comprehensive extraction while avoiding duplication with already extracted supplier-specific fields
- Your response MUST be a valid JSON object matching the exact structure shown above
- Do not include explanatory text outside the JSON

Contract Text:
{context}
`;

export const GEMINI_DYNAMIC_PROMPT_FULL = GEMINI_DYNAMIC_PROMPT;

// SUPPLIER_PROMPT
export const GEMINI_SUPPLIER_PROMPT = `You are an expert contract analyst specializing in {mappingType} contracts. Extract the following {mappingType}-specific fields from this {SUPPLIER_NAME} contract document.

**INSTRUCTIONS:**
1. **EXTRACT ACTUAL INFORMATION:** Provide specifics, not just "Article 5 covers this".
2. **CONCISE BUT COMPREHENSIVE:** Include numbers, percentages, and obligations.
3. **FINANCIAL AMOUNTS:** Use "CURRENCY:AMOUNT".
4. **SCHEMA**: Every field must be { "value": "...", "description": "...", "confidence": 0.8 }.
5. **MISSING FIELDS**: If a field is not present or not applicable, you MUST use "N/A" for the value.


**STANDARDIZED FIELDS TO EXTRACT:**
{SUPPLIER_FIELD_LIST}

**OUTPUT FORMAT:**
{
  "special_fields": {
    "<category>": {
      "<field>": {"value": "...", "description": "...", "confidence": 0.85}
    }
  }
}

Contract Text:
{context}`;

export const GEMINI_SUPPLIER_PROMPT_FULL = GEMINI_SUPPLIER_PROMPT;

// SUMMARY
export const GEMINI_SUMMARY_QUERY =
  'contract summary narrative core identification term dates financials risk liability critical provisions analyst notations';

export const GEMINI_SUMMARY_PROMPT = `You are an expert contract analyst and a highly precise AI data extraction engine for a CLM tool. Your task is to analyze the text and generate a comprehensive, structured JSON summary for a user interface.

The JSON must follow this exact structure:
{
  "narrativeSummary": "2-3 sentence summary paragraph. Document type, parties, value, service period, purpose.",
  "coreIdentification": {
    "documentType": "...",
    "contractId": "...",
    "client": "...",
    "supplier": "..."
  },
  "termAndDates": {
    "offerExpirationDate": "...",
    "effectiveDate": "...",
    "expirationDate": "...",
    "contractTerm": "...",
    "autoRenewal": "...",
    "renewalDeadline": "...",
    "noticePeriodForTermination": "..."
  },
  "financials": {
    "totalContractValue": "...",
    "paymentTerms": "...",
    "invoicingFrequency": "...",
    "refundability": "...",
    "taxResponsibility": "...",
    "priceAdjustmentClause": "...",
    "latePaymentPenalty": "..."
  },
  "riskAndLiability": {
    "governingAgreement": "...",
    "orderOfPrecedence": "...",
    "governingLaw": "...",
    "limitationOfLiability": "...",
    "indemnification": "...",
    "auditRights": "..."
  },
  "criticalProvisions": [
    { "name": "...", "summary": "..." }
  ],
  "analystNotations": [
    { "title": "...", "description": "..." }
  ]
}

**FINANCIAL VALUE RULE:**
Whenever possible, wrap monetary fields in an object: { "value": "CURRENCY:AMOUNT", "description": "..." }. If not possible, use a clear string. 

**MISSING FIELDS:**
For any field in the JSON structure below that cannot be found or is not present in the text, use "N/A" as the value.

Contract Text:
{context}`;

export const GEMINI_SUMMARY_PROMPT_FULL = GEMINI_SUMMARY_PROMPT;

import { config } from '../utils/config';

const isGemini = config.geminiApiKey;

export const PRE_ANALYSIS_QUERY = isGemini ? GEMINI_PRE_ANALYSIS_QUERY : OLLAMA_PRE_ANALYSIS_QUERY;
export const PRE_ANALYSIS_PROMPT = isGemini ? GEMINI_PRE_ANALYSIS_PROMPT : OLLAMA_PRE_ANALYSIS_PROMPT;

export const FIXED_QUERY = isGemini ? GEMINI_FIXED_QUERY : OLLAMA_FIXED_QUERY;
export const FIXED_PROMPT = isGemini ? GEMINI_FIXED_PROMPT : OLLAMA_FIXED_PROMPT;
export const FIXED_PROMPT_FULL = isGemini ? GEMINI_FIXED_PROMPT_FULL : OLLAMA_FIXED_PROMPT_FULL;

export const DYNAMIC_QUERY = isGemini ? GEMINI_DYNAMIC_QUERY : OLLAMA_DYNAMIC_QUERY;
export const DYNAMIC_PROMPT = isGemini ? GEMINI_DYNAMIC_PROMPT : OLLAMA_DYNAMIC_PROMPT;
export const DYNAMIC_PROMPT_FULL = isGemini ? GEMINI_DYNAMIC_PROMPT_FULL : OLLAMA_DYNAMIC_PROMPT_FULL;

export const SUPPLIER_PROMPT = isGemini ? GEMINI_SUPPLIER_PROMPT : OLLAMA_SUPPLIER_PROMPT;
export const SUPPLIER_PROMPT_FULL = isGemini ? GEMINI_SUPPLIER_PROMPT_FULL : OLLAMA_SUPPLIER_PROMPT_FULL;

export const SUMMARY_QUERY = isGemini ? GEMINI_SUMMARY_QUERY : OLLAMA_SUMMARY_QUERY;
export const SUMMARY_PROMPT = isGemini ? GEMINI_SUMMARY_PROMPT : OLLAMA_SUMMARY_PROMPT;
export const SUMMARY_PROMPT_FULL = isGemini ? GEMINI_SUMMARY_PROMPT_FULL : OLLAMA_SUMMARY_PROMPT_FULL;
