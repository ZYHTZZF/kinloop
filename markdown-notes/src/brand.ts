import { existsSync } from 'node:fs';
import { join } from 'node:path';
export function userProfile(appData: string) {
  const current = join(appData, 'Mark It Down');
  const legacy = join(appData, '知页');
  // Keep the existing library in place; a name change must not create an empty replacement.
  return existsSync(join(current, 'library'))
    ? current
    : existsSync(join(legacy, 'library'))
      ? legacy
      : current;
}
export function dataOverride(environment: Record<string, string | undefined>) {
  return environment.MARKITDOWN_DATA_DIR || environment.ZHIYE_DATA_DIR;
}
