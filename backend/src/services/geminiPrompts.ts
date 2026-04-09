export const GEMINI_FIXED_QUERY =
  'contract parties provider client supplier product agreement type start date end date payment terms total amount renewal auto renewal renewal duration renewal notice contract classification status contract id governing law jurisdiction signatory owner customer owner supplier owner termination for convenience assignment change of control';

export const GEMINI_FIXED_PROMPT = `You are an expert contract analysis system. The current date is {currentDate}. The original filename is "{filename}".

**CRITICAL INSTRUCTION: COMPREHENSIVE DOCUMENT ANALYSIS FOR CONFLICTS**

For each field extraction, you must:
1. **Scan the ENTIRE document** for all relevant information
2. **Identify any conflicting or contrary information** elsewhere in the document
3. **Note exceptions, special conditions, or edge cases**
4. **Provide concise descriptions** in plain language that explain any conflicts or important context

**FIXED FIELDS TO EXTRACT:**

1. **agreement_type**: Return exactly ONE agreement type from the allowed values. Prioritize explicit agreement type detection in the document over inferred classification.

**Allowed values (use standardized abbreviations):**
MSA, FA, NDA, SOW, PO, ORDER_FORM, SLA, DPA, BAA, EULA, LICENSE, PROPOSAL, T&C, RESELLER, SCHEDULE, ADDENDUM, AMENDMENT, INVOICE, OTHER

**EXTRACTION HIERARCHY:**

STEP 1 — EXPLICIT AGREEMENT TYPE DETECTION (highest priority)
Search the document for explicit statements that define the document type, such as:
- Title/header: If the title/header contains an explicit type, the title/header overrides any other type references.
- Introductory clauses: e.g., "This [x] agreement…" or "This document is a [type]"
- Defined terms section defining what "this agreement" is.
- Only treat an agreement type as explicit if it refers to THIS document (title/header, "This [X] Agreement…", or definition of "this Agreement"). Ignore references to other agreements.

If an explicit type is found, apply normalization rules below ONLY.

**NORMALIZATION / MAPPING RULES:**
- Map "Master Services Agreement" or "Master Agreement" → MSA
- Map "Framework Agreement" → FA
- Map "Statement of Work" → SOW
- Map "Order Form" or "Service Order" → ORDER_FORM
- Map "Purchase Order" → PO
- Map "Data Processing Agreement" → DPA
- Map "Business Associate Agreement" → BAA
- Map "Terms and Conditions" → T&C
- Map "End User License Agreement" → EULA
- Map "License Agreement" → LICENSE
- Map "Reseller Agreement" → RESELLER
- Map "Service Level Agreement" → SLA
- Map "Schedule", "Annex", "Appendix", "Exhibit", "Attachment" → SCHEDULE
- Map "Amendment", "Amending Agreement" → AMENDMENT
- Map "Addendum" → ADDENDUM
- Map "Invoice" → INVOICE
- Map "Non-Disclosure Agreement" → NDA

STEP 2 — MULTIPLE EXPLICIT TYPES: APPLY DOCUMENT HIERARCHY
If multiple explicit types are present (e.g., "Order Form under the Master Services Agreement"):
A) Determine which one refers to THIS document (self-reference cues):
   - "this Agreement", "this Addendum", "this Order Form", "this Statement of Work"
   - the document title/header
B) If still multiple candidates, apply PRECEDENCE:
   AMENDMENT > ADDENDUM > SCHEDULE > SOW > ORDER_FORM > PO > SLA > DPA > BAA > NDA > MSA > FA > LICENSE > EULA > RESELLER > T&C > PROPOSAL > INVOICE > OTHER

STEP 3 — NO EXPLICIT TYPE: INFER USING DEFINITIONS
Only if the document never explicitly states its own type, infer from content:
- MSA: Master governing terms for multiple future SOWs/Orders
- FA: Framework agreement requiring call-offs/orders
- NDA: Confidentiality-focused agreement
- SOW: Specific scope/deliverables/timeline under a master
- PO: Purchase Order with items/quantities/prices
- ORDER_FORM: Subscription/service order referencing governing terms
- SLA: Service level metrics (uptime, credits, support)
- DPA: Personal data processing terms (GDPR etc.)
- BAA: HIPAA business associate agreement
- EULA: End-user software terms
- LICENSE: Standalone license grant
- PROPOSAL: Commercial offer; not executed as binding agreement
- T&C: Standard terms without master structure
- RESELLER: Resale rights/partner terms
- SCHEDULE: Annex/attachment to a main agreement
- ADDENDUM: Adds provisions without modifying old text
- AMENDMENT: Modifies specific clauses of existing agreement
- INVOICE: Billing request
- OTHER: None fit clearly

2. **provider**: Service/product provider company name (the supplier/vendor). Extract the FULL legal entity name as written in the parties section.

3. **client**: Customer/client company name. Extract the FULL legal entity name as written in the parties section.

4. **product**: Primary product or service being contracted. Be SPECIFIC - use the exact service name from the document (e.g., "Below Deductible Claims Handling Services" not just "claims services").

5. **total_amount**: Format as "CURRENCY_CODE:AMOUNT" (e.g., "USD:1250000.00", "EUR:808668.96"). Extract the base contract value excluding taxes, VAT, or other additional fees unless explicitly included as part of the core contract value.

6. **annual_amount**: Year-by-year breakdown of contract value excluding taxes. If explicitly mentioned in contract (e.g., "Year 1: $50,000, Year 2: $60,000"), extract as-is. If not mentioned, calculate:
   - Convert contract_term from months to years (divide by 12)
   - If contract_term >= 12 months: Divide total_amount by years (e.g., 18 months = 1.5 years, so USD:150000.00 ÷ 1.5 = USD:100000.00 per year)
   - If contract_term < 12 months: Calculate proportional annual value (e.g., 6 months with USD:50000.00 = USD:100000.00 annual rate)
   - Format examples:
     * 24 months, USD:120000.00 → "Year 1: USD:60000.00, Year 2: USD:60000.00"
     * 18 months, USD:150000.00 → "Year 1: USD:100000.00, Year 2 (6 months): USD:50000.00"
     * 6 months, USD:50000.00 → "Annual rate: USD:100000.00 (6 months actual: USD:50000.00)"
   Use "N/A" if total_amount or contract_term cannot be determined.

7. **start_date**: Contract start date. YYYY-MM-DD format. Look for "effective date", "commencement date", "this agreement begins on". If the document says "date of signature by both parties" but no signature date is visible, return "N/A".

8. **end_date**: Contract expiration date. YYYY-MM-DD format. Look for "termination date", "expiration date", "this agreement will last until", "initial term ends on".

9. **contract_id**: Any unique identifier. Priority order:
   - (1) DocuSign Envelope ID (format: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX)
   - (2) Contract number explicitly stated (e.g., "Contract #2024-001")
   - (3) Document title only as LAST RESORT with confidence < 0.7

10. **contract_classification**: Use only these values: SAAS | IAAS | PAAS | PROFESSIONAL_SERVICES | MANAGED_SERVICES | HARDWARE | RESELLER | NETWORK | OTHER

11. **contract_status**: Determine current contract status. Values: "Active", "Inactive", "Unknown".
    Apply rules IN ORDER:
    - If end_date exists AND {currentDate} <= end_date → "Active"
    - If end_date exists AND {currentDate} > end_date → "Inactive"
    - If no end_date but auto_renewal = "Yes" → "Active"
    - If no end_date and auto_renewal = "No" → "Unknown"
    - Missing start_date alone does NOT make status "Unknown" if end_date clearly indicates active period

12. **contract_term**: Extract contract duration from document text (e.g., "24 months", "3 years", "36 months"). If not explicitly stated, calculate from start_date and end_date and format as months (e.g., "17 months"). Use "N/A" if cannot be determined.

13. **payment_terms**: Format EXACTLY as "X Days | Timing" where Timing is "Advance" or "Arrears". Examples: "30 Days | Advance", "45 Days | Arrears", "Net 30 Days | Arrears". Look for "payable within", "net X days", "payment due X days after invoice". If only duration mentioned without timing, default to "Arrears". Use "N/A" if not specified.

14. **auto_renewal**: Whether contract automatically renews. Values: "Yes" or "No". 
    Set to "Yes" if ANY of these phrases exist:
    - "automatically renewed", "automatic renewal", "auto-renewal", "auto-renew"
    - "will be renewed unless", "renew for an additional term"
    - "shall automatically extend", "successive periods", "evergreen"
    - "will be automatically renewed one time for X years"
    
    CRITICAL: A contract can have BOTH a fixed end date AND auto-renewal. Do NOT set to "No" just because a fixed end date exists.
    
    NON-NEGOTIABLE OVERRIDE:
    - If context contains both terms matching "automatically" and "renew" in the same clause/sentence, auto_renewal MUST be "Yes".
    - This override takes precedence over any inferred interpretation from fixed end_date.

15. **renewal_notice_period**: Notice period required to prevent renewal. ALWAYS format as "X months" only (e.g., "1 month", "3 months", "6 months", "12 months"). 
    This is NOT the general termination notice period—extract ONLY the notice period specifically required to prevent automatic renewal.
    Look for:
    - "must notify in writing X days/weeks/months prior to renewal"
    - "unless terminated with X notice", "notice of non-renewal"
    - "either party may terminate by giving X days notice before expiration"
    Convert days to months: 30 days = "1 month", 60 days = "2 months", 90 days = "3 months".
    Use "N/A" if not specified.

16. **renewal_duration_period**: Duration of each automatic renewal cycle. ALWAYS format as "X months" only (e.g., "12 months", "24 months", "36 months"). This is the length of each automatic renewal period.
    Extract from phrases like:
    - "renewed for X years/months", "additional term of X"
    - "automatically renewed one time for 2 years" → "24 months"
    - "shall renew for successive 12-month periods" → "12 months"
    Convert years to months: 1 year = "12 months", 2 years = "24 months".
    Use "N/A" if auto_renewal = "No" or if renewal duration is not specified.

    NON-NEGOTIABLE OVERRIDE:
    - If clause text contains "one time for 2 years", renewal_duration_period MUST be "24 months".
    - If renewal clause includes a numeric year duration, always convert to months.

17. **relationships**: References to other documents mentioned in this contract. Return as a comma-separated string. Examples: "Schedule 1", "Exhibit A", "Data Processing Addendum", "Business Partner Code of Conduct". Return "N/A" if no references found.

18. **customer_owner**: The person who owns the agreement on the customer/client side. Look for:
    - Contract managers, business owners, or authorized representatives from the client side
    - Persons named in signature blocks at the end of the document
    - Account managers or key contacts designated in the document
    Format as "Name (Contact Info)" if available, otherwise just the name. If only signature block with title exists, use "Title only: [Title]". Return "N/A" if no owner identified.

19. **supplier_owner**: The person who owns the agreement on the supplier/provider side. Look for:
    - Account managers, sales representatives, or authorized representatives from the supplier side
    - Persons named in signature blocks at the end of the document
    - Key contacts designated in the document
    Format as "Name (Contact Info)" if available, otherwise just the name. Return "N/A" if no owner identified.

20. **original_filename**: Use "{filename}".

21. **governing_law**: Extract the jurisdiction whose laws govern the contract. Return ONLY the jurisdiction name (e.g., "Netherlands", "New York", "England and Wales"). Look for "governed by the laws of", "this agreement shall be construed under".

22. **jurisdiction**: Extract the specific court or venue for dispute resolution. Look for "exclusive jurisdiction of the courts of", "any legal action shall be brought in", "venue shall be in". Return the full phrase (e.g., "Exclusive jurisdiction of the courts of The Netherlands").

**CONSISTENCY RULES (CRITICAL):**
- If auto_renewal = "Yes", renewal_duration_period should NOT be "N/A" unless truly missing from document
- If end_date exists and current_date <= end_date, contract_status should be "Active", not "Unknown"
- A contract can have a fixed end date AND auto-renewal (the renewal extends beyond the fixed date)
- Do NOT conflate liability caps with claim notification periods - these are completely different fields
- Do NOT set subcontracting as "prohibited" when document says "requires prior written consent"

**FINAL VALIDATION CHECKLIST (APPLY BEFORE RETURNING JSON):**
1. If any sentence says the agreement is automatically renewed/extended, ensure auto_renewal = "Yes".
2. If auto_renewal = "Yes" and clause includes "2 years", ensure renewal_duration_period = "24 months".
3. If signature block has customer or supplier names, customer_owner/supplier_owner must not be "N/A".
4. Re-check that these validations are satisfied even when end_date is present.
5. Verify agreement_type follows STEP 1-2-3 hierarchy, not random inference.

**DESCRIPTION REQUIREMENTS:**
For each field, provide a brief, plain description that includes:
- Any conflicting or contrary information found elsewhere in the document
- Special conditions, edge cases, or exceptions that apply
- Important context that affects the interpretation
- Keep descriptions concise and conversational (under 100 words per field)

**CONFIDENCE SCORING METHODOLOGY:**

Use a weighted scoring approach based on these four criteria:

1. **OCR Quality (31% weight)**: Is the input OCR quality sufficient for the extraction?
   - High (0.9-1.0): Text is clear, legible, no missing characters or formatting issues
   - Good (0.7-0.89): Minor OCR artifacts, text mostly clear with occasional issues
   - Moderate (0.5-0.7): Some OCR errors present, text readable but may have gaps
   - Poor (0.3-0.5): Significant OCR errors, text partially illegible
   - Very Poor (0.1-0.3): Severe OCR issues, text mostly unreadable

2. **Contradiction Check (28% weight)**: Is the requested extraction NOT contradicted in the document?
   - No Contradiction (0.9-1.0): Information is consistent throughout document
   - Minor Conflict (0.7-0.89): Slight inconsistencies but primary source is clear
   - Moderate Conflict (0.5-0.7): Some contradictory info, resolution through interpretation
   - Significant Conflict (0.3-0.5): Multiple conflicting statements, best guess provided
   - Major Contradiction (0.1-0.3): Highly contradictory or missing information

3. **Inference Level (23% weight)**: Is the extraction explicit vs. inferred?
   - Explicit (0.9-1.0): Directly stated with exact wording
   - Mostly Explicit (0.7-0.89): Clearly stated with minimal interpretation needed
   - Moderate Inference (0.5-0.7): Requires reasonable interpretation or calculation
   - High Inference (0.3-0.5): Requires significant interpretation or assumption
   - Speculative (0.1-0.3): Highly inferred, uncertain, or guessed

4. **Expected Location (18% weight)**: Is the extraction in the clause/section where it's typically found?
   - Standard Location (0.9-1.0): Found in expected section (e.g., payment terms in financial section)
   - Near Expected (0.7-0.89): Found in related section, not exact standard location
   - Unusual Location (0.5-0.7): Found in unexpected but relevant section
   - Very Unusual (0.3-0.5): Found in unrelated section
   - Not in Expected Location (0.1-0.3): Not found where expected, extracted from elsewhere

**FINAL CONFIDENCE CALCULATION:**
Calculate weighted average: (OCR_score × 0.31) + (Contradiction_score × 0.28) + (Inference_score × 0.23) + (Location_score × 0.18)
Round to 2 decimal places (e.g., 0.87)

**Confidence Score Interpretation:**
- 0.80-1.0 (High): Information is reliable
- 0.50-0.79 (Medium): Information needs review
- 0.0-0.49 (Low): Information uncertain or missing

**EXAMPLES OF CORRECT EXTRACTION:**

Example 1 - Contract with both fixed end date AND auto-renewal:
Text: "The Agreement will last until June 30, 2027. The Agreement will be automatically renewed one time for 2 years until June 30, 2029."
Output:
- auto_renewal: "Yes" (confidence: 0.95)
- renewal_duration_period: "24 months" (confidence: 0.95)
- end_date: "2027-06-30" (confidence: 0.95)
- contract_status: "Active" (if current date <= 2027-06-30) (confidence: 0.95)

Example 2 - Customer owner extraction from signature block:
Text: "[Signature block] Geert Venderink, Authorized Representative, Customer Organization"
Output:
- customer_owner: "Geert Venderink (Authorized Representative)" (confidence: 0.92)

Example 3 - Contract ID priority:
Text has DocuSign Envelope ID "F371CA6C-5AC9-4099-B95E-775E4B23FC38" and title "Service Agreement 2025"
Output:
- contract_id: "F371CA6C-5AC9-4099-B95E-775E4B23FC38" (NOT the document title) (confidence: 0.98)

**OUTPUT FORMAT:**
Return ONLY a valid JSON object (no explanatory text before or after):
{
  "fixed_fields": {
    "agreement_type": { "value": "MSA", "description": "Document header identifies as Master Service Agreement. Explicit type in title.", "confidence": 0.95 },
    "provider": { "value": "Company Name", "description": "Company Name, Inc. identified as service provider in parties section.", "confidence": 0.90 },
    [... all 22 fields ...]
  }
}

**IMPORTANT:**
- Extract ONLY fixed_fields (all 22 fields)
- ALL 22 fields MUST be present in the output JSON, even if value is "N/A"
- Do NOT invent fields or values not present in document
- Return only JSON, no markdown or explanations
- confidence MUST be a number between 0 and 1.0
- If you cannot find a field, set value to "N/A" and confidence to 0.1 or lower

Contract Text:
{context}`;

export const GEMINI_FIXED_PROMPT_FULL = GEMINI_FIXED_PROMPT;

export const GEMINI_DYNAMIC_QUERY =
  'contract specific business critical clauses legal commercial data protection use rights restrictions liability payment renewal termination confidentiality service levels dynamic fields subcontracting reporting obligations transition exit support service scope exclusions governance framework stewardship meeting change request amendment flow down code of conduct assignment change of control conflict of interest warranty liability governing law jurisdiction data protection dpa fees payment terms insurance delivery model rates territorial scope third party usage kpi response time site visit preliminary report final report recovery commission no cure no pay';

export const GEMINI_DYNAMIC_PROMPT = `You are an expert contract analysis system. Extract ONLY dynamic contract-specific fields from this contract document and organize them into the specified categories. Do not extract fixed fields.

**DYNAMIC FIELDS TO EXTRACT:**
Extract EVERY relevant contract-specific field found in the document and organize them into these EXACT categories:

**CATEGORIES:**
1. General - Basic operational terms
2. Legal terms - Legal obligations, liability, indemnification, warranties
3. Commercial terms - Pricing, fees, payment, invoicing
4. Data protection - Privacy, data processing, security
5. Use rights & restrictions - Usage limitations, scope of use, exclusivity

**MANDATORY FIELDS (Always extract if present):**

General:
- contract_description: Practical summary of contract purpose, scope, obligations, deliverables, and value justification (REQUIRED)
- effective_date: When the agreement becomes effective
- agreement_term: Duration of the agreement
- supplier_exclusivity: Whether supplier has exclusive rights
- transition_support: Off-boarding and transition obligations
- reporting_obligations: Required reports, updates, stewardship reviews, or management information deliverables
- service_scope_exclusions: Explicit inclusions, exclusions, carve-outs, assumptions, or out-of-scope services
- governance_framework: Governance meetings, escalation forums, review cadence, or stewardship structure
- change_request_process: Written amendment, change order, approval, or variation control process
- flow_down_provisions: Requirements that subcontractors or affiliates comply with customer policies, code of conduct, or contract terms

Legal terms:
- governing_law: Which jurisdiction's laws apply
- jurisdiction: Specific courts for dispute resolution
- liability_cap: Maximum liability amount - format as "CURRENCY:AMOUNT"
- liability_exclusions: What losses are excluded (consequential, indirect, etc.)
- indemnification: Who indemnifies whom for what
- warranty: Service warranties provided
- disclaimer: What warranties are disclaimed
- confidentiality: Duration and scope of confidentiality obligations
- termination_for_convenience: Notice periods for termination without cause - format as "Customer: X days | Supplier: Y days" or "Both: X days"
- termination_for_cause: Cure periods and immediate termination rights
- assignment_change_of_control: Assignment restrictions and consent requirements, including change-of-control restrictions if stated
- subcontracting_rights: "Prohibited" | "Allowed with consent" | "Allowed with notice" | "Unrestricted"
- force_majeure: Whether force majeure is included
- insurance_requirements: Types and amounts of required insurance
- claim_notification_period: Time limit for notifying claims (e.g., "6 months")
- conflict_of_interest: Disclosure and resolution procedures

Commercial terms:
- fees: Description of fee structure (hourly, fixed, usage-based)
- delivery_model: Delivery/pricing model such as T&M, fixed fee, milestone, retainer, or no cure-no pay
- hourly_rate: Specific hourly rates if applicable
- rates_by_resource_type: Different rates by role, seniority, resource type, or activity
- payment_terms_ detailed: Payment timing and conditions
- invoicing_schedule: When invoices are submitted (e.g., "quarterly")
- recovery_commission: Percentage for successful recoveries (e.g., "15%")
- recovery_fee_model: Commercial fee model such as "No cure-no pay"
- parent_company_guarantee: Whether parent guarantees affiliate payments
- discount: Any volume or loyalty discounts
- price_adjustment: CPI or other price adjustment mechanisms
- travel_costs: How travel expenses are handled
- estimate_overrun: Procedure for exceeding estimates
- professional_liability_insurance: Required professional liability or errors-and-omissions insurance

Data protection:
- data_processing: How personal data is processed
- data_security: Security obligations and standards
- data_breach_notification: Breach reporting requirements
- data_retention: How long data is kept
- data_transfer: Cross-border data transfer rules

Use rights & restrictions:
- service_level_kpis: Specific KPIs and SLAs (list each with timeframe)
- territorial_scope: Geographic limits on service delivery
- third_party_usage: Whether affiliates can use services
- publicity_restriction: Restrictions on public announcements
- audit_rights: Whether customer can audit supplier

**FIELD STRUCTURE:**
Each field MUST follow this format:
{
  "value": "concise value (use specific numbers, dates, percentages)",
  "description": "Source clause reference and business context",
  "confidence": 0.0 to 1.0
}

**SPECIAL FORMATTING RULES:**
- Monetary values: "CURRENCY:AMOUNT" (e.g., "EUR:175.00", "USD:2500000")
- Time durations: "X months" or "X days" (e.g., "24 months", "60 days")
- Percentages: "X%" (e.g., "15%")
- Lists: Use JSON array format
- N/A: Use when field is truly absent after thorough search

**CONFIDENCE SCORING:**
- 0.9-1.0: Explicit clause with specific values
- 0.7-0.89: Clear but some inference needed
- 0.5-0.69: Ambiguous or indirect
- Below 0.5: Do not extract (too speculative)

**CRITICAL EXTRACTION RULES:**
1. Only extract when explicit, material, and supported with high certainty
2. Do NOT infer missing clauses
3. Do NOT create fields that don't exist in the document
4. Always include source clause number in description when possible
5. For SLAs/KPIs, extract each timeline as a separate sub-field or clear list
6. Search schedules, appendices, exhibits, and signature blocks as aggressively as the main body because commercial terms and owners often appear there
7. Treat headings and near-synonyms as equivalent. Examples:
   - "subcontracting", "sub-contracting", "third party assistance", "outsourcing"
   - "governance", "stewardship", "service review", "operational review"
   - "change request", "change order", "variation", "written amendment"
   - "reporting", "management information", "KPI report", "status report"
   - "scope exclusions", "out of scope", "does not include", "excluded services"
   - "assignment", "transfer", "novation", "change of control"
8. If a clause contains concrete numbers or timing, prefer a granular field over a generic summary
9. When the document states a consent requirement, do not downgrade it to "N/A" or omit it

**OUTPUT FORMAT:**
Return a valid JSON object only (no explanatory text before or after):
{
  "dynamic_fields": {
    "General": {
      "contract_description": {
        "value": "This is a 2025 Service Agreement between SHV Energy N.V. and Crawford & Company (Nederland) B.V. for claims management services for liability claims under EUR 2,500,000. Services include intake, triage, desk handling, loss adjusting, and recovery coordination. Value is variable based on hourly rates of EUR 175.00.",
        "description": "Extracted from Preamble, Schedule 1, and Schedule 2",
        "confidence": 0.95
      },
      "supplier_exclusivity": {
        "value": "Exclusive except for conflicts of interest",
        "description": "Section 1.2 - SHV Energy appoints Crawford as preferred supplier on exclusive basis",
        "confidence": 1.0
      }
    },
    "Legal terms": {
      "liability_cap": {
        "value": "EUR:2,500,000",
        "description": "Section 4.2 - Total aggregate liability capped at maximum scope of assignment",
        "confidence": 1.0
      },
      "termination_for_convenience": {
        "value": "Customer: 30 days | Supplier: 120 days",
        "description": "Sections 7.3 and 7.4 - SHV Energy may terminate with 30 days notice, Crawford with 120 days",
        "confidence": 1.0
      },
      "subcontracting_rights": {
        "value": "Allowed with consent",
        "description": "Sections 2.6 and 8.3 - Prior written approval required, not prohibited",
        "confidence": 1.0
      },
      "assignment_change_of_control": {
        "value": "Not allowed without prior written consent",
        "description": "Clause 8.4 - Neither party may assign or transfer the agreement without consent",
        "confidence": 0.96
      }
    },
    "Commercial terms": {
      "delivery_model": {
        "value": "T&M",
        "description": "Schedule 2 - Charges are based on hourly rates and commission",
        "confidence": 0.94
      },
      "hourly_rate": {
        "value": "EUR:175.00",
        "description": "Schedule 2 - Hourly rate for intake, handling, coordination, and oversight",
        "confidence": 1.0
      },
      "recovery_commission": {
        "value": "15%",
        "description": "Schedule 2 - Commission on successful recoveries",
        "confidence": 1.0
      },
      "recovery_fee_model": {
        "value": "No cure-no pay",
        "description": "Schedule 2 - Commission applies only to successful recovery",
        "confidence": 0.9
      }
    },
    "Use rights & restrictions": {
      "service_level_kpis": {
        "value": "Contact within 24 hours (1 hour emergency); Visit within 5 days (24 hours emergency); Preliminary report within 3 days; Final report within 10 days; Telephone return within 8 working hours; Correspondence reply within 2 days",
        "description": "Schedule 3 - Key Performance Indicators",
        "confidence": 1.0
      },
      "publicity_restriction": {
        "value": "No public announcement without prior written consent",
        "description": "Section 6.5 - Crawford cannot disclose terms or relationship without SHV Energy consent",
        "confidence": 1.0
      }
    }
  }
}

**IMPORTANT:**
- Extract ONLY dynamic fields
- Prefer granular clause extraction over broad summaries when both are available
- Do NOT omit a field just because the clause is located in a schedule, annex, exhibit, or signature block
- Return JSON only - no markdown, no explanations before or after

Contract Text:
{context}`;

export const GEMINI_DYNAMIC_PROMPT_FULL = GEMINI_DYNAMIC_PROMPT;

export const GEMINI_SUPPLIER_PROMPT = `You are an expert contract analyst specializing in {mappingType} contracts. Extract the following {mappingType}-specific fields from this {SUPPLIER_NAME} contract document.

**INSTRUCTIONS:**
1. Extract the actual business-relevant content, not just clause references.
2. Include specific numbers, thresholds, timeframes, obligations, and restrictions.
3. For monetary values, use "CURRENCY:AMOUNT".
4. Every field must be { "value": "...", "description": "...", "confidence": 0.8 }.
5. If a field is not present or not applicable, use "N/A".
6. Keep values concise but meaningful, and include source context in the description when possible.

**STANDARDIZED FIELDS TO EXTRACT:**
{SUPPLIER_FIELD_LIST}

**OUTPUT FORMAT:**
{
  "special_fields": {
    "<category>": {
      "<field>": { "value": "...", "description": "...", "confidence": 0.85 }
    }
  }
}

Return JSON only.

Contract Text:
{context}`;

export const GEMINI_SUPPLIER_PROMPT_FULL = GEMINI_SUPPLIER_PROMPT;

export const GEMINI_SUMMARY_QUERY =
  'contract summary narrative core identification term dates financials risk liability critical provisions analyst notations';

export const GEMINI_SUMMARY_PROMPT = `You are an expert contract analyst and precise JSON extraction engine for a CLM tool. The original filename is "{filename}".

Return ONLY a valid JSON object with this structure:
{
  "narrativeSummary": "2-3 sentence summary paragraph.",
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
    "governingLaw": "...",
    "limitationOfLiability": "...",
    "indemnification": "...",
    "auditRights": "..."
  },
  "criticalProvisions": [],
  "analystNotations": []
}

Use "N/A" when information is not found. Return JSON only.

Contract Text:
{context}`;

export const GEMINI_SUMMARY_PROMPT_FULL = GEMINI_SUMMARY_PROMPT;
