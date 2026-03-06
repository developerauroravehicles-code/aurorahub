-- Add work arrangement (Remote, On-site, Field) to personnel

ALTER TABLE personnel ADD COLUMN IF NOT EXISTS work_arrangement text;

COMMENT ON COLUMN personnel.work_arrangement IS 'remote, on_site, field - where the employee typically works';
