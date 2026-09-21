-- core/messaging — row-level security: tenant_isolation (§ docs/tenancy.md).

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'messaging_conversations', 'messaging_conversation_members', 'messaging_messages',
    'messaging_message_attachments', 'messaging_message_reactions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (organization_id = current_setting(''app.organization_id'', true))
         WITH CHECK (organization_id = current_setting(''app.organization_id'', true))',
      t
    );
  END LOOP;
END $$;
