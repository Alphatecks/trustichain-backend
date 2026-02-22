-- Allow admin/mediator dispute messages without a users row (admins live in admins table, not users)
-- sender_user_id NULL = message from admin/mediator; non-null = message from a party (initiator/respondent) in users

ALTER TABLE dispute_messages
  ALTER COLUMN sender_user_id DROP NOT NULL;

-- Ensure: either sender is a user (sender_user_id set) or role is admin/mediator (sender_user_id may be null)
ALTER TABLE dispute_messages
  ADD CONSTRAINT dispute_messages_sender_check
  CHECK (
    sender_user_id IS NOT NULL
    OR (sender_role IN ('admin', 'mediator'))
  );

COMMENT ON COLUMN dispute_messages.sender_user_id IS 'User who sent the message; NULL when sender_role is admin or mediator (they are not in users table).';
