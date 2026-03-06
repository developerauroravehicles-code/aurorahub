-- Platform users (dealer_id IS NULL) can create their own leave requests from Self Portal
-- Dealers do not have access to Self Portal
CREATE POLICY "platform_users_create_own_leave_request"
  ON leave_requests FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND dealer_id IS NULL)
  );
