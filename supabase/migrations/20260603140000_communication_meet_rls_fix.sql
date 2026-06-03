-- Meet rooms: host must always read/update their room (fixes list + join 404 after create)

DROP POLICY IF EXISTS comm_meet_rooms_select ON comm_meet_rooms;
CREATE POLICY comm_meet_rooms_select ON comm_meet_rooms FOR SELECT
  USING (
    host_id = auth.uid()
    OR comm_can_access_dealer_scope(dealer_id)
  );

DROP POLICY IF EXISTS comm_meet_rooms_insert ON comm_meet_rooms;
CREATE POLICY comm_meet_rooms_insert ON comm_meet_rooms FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND host_id = auth.uid()
    AND comm_can_access_dealer_scope(dealer_id)
  );

-- Participants: host can add members when bootstrapping a new meet
DROP POLICY IF EXISTS comm_meet_participants_insert ON comm_meet_participants;
CREATE POLICY comm_meet_participants_insert ON comm_meet_participants FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM comm_meet_rooms r
        WHERE r.id = room_id
          AND r.host_id = auth.uid()
          AND r.status = 'active'
          AND comm_can_access_dealer_scope(r.dealer_id)
      )
    )
    AND EXISTS (
      SELECT 1 FROM comm_meet_rooms r
      WHERE r.id = room_id
        AND r.status = 'active'
        AND comm_can_access_dealer_scope(r.dealer_id)
    )
  );
