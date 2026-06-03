-- Fix: conversation INSERT ... RETURNING failed because creator is not yet a member.
-- Allow conversation creator to SELECT their row before members are inserted.

DROP POLICY IF EXISTS comm_conversations_select ON comm_conversations;
CREATE POLICY comm_conversations_select ON comm_conversations FOR SELECT
  USING (
    comm_can_access_dealer_scope(dealer_id)
    AND (
      created_by = auth.uid()
      OR comm_is_conversation_member(id)
    )
  );

-- Allow creator to add initial members when bootstrapping a conversation
DROP POLICY IF EXISTS comm_members_insert ON comm_conversation_members;
CREATE POLICY comm_members_insert ON comm_conversation_members FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM comm_conversations c
        WHERE c.id = conversation_id
          AND c.created_by = auth.uid()
          AND comm_can_access_dealer_scope(c.dealer_id)
      )
    )
  );

-- Platform roles with cross-dealer access (dealer_id may be set on profile)
CREATE OR REPLACE FUNCTION comm_is_platform_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (
        dealer_id IS NULL
        OR role IN ('aurora_manager', 'it', 'hr')
      )
  );
$$;
