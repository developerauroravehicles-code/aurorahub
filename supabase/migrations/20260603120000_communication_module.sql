-- AuroraHub Communication Module: Chat, Meet, Notifications
-- Dealer-scoped for bayi users; platform users (dealer_id IS NULL) have cross-dealer access.

-- ============================================
-- Helper functions (no comm_* table dependencies)
-- ============================================
CREATE OR REPLACE FUNCTION comm_user_dealer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dealer_id FROM profiles WHERE id = auth.uid();
$$;

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

CREATE OR REPLACE FUNCTION comm_can_access_dealer_scope(p_dealer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT comm_is_platform_user()
    OR p_dealer_id IS NULL
    OR p_dealer_id = comm_user_dealer_id();
$$;

-- ============================================
-- Tables
-- ============================================
CREATE TABLE IF NOT EXISTS comm_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('direct', 'group')),
  title text,
  dealer_id uuid REFERENCES dealers(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comm_conversation_members (
  conversation_id uuid NOT NULL REFERENCES comm_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS comm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES comm_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS comm_meet_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  join_token text NOT NULL UNIQUE,
  title text NOT NULL,
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dealer_id uuid REFERENCES dealers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comm_meet_participants (
  room_id uuid NOT NULL REFERENCES comm_meet_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS comm_meet_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES comm_meet_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comm_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('chat_message', 'meet_invite', 'meet_started', 'mention')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- Helper functions (depend on comm_* tables)
-- ============================================
CREATE OR REPLACE FUNCTION comm_is_conversation_member(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM comm_conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION comm_is_meet_participant(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM comm_meet_participants
    WHERE room_id = p_room_id AND user_id = auth.uid() AND left_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM comm_meet_rooms r
    WHERE r.id = p_room_id AND r.host_id = auth.uid()
  );
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comm_conversations_dealer ON comm_conversations(dealer_id);
CREATE INDEX IF NOT EXISTS idx_comm_conversations_last_message ON comm_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_comm_conversation_members_user ON comm_conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_comm_messages_conversation ON comm_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_meet_rooms_status ON comm_meet_rooms(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_meet_rooms_token ON comm_meet_rooms(join_token);
CREATE INDEX IF NOT EXISTS idx_comm_meet_messages_room ON comm_meet_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_notifications_user ON comm_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_notifications_unread ON comm_notifications(user_id) WHERE read_at IS NULL;

-- Realtime
ALTER TABLE comm_messages REPLICA IDENTITY FULL;
ALTER TABLE comm_meet_messages REPLICA IDENTITY FULL;
ALTER TABLE comm_notifications REPLICA IDENTITY FULL;
ALTER TABLE comm_meet_participants REPLICA IDENTITY FULL;

-- ============================================
-- Triggers: update last_message_at + notifications
-- ============================================
CREATE OR REPLACE FUNCTION comm_on_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE comm_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  INSERT INTO comm_notifications (user_id, type, payload)
  SELECT m.user_id, 'chat_message', jsonb_build_object(
    'conversation_id', NEW.conversation_id,
    'message_id', NEW.id,
    'sender_id', NEW.sender_id,
    'preview', left(NEW.body, 120)
  )
  FROM comm_conversation_members m
  WHERE m.conversation_id = NEW.conversation_id
    AND m.user_id <> NEW.sender_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comm_messages_after_insert ON comm_messages;
CREATE TRIGGER trg_comm_messages_after_insert
  AFTER INSERT ON comm_messages
  FOR EACH ROW
  EXECUTE FUNCTION comm_on_message_insert();

CREATE OR REPLACE FUNCTION comm_on_meet_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO comm_notifications (user_id, type, payload)
  SELECT p.user_id, 'chat_message', jsonb_build_object(
    'room_id', NEW.room_id,
    'message_id', NEW.id,
    'sender_id', NEW.sender_id,
    'preview', left(NEW.body, 120),
    'context', 'meet'
  )
  FROM comm_meet_participants p
  WHERE p.room_id = NEW.room_id
    AND p.user_id <> NEW.sender_id
    AND p.left_at IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comm_meet_messages_after_insert ON comm_meet_messages;
CREATE TRIGGER trg_comm_meet_messages_after_insert
  AFTER INSERT ON comm_meet_messages
  FOR EACH ROW
  EXECUTE FUNCTION comm_on_meet_message_insert();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE comm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_meet_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_meet_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_meet_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_notifications ENABLE ROW LEVEL SECURITY;

-- Conversations
DROP POLICY IF EXISTS comm_conversations_select ON comm_conversations;
CREATE POLICY comm_conversations_select ON comm_conversations FOR SELECT
  USING (
    comm_can_access_dealer_scope(dealer_id)
    AND (
      created_by = auth.uid()
      OR comm_is_conversation_member(id)
    )
  );

DROP POLICY IF EXISTS comm_conversations_insert ON comm_conversations;
CREATE POLICY comm_conversations_insert ON comm_conversations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND comm_can_access_dealer_scope(dealer_id)
  );

DROP POLICY IF EXISTS comm_conversations_update ON comm_conversations;
CREATE POLICY comm_conversations_update ON comm_conversations FOR UPDATE
  USING (comm_is_conversation_member(id) AND comm_can_access_dealer_scope(dealer_id));

-- Conversation members
DROP POLICY IF EXISTS comm_members_select ON comm_conversation_members;
CREATE POLICY comm_members_select ON comm_conversation_members FOR SELECT
  USING (comm_is_conversation_member(conversation_id));

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

DROP POLICY IF EXISTS comm_members_update ON comm_conversation_members;
CREATE POLICY comm_members_update ON comm_conversation_members FOR UPDATE
  USING (user_id = auth.uid());

-- Messages
DROP POLICY IF EXISTS comm_messages_select ON comm_messages;
CREATE POLICY comm_messages_select ON comm_messages FOR SELECT
  USING (
    comm_is_conversation_member(conversation_id)
    AND EXISTS (
      SELECT 1 FROM comm_conversations c
      WHERE c.id = conversation_id AND comm_can_access_dealer_scope(c.dealer_id)
    )
  );

DROP POLICY IF EXISTS comm_messages_insert ON comm_messages;
CREATE POLICY comm_messages_insert ON comm_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND comm_is_conversation_member(conversation_id)
    AND EXISTS (
      SELECT 1 FROM comm_conversations c
      WHERE c.id = conversation_id AND comm_can_access_dealer_scope(c.dealer_id)
    )
  );

-- Meet rooms
DROP POLICY IF EXISTS comm_meet_rooms_select ON comm_meet_rooms;
CREATE POLICY comm_meet_rooms_select ON comm_meet_rooms FOR SELECT
  USING (comm_can_access_dealer_scope(dealer_id));

DROP POLICY IF EXISTS comm_meet_rooms_insert ON comm_meet_rooms;
CREATE POLICY comm_meet_rooms_insert ON comm_meet_rooms FOR INSERT
  WITH CHECK (
    host_id = auth.uid()
    AND comm_can_access_dealer_scope(dealer_id)
  );

DROP POLICY IF EXISTS comm_meet_rooms_update ON comm_meet_rooms;
CREATE POLICY comm_meet_rooms_update ON comm_meet_rooms FOR UPDATE
  USING (
    host_id = auth.uid()
    OR comm_is_meet_participant(id)
  );

-- Meet participants
DROP POLICY IF EXISTS comm_meet_participants_select ON comm_meet_participants;
CREATE POLICY comm_meet_participants_select ON comm_meet_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM comm_meet_rooms r
      WHERE r.id = room_id AND comm_can_access_dealer_scope(r.dealer_id)
    )
  );

DROP POLICY IF EXISTS comm_meet_participants_insert ON comm_meet_participants;
CREATE POLICY comm_meet_participants_insert ON comm_meet_participants FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM comm_meet_rooms r
      WHERE r.id = room_id
        AND r.status = 'active'
        AND comm_can_access_dealer_scope(r.dealer_id)
    )
  );

DROP POLICY IF EXISTS comm_meet_participants_update ON comm_meet_participants;
CREATE POLICY comm_meet_participants_update ON comm_meet_participants FOR UPDATE
  USING (user_id = auth.uid());

-- Meet messages
DROP POLICY IF EXISTS comm_meet_messages_select ON comm_meet_messages;
CREATE POLICY comm_meet_messages_select ON comm_meet_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM comm_meet_rooms r
      WHERE r.id = room_id AND comm_can_access_dealer_scope(r.dealer_id)
    )
    AND (
      comm_is_meet_participant(room_id)
      OR EXISTS (SELECT 1 FROM comm_meet_rooms r WHERE r.id = room_id AND r.host_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS comm_meet_messages_insert ON comm_meet_messages;
CREATE POLICY comm_meet_messages_insert ON comm_meet_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND comm_is_meet_participant(room_id)
  );

-- Notifications
DROP POLICY IF EXISTS comm_notifications_select ON comm_notifications;
CREATE POLICY comm_notifications_select ON comm_notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS comm_notifications_update ON comm_notifications;
CREATE POLICY comm_notifications_update ON comm_notifications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS comm_notifications_insert ON comm_notifications;
CREATE POLICY comm_notifications_insert ON comm_notifications FOR INSERT
  WITH CHECK (true);

-- Realtime publication (Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE comm_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE comm_meet_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE comm_notifications;
    ALTER PUBLICATION supabase_realtime ADD TABLE comm_meet_participants;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
