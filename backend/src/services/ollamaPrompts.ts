export const OLLAMA_FIXED_QUERY =
  'contract parties provider client supplier product agreement type start date end date payment terms total amount renewal auto renewal renewal duration renewal notice contract classification status contract id governing law jurisdiction signatory owner customer owner supplier owner termination for convenience assignment change of control';

export const OLLAMA_FIXED_PROMPT = `You are an expert contract analysis system. The current date is {currentDate}. The original filename is "{filename}".

Extract ONLY the fixed fields below from this contract document. Scan the full provided context, check for conflicts elsewhere in the text, and keep descriptions concise and business-focused.

**FIXED FIELDS TO EXTRACT:**
1. agreement_type: Return exactly ONE standardized label: ORDER_FORM, MSA, FA, NDA, SOW, PO, SLA, DPA, BAA, EULA, LICENSE, PROPOSAL, T&C, RESELLER, SCHEDULE, ADDENDUM, AMENDMENT, INVOICE, OTHER.
2. provider: Service/product provider company name.
3. client: Customer/client company name.
4. product: Primary product or service being contracted.
5. total_amount: Format as "CURRENCY_CODE:AMOUNT". Extract the highest explicitly stated total base contract value excluding taxes.
6. annual_amount: Year-by-year breakdown of contract value excluding taxes. If not explicit, calculate from total_amount and contract_term when possible.
7. start_date: YYYY-MM-DD.
8. end_date: YYYY-MM-DD.
9. contract_id: Unique identifier. Fallback to exact document title.
10. contract_classification: Use only SAAS | IAAS | PAAS | PROFESSIONAL_SERVICES | MANAGED_SERVICES | HARDWARE | RESELLER | NETWORK | OTHER.
11. contract_status: "Active", "Inactive", or "Unknown". Apply these rules in order: if end_date exists and {currentDate} <= end_date, return "Active"; if end_date exists and {currentDate} > end_date, return "Inactive"; if no end_date but auto_renewal = "Yes", return "Active"; otherwise return "Unknown". Missing start_date alone does not force "Unknown".
12. contract_term: Duration such as "12 months" or "3 years". If not explicit, calculate from start_date and end_date.
13. payment_terms: Format as "X Days | Timing" such as "30 Days | Arrears".
14. auto_renewal: "Yes" or "No". A contract can have both a fixed end date and auto-renewal.
15. renewal_notice_period: Always format as "X months". Use notice of non-renewal or notice before expiration if that is how the clause is written.
16. renewal_duration_period: Always format as "X months". Convert years to months.
17. relationships: References to other documents mentioned in this contract.
18. customer_owner: Prefer signatory, then functional owner. Search signature blocks, notices clauses, and operational contacts. Format as "Name (Role / Contact Info)" when available.
19. supplier_owner: Prefer signatory, then account/contact owner. Search signature blocks, notices clauses, and operational contacts. Format as "Name (Role / Contact Info)" when available.
20. original_filename: Use "{filename}".
21. governing_law: Extract only the governing jurisdiction name.
22. jurisdiction: Extract the court or venue phrase for disputes.

**DESCRIPTION REQUIREMENTS:**
- Mention the source section or context when possible.
- Note conflicts, exceptions, or edge cases briefly.
- Do not write long summaries.

**CONFIDENCE SCORING:**
- 0.9-1.0: Explicit and consistent
- 0.7-0.89: Clear with minor ambiguity
- 0.5-0.69: Some ambiguity or conflict
- 0.1-0.49: Missing, weak, or speculative

**OUTPUT FORMAT:**
Return a valid JSON object:
{
  "fixed_fields": {
    "agreement_type": { "value": "MSA", "description": "Header identifies this as the MSA.", "confidence": 0.95 }
  }
}

**IMPORTANT:**
- Extract ONLY fixed_fields.
- Use "N/A" when a field is not found.
- Search schedules, annexes, exhibits, and signature blocks, not just the main body.
- Return JSON only.

Contract Text:
{context}`;

export const OLLAMA_FIXED_PROMPT_FULL = OLLAMA_FIXED_PROMPT;

export const OLLAMA_DYNAMIC_QUERY =
  'contract specific business critical clauses legal commercial data protection use rights restrictions liability payment renewal termination confidentiality service levels dynamic fields subcontracting reporting obligations transition exit support service scope exclusions governance framework stewardship meeting change request amendment flow down code of conduct assignment change of control conflict of interest warranty liability governing law jurisdiction data protection dpa fees payment terms insurance delivery model rates territorial scope third party usage kpi response time site visit preliminary report final report recovery commission no cure no pay';

export const OLLAMA_DYNAMIC_PROMPT = `You are an expert contract analysis system. Extract ONLY dynamic contract-specific fields from this contract document and organize them into the specified categories. Do not extract fixed fields or supplier-specific fields.

{exclusionText}

**DYNAMIC FIELDS TO EXTRACT:**
Extract EVERY relevant contract-specific field found in the document and organize them into:
- Use rights & restrictions
- General
- Legal terms
- Commercial terms
- Data protection

Use descriptive field names such as "reporting_obligations", "service_scope_exclusions", "governance_framework", "change_request_process", "flow_down_provisions", "assignment_change_of_control", "delivery_model", "rates_by_resource_type", "professional_liability_insurance", "recovery_fee_model", "territorial_scope", and "service_level_kpis".

Each field MUST be:
{
  "value": "...",
  "description": "...",
  "confidence": 0.0
}

**MANDATORY FIELD:**
Always include "contract_description" inside "General" with a practical summary of contract purpose, scope, obligations, deliverables, and value justification.

**HIGH-PRIORITY CLAUSE FAMILIES IF FOUND:**
- General: reporting_obligations, transition_support, service_scope_exclusions, governance_framework, change_request_process, flow_down_provisions
- Legal terms: termination_for_convenience, assignment_change_of_control, subcontracting_rights, conflict_of_interest, warranty, disclaimer, liability_cap, governing_law, jurisdiction
- Commercial terms: fees, payment_terms_detailed, professional_liability_insurance, delivery_model, hourly_rate, rates_by_resource_type, recovery_commission, recovery_fee_model
- Data protection: data_processing, data_security, data_breach_notification, data_transfer
- Use rights & restrictions: service_level_kpis, territorial_scope, third_party_usage, publicity_restriction, audit_rights

**MANDATORY GRANULAR COMMERCIAL FIELDS IF FOUND:**
- sla_annual_cost
- emagiz_annual_cost
- tooling_annual_cost
- sla_work_rate_2025
- consultancy_rate_2025
- cost_breakdown_by_service
- cost_breakdown_by_business_unit
- budgetary_limitation_on_new_work

**CRITICAL EXTRACTION RULE:**
Only extract business-critical clauses when they are explicit, material, and supported with high certainty. Do not infer missing clauses.

**SEARCH RULES:**
- Search schedules, appendices, exhibits, and signature pages as aggressively as the body text.
- Treat near-synonyms as equivalent headings, such as stewardship/governance, change order/written amendment, out of scope/exclusions, assignment/transfer/novation, and reporting/management information.
- If a clause says consent is required, extract that requirement rather than dropping the field.

**OUTPUT FORMAT:**
Return a valid JSON object:
{
  "dynamic_fields": {
    "General": {
      "contract_description": {
        "value": "...",
        "description": "Detailed contract description with supporting information and value justification",
        "confidence": 0.9
      }
    }
  }
}

**IMPORTANT:**
- Extract ONLY dynamic fields.
- Avoid duplication with excluded supplier-specific fields.
- Use "N/A" only when a field is intentionally present in output but not found.
- Return JSON only.

Contract Text:
{context}`;

export const OLLAMA_DYNAMIC_PROMPT_FULL = OLLAMA_DYNAMIC_PROMPT;

export const OLLAMA_SUPPLIER_PROMPT = `You are an expert contract analyst specializing in {mappingType} contracts. Extract the following {mappingType}-specific fields from this {SUPPLIER_NAME} contract document.

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

export const OLLAMA_SUPPLIER_PROMPT_FULL = OLLAMA_SUPPLIER_PROMPT;

export const OLLAMA_SUMMARY_QUERY =
  'contract summary narrative core identification term dates financials risk liability critical provisions analyst notations';

export const OLLAMA_SUMMARY_PROMPT = `You are an expert contract analyst and precise JSON extraction engine for a CLM tool. The original filename is "{filename}".

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

export const OLLAMA_SUMMARY_PROMPT_FULL = OLLAMA_SUMMARY_PROMPT;
