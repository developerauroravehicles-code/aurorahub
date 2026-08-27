-- Enrich compliance document template bodies (BC-focused English; counsel review recommended)
-- Bumps template_version so new assignments pick up updated text on generate.

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  description = 'Official Service Canada SIN confirmation or CRA documentation.',
  template_body = E'SIN / SOCIAL INSURANCE NUMBER CONFIRMATION\n\nEmployee: {{full_name}}\nWorker ID: {{worker_id}}\nEmail: {{email}}\nDate: {{today_date}}\n\n---\n\nINSTRUCTIONS\n\nProvide one of the following for payroll and tax reporting purposes:\n\n• Official SIN card or confirmation letter from Service Canada\n• CRA My Account SIN confirmation (PDF)\n\nYour SIN is collected solely for income tax, CPP, and EI remittance as required by the Canada Revenue Agency. Documents are stored securely and accessible only to authorized HR personnel.'
WHERE code = 'sin_confirmation';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  description = 'Valid government-issued photo ID (passport, BC Driver''s License, or BC Services Card).',
  template_body = E'PHOTO IDENTIFICATION REQUIREMENT\n\nEmployee: {{full_name}}\nWorker ID: {{worker_id}}\nDate: {{today_date}}\n\n---\n\nACCEPTABLE DOCUMENTS\n\n• Canadian passport (photo page)\n• BC Driver''s License (front and back)\n• BC Services Card (BCID) with photo\n\nRequirements: document must be current, legible, and match the name on your employment records. HR may request updated ID before expiry.'
WHERE code = 'photo_id';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  description = 'Valid Canadian work permit, study permit with work authorization, or permanent resident card if applicable.',
  template_body = E'WORK AUTHORIZATION — CANADA\n\nEmployee: {{full_name}}\nWorker ID: {{worker_id}}\nJob Title: {{job_title}}\nDate: {{today_date}}\n\n---\n\nIf you are not a Canadian citizen or permanent resident, upload a valid:\n\n• Work permit (IRCC)\n• Study permit with off-campus/on-campus work authorization\n• Bridging open work permit\n• Permanent resident card (if applicable)\n\nYou must notify HR immediately if your authorization status, employer restrictions, or expiry date changes. Employment may not continue without valid authorization.'
WHERE code = 'work_permit';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  description = 'Void cheque or bank direct deposit form for payroll.',
  template_body = E'DIRECT DEPOSIT AUTHORIZATION\n\nEmployee: {{full_name}}\nEmail: {{email}}\nWorker ID: {{worker_id}}\nDate: {{today_date}}\n\n---\n\nUpload ONE of the following:\n\n• Void cheque with pre-printed name and account details\n• Completed direct deposit form from your financial institution\n\nEnsure branch/transit, institution, and account numbers are clearly visible. Payroll cannot be deposited without verified banking information.'
WHERE code = 'void_cheque';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  description = 'Primary employment contract — terms of hire, compensation, and BC ESA compliance.',
  template_body = E'EMPLOYMENT OFFER AND AGREEMENT\n\nAURORA VEHICLES INC.\n18439 68 Ave, Surrey BC V3S 9H8\n\nDate: {{today_date}}\n\nDear {{full_name}},\n\n---\n\nOFFER SUMMARY\n\nWe are pleased to offer you employment with Aurora Vehicles Inc. under the following terms:\n\n• Position: {{job_title}}\n• Worker ID: {{worker_id}}\n• Anticipated Start Date: {{start_date}}\n• Province of Employment: {{province}}\n• Reporting Manager: {{manager_name}}\n• Work Location / Address on File: {{address}}\n\n---\n\nTERMS AND CONDITIONS\n\n1. PROBATION AND EMPLOYMENT STANDARDS\nYour employment is subject to the BC Employment Standards Act and applicable federal law. Probation terms, if any, will be specified in your offer letter or addendum.\n\n2. COMPENSATION AND BENEFITS\nCompensation, pay frequency, and benefits eligibility are as communicated in your offer and HR records.\n\n3. DUTIES AND CONDUCT\nYou agree to perform assigned duties diligently, follow lawful directions, and comply with company policies including safety, harassment prevention, and IT acceptable use.\n\n4. CONFIDENTIALITY\nYou will protect confidential business, customer, and employee information during and after employment.\n\n5. ENTIRE AGREEMENT\nThis agreement, together with policies referenced in the Employee Handbook, constitutes the understanding between you and Aurora Vehicles Inc. unless superseded by a signed addendum.\n\n---\n\nPlease sign below to accept this offer.\n\nEmployee: {{full_name}}\nEmail: {{email}}'
WHERE code = 'employment_agreement';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  description = 'Confidentiality, proprietary information, and trade secret protection.',
  template_body = E'NON-DISCLOSURE AND CONFIDENTIALITY AGREEMENT\n\nAURORA VEHICLES INC.\nDate: {{today_date}}\n\nBetween Aurora Vehicles Inc. ("Company") and {{full_name}} ("Employee").\n\n---\n\n1. CONFIDENTIAL INFORMATION\n"Confidential Information" includes non-public business data, customer lists, pricing, product designs, software, installation methods, dealer relationships, financial information, and personnel records.\n\n2. OBLIGATIONS\nEmployee agrees to:\n• Use Confidential Information only for authorized work purposes\n• Not disclose Confidential Information to third parties without written consent\n• Protect materials with reasonable care\n• Return or destroy confidential materials upon request or termination\n\n3. EXCLUSIONS\nInformation that is public through no fault of Employee, independently developed, or lawfully received from a third party is excluded.\n\n4. SURVIVAL\nConfidentiality obligations survive termination of employment to the extent permitted by law.\n\n5. GOVERNING LAW\nThis Agreement is governed by the laws of British Columbia.\n\nEmployee: {{full_name}}\nWorker ID: {{worker_id}}\nEmail: {{email}}'
WHERE code = 'nda';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  description = 'WorkSafeBC safety, anti-harassment, IT security, and privacy policies — scroll and acknowledge.',
  template_body = E'EMPLOYEE HANDBOOK AND POLICY ACKNOWLEDGMENT\n\nAURORA VEHICLES INC.\n18439 68 Ave, Surrey BC V3S 9H8\nDocument: HANDBOOK-BC-v2\n\nEmployee: {{full_name}}\nWorker ID: {{worker_id}}\nJob Title: {{job_title}}\nManager: {{manager_name}}\nProvince: {{province}}\nAcknowledgment Date: {{today_date}}\n\n---\n\nINTRODUCTION\n\nThis summary outlines key workplace policies for employees in British Columbia. It supplements your employment agreement and applicable law including the BC Employment Standards Act, Workers Compensation Act (WorkSafeBC), and BC Human Rights Code. Counsel and HR should be consulted for the authoritative full handbook.\n\n---\n\nSECTION 1 — WORKSAFEBC HEALTH AND SAFETY\n\n1.1 Employer and Worker Duties\nBoth the Company and you share responsibility for maintaining a safe workplace under WorkSafeBC regulations.\n\n1.2 Right to Refuse Unsafe Work\nYou may refuse work if you have reasonable cause to believe it would create an undue hazard to your health or safety. Report refusals immediately to your supervisor and HR.\n\n1.3 Incident Reporting\nAll injuries, near-misses, hazardous conditions, and equipment defects must be reported without delay. Failure to report may affect workers'' compensation coverage.\n\n1.4 Personal Protective Equipment (PPE)\nUse required PPE for installation, warehouse, and field duties. Do not disable safety devices on vehicles or equipment.\n\n1.5 Workplace Violence\nViolence, threats, and intimidation are prohibited. Report concerns to HR or your manager.\n\n---\n\nSECTION 2 — ANTI-HARASSMENT AND RESPECTFUL WORKPLACE\n\n2.1 Policy Statement\nAurora Vehicles Inc. is committed to a harassment-free workplace. Harassment includes unwelcome conduct based on protected grounds under the BC Human Rights Code.\n\n2.2 Prohibited Conduct\nIncludes bullying, discriminatory comments, sexual harassment, retaliation, and exclusionary behaviour.\n\n2.3 Reporting\nReport harassment to HR, your manager, or an executive. Complaints are investigated promptly and confidentially to the extent possible.\n\n2.4 No Retaliation\nRetaliation against anyone who reports in good faith is strictly prohibited.\n\n---\n\nSECTION 3 — IT SECURITY AND ACCEPTABLE USE\n\n3.1 Company Systems\nCompany email, CRM, inventory systems, and devices are for authorized business use. Credentials must not be shared.\n\n3.2 Data Protection\nProtect customer PII, payment data, and employee records. Follow password, MFA, and remote-access policies.\n\n3.3 Prohibited Use\nUnauthorized software, credential sharing, exfiltration of data, and personal use that impairs security or performance are prohibited.\n\n3.4 Device Return\nUpon termination, return all company devices and revoke access as directed by IT.\n\n---\n\nSECTION 4 — PRIVACY AND PERSONAL INFORMATION\n\n4.1 Collection\nWe collect personal information necessary for employment, payroll, benefits, and legal compliance.\n\n4.2 Access and Correction\nYou may request access to your personnel file through HR subject to applicable privacy law.\n\n4.3 Confidentiality of Employee Data\nDo not access or disclose colleague personal information except as required for your role.\n\n---\n\nACKNOWLEDGMENT\n\nBy acknowledging below, I confirm that I have received, read, and understood this handbook summary and agree to comply with all company policies as a condition of employment in British Columbia.\n\nEmployee: {{full_name}}\nDate: {{today_date}}'
WHERE code = 'handbook_policy_ack';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  template_body = E'RECORD OF EMPLOYMENT (ROE)\n\nService Canada — Insurable Employment\n\nEmployee: {{full_name}}\nWorker ID: {{worker_id}}\nLast Day Worked / End Date: {{end_date}}\nProvince: {{province}}\nDate Issued: {{today_date}}\n\n---\n\nThis HR-generated document confirms that a Record of Employment has been or will be submitted to Service Canada for the separation noted above. Retain this copy for your records. Contact HR with questions regarding ROE codes or insurable hours.'
WHERE code = 'roe';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  template_body = E'FINAL PAY AND VACATION PAY STATEMENT\n\nAURORA VEHICLES INC.\n\nEmployee: {{full_name}}\nWorker ID: {{worker_id}}\nSeparation Date: {{end_date}}\nStatement Date: {{today_date}}\n\n---\n\nThis document confirms final wages, accrued vacation pay, and outstanding amounts processed in accordance with BC Employment Standards Act timelines. Detailed earnings appear on the attached pay statement. Contact payroll@auroravehicles.com for questions within 60 days.'
WHERE code = 'final_pay_stub';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  template_body = E'RESIGNATION LETTER\n\nDate: {{today_date}}\n\nTo: Aurora Vehicles Inc. / Human Resources\n\nI, {{full_name}}, hereby resign from my position as {{job_title}} effective {{end_date}}.\n\nI will return company property and complete handover tasks as directed. Thank you for the opportunity.\n\nSincerely,\n{{full_name}}\nEmail: {{email}}'
WHERE code = 'resignation_letter';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  template_body = E'TERMINATION OF EMPLOYMENT\n\nAURORA VEHICLES INC.\nDate: {{today_date}}\n\nTo: {{full_name}}\nWorker ID: {{worker_id}}\nPosition: {{job_title}}\n\n---\n\nThis letter confirms that your employment with Aurora Vehicles Inc. will end effective {{end_date}}.\n\nFinal pay, accrued vacation pay, ROE submission, and return of company property will be handled in accordance with the BC Employment Standards Act and company policy. Contact HR for questions regarding benefits continuation or reference requests.\n\nHuman Resources\nAurora Vehicles Inc.'
WHERE code = 'termination_letter';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  template_body = E'SEVERANCE AND NOTICE OFFER\n\nEmployee: {{full_name}}\nWorker ID: {{worker_id}}\nEnd Date: {{end_date}}\nOffer Date: {{today_date}}\n\n---\n\nThis document outlines the separation package offered upon end of employment, including statutory notice, pay in lieu, or enhanced severance where applicable under BC law and company policy.\n\nReview carefully before accepting. You may seek independent legal advice. Acceptance may require signing a Full and Final Release.\n\nHR Contact: support@auroravehicles.com'
WHERE code = 'severance_offer';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  template_body = E'FULL AND FINAL RELEASE\n\nAURORA VEHICLES INC.\nDate: {{today_date}}\n\nI, {{full_name}}, in consideration of the severance and benefits described in the Severance / Notice Offer, hereby release Aurora Vehicles Inc., its officers, directors, and employees from claims arising from my employment or separation, to the fullest extent permitted by applicable law in British Columbia.\n\nI confirm I have had opportunity to obtain independent legal advice.\n\nEmployee: {{full_name}}\nWorker ID: {{worker_id}}'
WHERE code = 'release_form';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  template_body = E'CONFIDENTIALITY REMINDER — POST-EMPLOYMENT\n\nEmployee: {{full_name}}\nEnd Date: {{end_date}}\nDate: {{today_date}}\n\n---\n\nThis reminder confirms that your Non-Disclosure Agreement and any applicable restrictive covenants continue after your last day of employment. Do not use, disclose, or solicit Aurora Vehicles Inc. confidential information, customer relationships, or proprietary methods.\n\nReturn all company materials and certify deletion of company data from personal devices where applicable.'
WHERE code = 'nda_noncompete_reminder';

UPDATE compliance_document_templates SET
  template_version = template_version + 1,
  template_body = E'ASSET AND DIGITAL ACCESS RETURN\n\nEmployee: {{full_name}}\nWorker ID: {{worker_id}}\nSeparation Date: {{end_date}}\nDate: {{today_date}}\n\n---\n\nCHECKLIST\n\n[ ] Laptop / tablet / mobile device\n[ ] Keys, fobs, and access cards\n[ ] Uniforms and branded materials\n[ ] Tools, meters, and installation equipment\n[ ] Vehicle electronics inventory (if applicable)\n[ ] Deletion of company data from personal devices (certify in writing)\n[ ] Email and system access revoked (IT confirmation)\n\nI confirm return or surrender of all items listed above.\n\nEmployee: {{full_name}}'
WHERE code = 'asset_return';
