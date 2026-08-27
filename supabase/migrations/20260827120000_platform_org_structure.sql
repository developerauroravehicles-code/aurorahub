-- Platform org structure: departments, sub-departments, job titles (English UI labels)

CREATE TABLE IF NOT EXISTS public.hr_org_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.hr_departments(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_org_roles_department ON public.hr_org_roles(department_id);

ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS org_role_id uuid REFERENCES public.hr_org_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_personnel_org_role_id ON public.personnel(org_role_id);

COMMENT ON TABLE public.hr_org_roles IS 'Platform job titles linked to sub-departments (leaf hr_departments).';
COMMENT ON COLUMN public.personnel.org_role_id IS 'Platform org job title; separate from platform_role (login key account).';
COMMENT ON COLUMN public.personnel.department_id IS 'Leaf sub-department for platform org; main dept via parent_id chain.';

ALTER TABLE public.hr_org_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_manage_hr_org_roles ON public.hr_org_roles;
CREATE POLICY hr_manage_hr_org_roles ON public.hr_org_roles
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('hr', 'aurora_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('hr', 'aurora_manager'))
  );

DROP POLICY IF EXISTS anyone_view_hr_org_roles ON public.hr_org_roles;
CREATE POLICY anyone_view_hr_org_roles ON public.hr_org_roles
  FOR SELECT USING (true);

-- Idempotent seed: main departments, sub-departments, job titles
DO $$
DECLARE
  main_id uuid;
  sub_id uuid;
BEGIN
  -- Helper: upsert main department
  -- D-001
  INSERT INTO public.hr_departments (code, name, parent_id)
  VALUES ('D-001', 'Executive Management and Governance', NULL)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
  SELECT id INTO main_id FROM public.hr_departments WHERE code = 'D-001';

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-001-BOARD', 'Board of Directors', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-001-BOARD';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-001-BOARD-01', 'Chairman of the Board', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-001-CSUITE', 'C-Suite', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-001-CSUITE';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-001-CSUITE-01', 'Chief Executive Officer (CEO)', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-001-LEGAL', 'Legal and Compliance', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-001-LEGAL';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-001-LEGAL-01', 'Legal Counsel', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-001-AUDIT', 'Internal Audit', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-001-AUDIT';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-001-AUDIT-01', 'Head of Internal Audit', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  -- D-002
  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-002', 'Operations and Supply Chain', NULL) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
  SELECT id INTO main_id FROM public.hr_departments WHERE code = 'D-002';

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-002-MGMT', 'Management', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-002-MGMT';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-002-MGMT-01', 'Chief Operating Officer (COO)', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-002-PROC', 'Procurement', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-002-PROC';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-002-PROC-01', 'Procurement Manager', 1),
    (sub_id, 'D-002-PROC-02', 'Global Supply Chain Manager', 2)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-002-LOG', 'Logistics', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-002-LOG';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-002-LOG-01', 'Logistics Manager', 1),
    (sub_id, 'D-002-LOG-02', 'Warehouse Manager', 2),
    (sub_id, 'D-002-LOG-03', 'Distribution Manager', 3)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-002-QA', 'Quality', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-002-QA';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-002-QA-01', 'Quality Assurance Manager', 1),
    (sub_id, 'D-002-QA-02', 'Quality Control Specialist', 2)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  -- D-003
  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-003', 'Finance and Accounting', NULL) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
  SELECT id INTO main_id FROM public.hr_departments WHERE code = 'D-003';

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-003-MGMT', 'Management', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-003-MGMT';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-003-MGMT-01', 'Chief Financial Officer (CFO)', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-003-ACCT', 'Accounting', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-003-ACCT';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-003-ACCT-01', 'General Accounting Manager', 1),
    (sub_id, 'D-003-ACCT-02', 'Tax Specialist', 2)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-003-FIN', 'Finance', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-003-FIN';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-003-FIN-01', 'Finance Manager', 1),
    (sub_id, 'D-003-FIN-02', 'Treasury Manager', 2),
    (sub_id, 'D-003-FIN-03', 'Cash Flow Manager', 3)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-003-BUD', 'Budget', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-003-BUD';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-003-BUD-01', 'Budget Planning Specialist', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-003-REP', 'Reporting', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-003-REP';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-003-REP-01', 'Financial Reporting Specialist', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  -- D-004
  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-004', 'Human Resources and Culture', NULL) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
  SELECT id INTO main_id FROM public.hr_departments WHERE code = 'D-004';

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-004-MGMT', 'Management', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-004-MGMT';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-004-MGMT-01', 'Chief Human Resources Officer (CHRO)', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-004-EXP', 'Employee Experience', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-004-EXP';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-004-EXP-01', 'Employee Experience Manager', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-004-PAY', 'Payroll', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-004-PAY';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-004-PAY-01', 'Payroll Manager', 1),
    (sub_id, 'D-004-PAY-02', 'HR Records Specialist', 2)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-004-CB', 'Compensation and Benefits', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-004-CB';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-004-CB-01', 'Compensation and Benefits Manager', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  -- D-005
  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-005', 'Commercial Operations and Marketing', NULL) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
  SELECT id INTO main_id FROM public.hr_departments WHERE code = 'D-005';

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-005-MGMT', 'Management', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-005-MGMT';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-005-MGMT-01', 'Chief Marketing Officer (CMO) / Chief Sales Officer (CSO)', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-005-SALES', 'Sales', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-005-SALES';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-005-SALES-01', 'Domestic Sales Manager', 1),
    (sub_id, 'D-005-SALES-02', 'Dealer Channel Manager', 2)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-005-DIG', 'Digital Marketing', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-005-DIG';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-005-DIG-01', 'Digital Performance Marketing Specialist', 1),
    (sub_id, 'D-005-DIG-02', 'Growth Specialist', 2)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-005-BRAND', 'Brand', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-005-BRAND';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-005-BRAND-01', 'Brand Manager', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-005-COMM', 'Communications', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-005-COMM';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-005-COMM-01', 'Public Relations (PR) Specialist', 1),
    (sub_id, 'D-005-COMM-02', 'Corporate Communications Specialist', 2)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-005-CX', 'Customer', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-005-CX';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-005-CX-01', 'Customer Experience (CX) Manager', 1),
    (sub_id, 'D-005-CX-02', 'CRM Manager', 2)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  -- D-006
  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-006', 'Technology and Information Systems', NULL) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
  SELECT id INTO main_id FROM public.hr_departments WHERE code = 'D-006';

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-006-MGMT', 'Management', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-006-MGMT';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-006-MGMT-01', 'Chief Technology Officer (CTO) / Chief Information Officer (CIO)', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-006-SW', 'Software', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-006-SW';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-006-SW-01', 'Software Engineering Manager', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-006-PROD', 'Product', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-006-PROD';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-006-PROD-01', 'Product Development (R&D) Manager', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-006-INFRA', 'Infrastructure', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-006-INFRA';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-006-INFRA-01', 'Infrastructure Manager', 1),
    (sub_id, 'D-006-INFRA-02', 'Systems Administrator', 2),
    (sub_id, 'D-006-INFRA-03', 'Cloud Architecture Specialist', 3),
    (sub_id, 'D-006-INFRA-04', 'DevOps Engineer', 4)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-006-SEC', 'Security', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-006-SEC';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-006-SEC-01', 'Cyber Defense Specialist', 1),
    (sub_id, 'D-006-SEC-02', 'Information Security Manager', 2),
    (sub_id, 'D-006-SEC-03', 'Privacy Compliance Specialist', 3)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-006-PMO', 'Project Management', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-006-PMO';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-006-PMO-01', 'Agile PMO Manager', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-006-DATA', 'Data', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-006-DATA';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-006-DATA-01', 'Business Intelligence (BI) Manager', 1),
    (sub_id, 'D-006-DATA-02', 'Data Analytics Specialist', 2)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  -- D-007
  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-007', 'Strategy and Business Development', NULL) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
  SELECT id INTO main_id FROM public.hr_departments WHERE code = 'D-007';

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-007-MGMT', 'Management', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-007-MGMT';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-007-MGMT-01', 'Chief Strategy Officer (CSO)', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-007-STRAT', 'Strategy', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-007-STRAT';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-007-STRAT-01', 'Strategic Planning Specialist', 1),
    (sub_id, 'D-007-STRAT-02', 'Corporate Development Manager', 2)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-007-BD', 'Business Development', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-007-BD';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-007-BD-01', 'Business Development Specialist', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  -- D-008
  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-008', 'Technical Service', NULL) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
  SELECT id INTO main_id FROM public.hr_departments WHERE code = 'D-008';

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-008-MGMT', 'Management', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-008-MGMT';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-008-MGMT-01', 'Technical Service Manager', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-008-COORD', 'Coordination', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-008-COORD';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-008-COORD-01', 'Service Coordinator', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-008-PARTS', 'Spare Parts', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-008-PARTS';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-008-PARTS-01', 'Spare Parts Management Specialist', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-008-WARR', 'Warranty', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-008-WARR';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-008-WARR-01', 'Warranty and Service Process Manager', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-008-INST', 'Installation', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-008-INST';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-008-INST-01', 'Field Installation / Support Engineer', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-008-REMOTE', 'Remote Support', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-008-REMOTE';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-008-REMOTE-01', 'Remote Technical Support Specialist', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;

  INSERT INTO public.hr_departments (code, name, parent_id) VALUES ('D-008-MAINT', 'Maintenance', main_id) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;
  SELECT id INTO sub_id FROM public.hr_departments WHERE code = 'D-008-MAINT';
  INSERT INTO public.hr_org_roles (department_id, code, name, sort_order) VALUES
    (sub_id, 'D-008-MAINT-01', 'Fault and Maintenance Planning Specialist', 1)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, sort_order = EXCLUDED.sort_order;
END $$;
