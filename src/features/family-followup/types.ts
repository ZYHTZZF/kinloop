export type FollowupStatus = 'waiting' | 'in_progress' | 'stabilized' | 'escalated'

export type FollowupTask = {
  label: string
  detail: string
  outcome: string
}

export type FollowupRecord = {
  id: string
  elderName: string
  trigger: string
  status: FollowupStatus
  nextTouchpoint: string
  owner: string
  summary: string
}

export type ClosureAction = {
  label: string
  detail: string
}
