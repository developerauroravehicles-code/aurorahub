-- Meet visibility: only host, invited users, and participants can see/join a room

CREATE TABLE IF NOT EXISTS comm_meet_invites (
  room_id uuid NOT NULL REFERENCES comm_meet_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_meet_invites_user ON comm_meet_invites(user_id);
CREATE INDEX IF NOT EXISTS idx_comm_meet_invites_room ON comm_meet_invites(room_id);

CREATE OR REPLACE FUNCTION comm_can_access_meet_room(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM comm_meet_rooms r
    WHERE r.id = p_room_id AND r.host_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM comm_meet_invites i
    WHERE i.room_id = p_room_id AND i.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM comm_meet_participants p
    WHERE p.room_id = p_room_id AND p.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS comm_meet_rooms_select ON comm_meet_rooms;
CREATE POLICY comm_meet_rooms_select ON comm_meet_rooms FOR SELECT
  USING (comm_can_access_meet_room(id));

DROP POLICY IF EXISTS comm_meet_invites_select ON comm_meet_invites;
CREATE POLICY comm_meet_invites_select ON comm_meet_invites FOR SELECT
  USING (comm_can_access_meet_room(room_id));

DROP POLICY IF EXISTS comm_meet_invites_insert ON comm_meet_invites;
CREATE POLICY comm_meet_invites_insert ON comm_meet_invites FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM comm_meet_rooms r
      WHERE r.id = room_id
        AND r.host_id = auth.uid()
        AND r.status = 'active'
    )
  );

ALTER TABLE comm_meet_invites ENABLE ROW LEVEL SECURITY;
