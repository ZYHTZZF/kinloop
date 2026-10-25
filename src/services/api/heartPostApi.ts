import { apiGet, apiPost } from './client'
import type { HeartPost } from './types'

export function listHeartPosts() {
  return apiGet<HeartPost[]>('/heart-posts')
}

export function uploadHeartPostImage(payload: { dataUrl: string }) {
  return apiPost<{ imageUrl: string }>('/heart-posts/upload-image', payload)
}

export function createHeartPost(payload: { content?: string; imageUrl?: string | null }) {
  return apiPost<HeartPost>('/heart-posts', payload)
}

export function toggleHeartPostLike(heartPostId: string) {
  return apiPost<HeartPost>(`/heart-posts/${heartPostId}/likes/toggle`, {})
}

export function createHeartPostComment(heartPostId: string, payload: { content: string }) {
  return apiPost<HeartPost>(`/heart-posts/${heartPostId}/comments`, payload)
}
