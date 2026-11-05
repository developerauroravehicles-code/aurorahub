-- Semi-monthly (15th + month-end) vs single monthly salary payout display.

ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS salary_pay_schedule text;

COMMENT ON COLUMN public.personnel.salary_pay_schedule IS
  'salary payout rhythm: semi_monthly_equal (50% on 15th, 50% at month end) or monthly_single';

UPDATE public.personnel
SET salary_pay_schedule = 'semi_monthly_equal'
WHERE salary_pay_schedule IS NULL
  AND salary_type = 'salary'
  AND salary_amount IS NOT NULL
  AND salary_amount > 0;

UPDATE public.personnel
SET salary_pay_schedule = 'monthly_single'
WHERE salary_pay_schedule IS NULL;
