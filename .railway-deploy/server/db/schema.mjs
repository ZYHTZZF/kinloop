export const schemaSql = `
  create table if not exists users (
    id text primary key,
    email text not null unique,
    password_hash text not null,
    password_salt text not null,
    email_verified_at integer,
    created_at integer not null,
    updated_at integer not null
  );

  create table if not exists auth_codes (
    id text primary key,
    email text not null,
    purpose text not null,
    code text not null,
    expires_at integer not null,
    consumed_at integer,
    created_at integer not null
  );

  create table if not exists auth_sessions (
    id text primary key,
    user_id text not null,
    token_hash text not null unique,
    expires_at integer not null,
    created_at integer not null,
    last_seen_at integer not null
  );

  create table if not exists family_spaces (
    id text primary key,
    name text not null,
    join_code text,
    elder_display_name text not null,
    elder_birth_month integer,
    elder_birth_day integer,
    elder_birth_calendar_type text,
    primary_member_id text not null,
    created_by_user_id text,
    created_at integer not null,
    updated_at integer not null
  );

  create table if not exists members (
    id text primary key,
    family_space_id text not null,
    user_id text,
    role text not null,
    display_name text not null,
    relation_label text,
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
    conversation_type text not null default 'FAMILY_CHAT',
    last_meaningful_activity_at integer,
    created_at integer not null
  );

  create table if not exists conversation_participants (
    id text primary key,
    conversation_id text not null,
    member_id text not null,
    joined_at integer not null
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

  create table if not exists message_receipts (
    id text primary key,
    message_id text not null,
    member_id text not null,
    consumed_at integer,
    created_at integer not null
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

  create table if not exists memory_items (
    id text primary key,
    memory_entry_id text not null,
    source_conv_id text,
    source_msg_id text,
    sender_member_id text,
    sender_display_name text,
    sender_role text,
    message_type text not null,
    text_content text,
    transcript text,
    media_url text,
    voice_duration_sec integer,
    sent_at integer,
    sort_order integer not null,
    created_at integer not null
  );

  create table if not exists heart_posts (
    id text primary key,
    family_space_id text not null,
    author_member_id text not null,
    content text,
    image_url text,
    status text not null,
    created_at integer not null,
    updated_at integer not null
  );

  create table if not exists heart_post_likes (
    id text primary key,
    heart_post_id text not null,
    member_id text not null,
    created_at integer not null
  );

  create table if not exists heart_post_comments (
    id text primary key,
    heart_post_id text not null,
    member_id text not null,
    content text not null,
    status text not null,
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
    emotion_mode text,
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
    target_member_id text,
    created_by_member_id text not null,
    approved_member_id text,
    expires_at integer not null,
    created_at integer not null,
    approved_at integer
  );

  create table if not exists important_events (
    id text primary key,
    family_space_id text not null,
    title text not null,
    event_type text not null,
    calendar_type text not null,
    event_month integer not null,
    event_day integer not null,
    note text,
    status text not null,
    created_at integer not null,
    updated_at integer not null
  );
`

export function initializeSchema(db) {
  db.exec(schemaSql)
  for (const statement of [
    'alter table pulses add column source_message_id text',
    'alter table pulses add column source_excerpt text',
    'alter table pulses add column emotion_source text',
    'alter table pulses add column emotion_label text',
    'alter table pulses add column emotion_mode text',
    "alter table conversations add column conversation_type text not null default 'FAMILY_CHAT'",
    'alter table family_spaces add column join_code text',
    'alter table family_spaces add column elder_birth_month integer',
    'alter table family_spaces add column elder_birth_day integer',
    'alter table family_spaces add column elder_birth_calendar_type text',
    'alter table family_spaces add column created_by_user_id text',
    'alter table members add column user_id text',
    'alter table members add column relation_label text',
    'alter table invite_codes add column target_member_id text',
    'alter table heart_posts add column image_url text',
  ]) {
    try {
      db.exec(statement)
    } catch {
      // Ignore repeated migrations when the column already exists.
    }
  }

  for (const statement of [
    'create unique index if not exists idx_family_spaces_join_code on family_spaces(join_code)',
    'create index if not exists idx_members_family_space_id on members(family_space_id)',
    'create index if not exists idx_members_user_id on members(user_id)',
    'create index if not exists idx_auth_codes_email_purpose on auth_codes(email, purpose)',
    'create index if not exists idx_auth_sessions_user_id on auth_sessions(user_id)',
    'create index if not exists idx_invite_codes_code on invite_codes(code)',
    'create unique index if not exists idx_conversation_participants_unique on conversation_participants(conversation_id, member_id)',
    'create index if not exists idx_conversation_participants_member_id on conversation_participants(member_id)',
    'create unique index if not exists idx_message_receipts_unique on message_receipts(message_id, member_id)',
    'create index if not exists idx_message_receipts_member_id on message_receipts(member_id, consumed_at)',
    'create index if not exists idx_heart_posts_family_space_id on heart_posts(family_space_id, created_at desc)',
    'create unique index if not exists idx_heart_post_likes_post_member on heart_post_likes(heart_post_id, member_id)',
    'create index if not exists idx_heart_post_comments_post_id on heart_post_comments(heart_post_id, created_at asc)',
    'create index if not exists idx_memory_items_entry_id on memory_items(memory_entry_id, sort_order asc)',
    'create index if not exists idx_important_events_family_space_id on important_events(family_space_id, status)',
  ]) {
    db.exec(statement)
  }

  try {
    db.exec(`
      update family_spaces
      set join_code = 'KIN' || upper(substr(replace(hex(randomblob(6)), '0', '8'), 1, 6))
      where join_code is null or join_code = ''
    `)
  } catch {
    // Ignore best-effort backfill failures.
  }
}
