import { getWebSocketOrigin } from '../../platform/apiConfig'

export function getWebSocketUrl() {
  return getWebSocketOrigin()
}
