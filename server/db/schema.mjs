export const schemaSql = `
  create table if not exists family_spaces (
    id text primary key,
    name text not null,
    elder_display_name text not null,
    primary_member_id text not null,
    created_at integer not null,
    updated_at integer not null
  );

  create table if not exists members (
    id text primary key,
    family_space_id text not null,
    role text not null,
    display_name text not null,
    elder_alias text,
    phone text,
    last_activity_at integer,
    alert_priority integer,
    status text not null
  );

  create table if not exists conversations (
    id text primary key,
    family_space_id text not null,
    elder_member_id text not null,
    family_member_id text not null,
    last_meaningful_activity_at integer,
    created_at integer not null
  );

  create table if not exists messages (
    id text primary key,
    conversation_id text not null,
    sender_type text not null,
    sender_member_id text,
    message_type text not null,
    text_content text,
    media_url text,
    voice_duration_sec integer,
    transcript text,
    transcript_confidence real,
    ai_drafted integer not null default 0,
    status text not null,
    is_low_information integer not null default 0,
    created_at integer not null,
    delivered_at integer,
    consumed_at integer,
    recalled_at integer
  );

  create table if not exists memory_entries (
    id text primary key,
    family_space_id text not null,
    source_conv_id text,
    source_msg_id text,
    added_by_member_id text not null,
    added_at integer not null,
    memory_type text not null,
    title text,
    description text,
    media_url text,
    status text not null,
    visible_scope text not null,
    created_at integer not null,
    updated_at integer not null
  );

  create table if not exists pulses (
    id text primary key,
    family_space_id text not null,
    source_type text not null,
    pulse_type text not null,
    severity text not null,
    summary text not null,
    source_conversation_id text,
    source_message_id text,
    source_excerpt text,
    emotion_source text,
    emotion_label text,
    status text not null,
    created_at integer not null,
    resolved_at integer
  );

  create table if not exists followup_records (
    id text primary key,
    linked_pulse_id text,
    linked_alert_id text,
    handler_member_id text not null,
    action_type text not null,
    result_tag text,
    result_note text,
    status text not null,
    created_at integer not null
  );

  create table if not exists alerts (
    id text primary key,
    family_space_id text not null,
    alert_type text not null,
    trigger_source text not null,
    status text not null,
    acknowledged_by text,
    triggered_at integer not null,
    countdown_deadline_at integer,
    escalation_level integer not null,
    resolved_at integer,
    resolution_note text
  );

  create table if not exists permission_policies (
    id text primary key,
    family_space_id text not null,
    role text not null,
    can_view_pulse integer not null,
    can_view_followup integer not null,
    can_view_memory integer not null,
    can_receive_sos integer not null,
    can_receive_unwell integer not null,
    can_manage_members integer not null,
    can_manage_alert_order integer not null
  );

  create table if not exists invite_codes (
    id text primary key,
    family_space_id text not null,
    code text not null,
    status text not null,
    requested_role text not null,
    created_by_member_id text not null,
    approved_member_id text,
    expires_at integer not null,
    created_at integer not null,
    approved_at integer
  );
`

export function initializeSchema(db) {
  db.exec(schemaSql)
  for (const statement of [
    'alter table pulses add column source_message_id text',
    'alter table pulses add column source_excerpt text',
    'alter table pulses add column emotion_source text',
    'alter table pulses add column emotion_label text',
  ]) {
    try {
      db.exec(statement)
    } catch {
      // Ignore repeated migrations when the column already exists.
    }
  }
}
