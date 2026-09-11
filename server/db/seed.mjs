const baseTime = Date.parse('2026-03-30T10:30:00+08:00')

const familySpace = {
  id: 'fs_demo',
  name: '李阿姨家庭空间',
  elder_display_name: '李阿姨',
  primary_member_id: 'member_daughter',
  created_at: baseTime,
  updated_at: baseTime,
}

const members = [
  {
    id: 'member_elder',
    family_space_id: familySpace.id,
    role: 'Elder',
    display_name: '李阿姨',
    elder_alias: '我',
    phone: null,
    last_activity_at: baseTime,
    alert_priority: null,
    status: 'Active',
  },
  {
    id: 'member_daughter',
    family_space_id: familySpace.id,
    role: 'Primary',
    display_name: '大女儿',
    elder_alias: '大女儿',
    phone: '13800000001',
    last_activity_at: baseTime - 75 * 60 * 1000,
    alert_priority: 1,
    status: 'Active',
  },
  {
    id: 'member_son',
    family_space_id: familySpace.id,
    role: 'Family',
    display_name: '小儿子',
    elder_alias: '小儿子',
    phone: '13800000002',
    last_activity_at: baseTime - 3 * 24 * 60 * 60 * 1000,
    alert_priority: 2,
    status: 'Active',
  },
  {
    id: 'member_trusted',
    family_space_id: familySpace.id,
    role: 'Trusted',
    display_name: '王阿姨',
    elder_alias: '王阿姨',
    phone: '13800000003',
    last_activity_at: null,
    alert_priority: 3,
    status: 'Active',
  },
]

const conversations = [
  {
    id: 'conv_daughter',
    family_space_id: familySpace.id,
    elder_member_id: 'member_elder',
    family_member_id: 'member_daughter',
    last_meaningful_activity_at: baseTime - 10 * 60 * 1000,
    created_at: baseTime - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'conv_son',
    family_space_id: familySpace.id,
    elder_member_id: 'member_elder',
    family_member_id: 'member_son',
    last_meaningful_activity_at: baseTime - 16 * 60 * 60 * 1000,
    created_at: baseTime - 7 * 24 * 60 * 60 * 1000,
  },
]

const messages = [
  {
    id: 'msg_daughter_1',
    conversation_id: 'conv_daughter',
    sender_type: 'Family',
    sender_member_id: 'member_daughter',
    message_type: 'Text',
    text_content: '这张花好看吗？',
    media_url: null,
    voice_duration_sec: null,
    transcript: null,
    transcript_confidence: null,
    ai_drafted: 0,
    status: 'READ',
    is_low_information: 0,
    created_at: baseTime - 15 * 60 * 1000,
    delivered_at: baseTime - 15 * 60 * 1000,
    consumed_at: baseTime - 14 * 60 * 1000,
    recalled_at: null,
  },
  {
    id: 'msg_daughter_2',
    conversation_id: 'conv_daughter',
    sender_type: 'Family',
    sender_member_id: 'member_daughter',
    message_type: 'Image',
    text_content: '今天路上看到花开了，想给你看看。',
    media_url: 'memory://flower-photo',
    voice_duration_sec: null,
    transcript: null,
    transcript_confidence: null,
    ai_drafted: 0,
    status: 'DELIVERED',
    is_low_information: 0,
    created_at: baseTime - 14 * 60 * 1000,
    delivered_at: baseTime - 14 * 60 * 1000,
    consumed_at: null,
    recalled_at: null,
  },
  {
    id: 'msg_daughter_3',
    conversation_id: 'conv_daughter',
    sender_type: 'Family',
    sender_member_id: 'member_daughter',
    message_type: 'Voice',
    text_content: null,
    media_url: 'voice://daughter-greeting',
    voice_duration_sec: 18,
    transcript: '我周末给你带点新鲜橙子回去。',
    transcript_confidence: 0.94,
    ai_drafted: 0,
    status: 'DELIVERED',
    is_low_information: 0,
    created_at: baseTime - 12 * 60 * 1000,
    delivered_at: baseTime - 12 * 60 * 1000,
    consumed_at: null,
    recalled_at: null,
  },
  {
    id: 'msg_daughter_4',
    conversation_id: 'conv_daughter',
    sender_type: 'Elder',
    sender_member_id: 'member_elder',
    message_type: 'Text',
    text_content: '这花挺好看的。',
    media_url: null,
    voice_duration_sec: null,
    transcript: null,
    transcript_confidence: null,
    ai_drafted: 1,
    status: 'DELIVERED',
    is_low_information: 0,
    created_at: baseTime - 10 * 60 * 1000,
    delivered_at: baseTime - 10 * 60 * 1000,
    consumed_at: baseTime - 9 * 60 * 1000,
    recalled_at: null,
  },
  {
    id: 'msg_son_1',
    conversation_id: 'conv_son',
    sender_type: 'Family',
    sender_member_id: 'member_son',
    message_type: 'Voice',
    text_content: null,
    media_url: 'voice://son-weekend',
    voice_duration_sec: 21,
    transcript: '妈，我周末带孩子回去，咱们一起吃饭。',
    transcript_confidence: 0.96,
    ai_drafted: 0,
    status: 'DELIVERED',
    is_low_information: 0,
    created_at: baseTime - 16 * 60 * 60 * 1000,
    delivered_at: baseTime - 16 * 60 * 60 * 1000,
    consumed_at: null,
    recalled_at: null,
  },
]

const memories = [
  {
    id: 'memory_1',
    family_space_id: familySpace.id,
    source_conv_id: 'conv_daughter',
    source_msg_id: 'msg_daughter_2',
    added_by_member_id: 'member_daughter',
    added_at: baseTime - 9 * 60 * 1000,
    memory_type: 'Image',
    title: '路边的花',
    description: '大女儿发来一张花的照片，你说这花像以前院子里种过的那一丛。',
    media_url: 'memory://flower-photo',
    status: 'ACTIVE',
    visible_scope: 'FamilySpaceDefault',
    created_at: baseTime - 9 * 60 * 1000,
    updated_at: baseTime - 9 * 60 * 1000,
  },
]

const pulses = [
  {
    id: 'pulse_1',
    family_space_id: familySpace.id,
    source_type: 'Behavior',
    pulse_type: 'Action',
    severity: 'LOW',
    summary: '妈妈看完了你昨天发的照片。',
    source_conversation_id: 'conv_daughter',
    status: 'OPEN',
    created_at: baseTime - 60 * 60 * 1000,
    resolved_at: null,
  },
  {
    id: 'pulse_2',
    family_space_id: familySpace.id,
    source_type: 'AI',
    pulse_type: 'Emotion',
    severity: 'MEDIUM',
    summary: '妈妈跟 AI 提到今天有点没精神。',
    source_conversation_id: null,
    status: 'OPEN',
    created_at: baseTime - 2 * 60 * 60 * 1000,
    resolved_at: null,
  },
]

const followups = [
  {
    id: 'followup_1',
    linked_pulse_id: 'pulse_2',
    linked_alert_id: null,
    handler_member_id: 'member_daughter',
    action_type: 'Call',
    result_tag: '已陪聊',
    result_note: '打了十分钟电话，情绪明显缓和一些。',
    status: 'LINKED',
    created_at: baseTime - 26 * 60 * 60 * 1000,
  },
]

const alerts = [
  {
    id: 'alert_1',
    family_space_id: familySpace.id,
    alert_type: 'UNWELL',
    trigger_source: 'Button',
    status: 'HANDLING',
    acknowledged_by: 'member_daughter',
    triggered_at: baseTime - 80 * 60 * 1000,
    countdown_deadline_at: null,
    escalation_level: 1,
    resolved_at: null,
    resolution_note: null,
  },
]

const permissionPolicies = [
  {
    id: 'policy_primary',
    family_space_id: familySpace.id,
    role: 'Primary',
    can_view_pulse: 1,
    can_view_followup: 1,
    can_view_memory: 1,
    can_receive_sos: 1,
    can_receive_unwell: 1,
    can_manage_members: 1,
    can_manage_alert_order: 1,
  },
  {
    id: 'policy_family',
    family_space_id: familySpace.id,
    role: 'Family',
    can_view_pulse: 1,
    can_view_followup: 1,
    can_view_memory: 1,
    can_receive_sos: 1,
    can_receive_unwell: 1,
    can_manage_members: 0,
    can_manage_alert_order: 0,
  },
  {
    id: 'policy_trusted',
    family_space_id: familySpace.id,
    role: 'Trusted',
    can_view_pulse: 0,
    can_view_followup: 0,
    can_view_memory: 0,
    can_receive_sos: 1,
    can_receive_unwell: 0,
    can_manage_members: 0,
    can_manage_alert_order: 0,
  },
]

const inviteCodes = [
  {
    id: 'invite_1',
    family_space_id: familySpace.id,
    code: 'KIN628',
    status: 'ACTIVE',
    requested_role: 'Family',
    created_by_member_id: 'member_daughter',
    approved_member_id: null,
    expires_at: baseTime + 24 * 60 * 60 * 1000,
    created_at: baseTime - 20 * 60 * 1000,
    approved_at: null,
  },
  {
    id: 'invite_2',
    family_space_id: familySpace.id,
    code: 'KIN902',
    status: 'PENDING',
    requested_role: 'Family',
    created_by_member_id: 'member_daughter',
    approved_member_id: null,
    expires_at: baseTime + 24 * 60 * 60 * 1000,
    created_at: baseTime - 10 * 60 * 1000,
    approved_at: null,
  },
]

function insertMany(db, sql, rows) {
  const statement = db.prepare(sql)

  for (const row of rows) {
    statement.run(row)
  }
}

export function seedDatabase(db) {
  const countRow = db.prepare('select count(*) as count from family_spaces').get()

  if ((countRow?.count ?? 0) > 0) {
    return
  }

  db.prepare(`
    insert into family_spaces (
      id, name, elder_display_name, primary_member_id, created_at, updated_at
    ) values (
      $id, $name, $elder_display_name, $primary_member_id, $created_at, $updated_at
    )
  `).run(familySpace)

  insertMany(db, `
    insert into members (
      id, family_space_id, role, display_name, elder_alias, phone,
      last_activity_at, alert_priority, status
    ) values (
      $id, $family_space_id, $role, $display_name, $elder_alias, $phone,
      $last_activity_at, $alert_priority, $status
    )
  `, members)

  insertMany(db, `
    insert into conversations (
      id, family_space_id, elder_member_id, family_member_id,
      last_meaningful_activity_at, created_at
    ) values (
      $id, $family_space_id, $elder_member_id, $family_member_id,
      $last_meaningful_activity_at, $created_at
    )
  `, conversations)

  insertMany(db, `
    insert into messages (
      id, conversation_id, sender_type, sender_member_id, message_type,
      text_content, media_url, voice_duration_sec, transcript, transcript_confidence,
      ai_drafted, status, is_low_information, created_at, delivered_at, consumed_at, recalled_at
    ) values (
      $id, $conversation_id, $sender_type, $sender_member_id, $message_type,
      $text_content, $media_url, $voice_duration_sec, $transcript, $transcript_confidence,
      $ai_drafted, $status, $is_low_information, $created_at, $delivered_at, $consumed_at, $recalled_at
    )
  `, messages)

  insertMany(db, `
    insert into memory_entries (
      id, family_space_id, source_conv_id, source_msg_id, added_by_member_id,
      added_at, memory_type, title, description, media_url, status,
      visible_scope, created_at, updated_at
    ) values (
      $id, $family_space_id, $source_conv_id, $source_msg_id, $added_by_member_id,
      $added_at, $memory_type, $title, $description, $media_url, $status,
      $visible_scope, $created_at, $updated_at
    )
  `, memories)

  insertMany(db, `
    insert into pulses (
      id, family_space_id, source_type, pulse_type, severity, summary,
      source_conversation_id, status, created_at, resolved_at
    ) values (
      $id, $family_space_id, $source_type, $pulse_type, $severity, $summary,
      $source_conversation_id, $status, $created_at, $resolved_at
    )
  `, pulses)

  insertMany(db, `
    insert into followup_records (
      id, linked_pulse_id, linked_alert_id, handler_member_id,
      action_type, result_tag, result_note, status, created_at
    ) values (
      $id, $linked_pulse_id, $linked_alert_id, $handler_member_id,
      $action_type, $result_tag, $result_note, $status, $created_at
    )
  `, followups)

  insertMany(db, `
    insert into alerts (
      id, family_space_id, alert_type, trigger_source, status,
      acknowledged_by, triggered_at, countdown_deadline_at, escalation_level,
      resolved_at, resolution_note
    ) values (
      $id, $family_space_id, $alert_type, $trigger_source, $status,
      $acknowledged_by, $triggered_at, $countdown_deadline_at, $escalation_level,
      $resolved_at, $resolution_note
    )
  `, alerts)

  insertMany(db, `
    insert into permission_policies (
      id, family_space_id, role, can_view_pulse, can_view_followup,
      can_view_memory, can_receive_sos, can_receive_unwell,
      can_manage_members, can_manage_alert_order
    ) values (
      $id, $family_space_id, $role, $can_view_pulse, $can_view_followup,
      $can_view_memory, $can_receive_sos, $can_receive_unwell,
      $can_manage_members, $can_manage_alert_order
    )
  `, permissionPolicies)

  insertMany(db, `
    insert into invite_codes (
      id, family_space_id, code, status, requested_role,
      created_by_member_id, approved_member_id, expires_at, created_at, approved_at
    ) values (
      $id, $family_space_id, $code, $status, $requested_role,
      $created_by_member_id, $approved_member_id, $expires_at, $created_at, $approved_at
    )
  `, inviteCodes)
}
