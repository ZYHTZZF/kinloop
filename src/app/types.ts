export type SiteView = 'elder' | 'family'

export type ElderModuleId = 'home' | 'talk' | 'echo' | 'help'
export type FamilyModuleId = 'home' | 'care' | 'status' | 'followup'

export type ElderFeatureId = Exclude<ElderModuleId, 'home'>
export type FamilyFeatureId = Exclude<FamilyModuleId, 'home'>
