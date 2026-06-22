-- Allow users to delete their own notifications (click-to-dismiss in UI)
DROP POLICY IF EXISTS comm_notifications_delete ON public.comm_notifications;
CREATE POLICY comm_notifications_delete ON public.comm_notifications FOR DELETE
  USING (user_id = auth.uid());
