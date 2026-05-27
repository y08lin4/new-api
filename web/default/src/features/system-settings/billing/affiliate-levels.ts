/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
export type AffiliateLevelForm = {
  key: string
  name: string
  min_effective_invites: number
  min_total_reward_quota: number
  invitee_first_topup_bonus_percent: number
  inviter_first_commission_percent: number
  lifetime_commission_enabled: boolean
  lifetime_commission_percent: number
}

export const fallbackAffiliateLevels: AffiliateLevelForm[] = [
  {
    key: 'level_1',
    name: 'AFFMan Lv.1',
    min_effective_invites: 0,
    min_total_reward_quota: 0,
    invitee_first_topup_bonus_percent: 0,
    inviter_first_commission_percent: 0,
    lifetime_commission_enabled: false,
    lifetime_commission_percent: 0,
  },
]

const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function createAffiliateLevel(index: number): AffiliateLevelForm {
  return {
    ...fallbackAffiliateLevels[0],
    key: `level_${index}`,
    name: `AFFMan Lv.${index}`,
  }
}

export function parseAffiliateLevels(value: string): AffiliateLevelForm[] {
  try {
    const parsed = JSON.parse(value || '[]')
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return fallbackAffiliateLevels
    }

    return parsed.map((level) => ({
      key: typeof level?.key === 'string' ? level.key : '',
      name: typeof level?.name === 'string' ? level.name : '',
      min_effective_invites: toNumber(level?.min_effective_invites),
      min_total_reward_quota: toNumber(level?.min_total_reward_quota),
      invitee_first_topup_bonus_percent: toNumber(
        level?.invitee_first_topup_bonus_percent
      ),
      inviter_first_commission_percent: toNumber(
        level?.inviter_first_commission_percent
      ),
      lifetime_commission_enabled: Boolean(level?.lifetime_commission_enabled),
      lifetime_commission_percent: toNumber(level?.lifetime_commission_percent),
    }))
  } catch {
    return fallbackAffiliateLevels
  }
}

export function normalizeAffiliateLevels(
  levels: AffiliateLevelForm[]
): AffiliateLevelForm[] {
  return levels.map((level) => ({
    ...level,
    key: level.key.trim(),
    name: level.name.trim(),
    min_effective_invites: Math.max(0, toNumber(level.min_effective_invites)),
    min_total_reward_quota: Math.max(0, toNumber(level.min_total_reward_quota)),
    invitee_first_topup_bonus_percent: Math.max(
      0,
      toNumber(level.invitee_first_topup_bonus_percent)
    ),
    inviter_first_commission_percent: Math.max(
      0,
      toNumber(level.inviter_first_commission_percent)
    ),
    lifetime_commission_percent: Math.max(
      0,
      toNumber(level.lifetime_commission_percent)
    ),
  }))
}

export function validateAffiliateLevels(levels: AffiliateLevelForm[]) {
  const normalized = normalizeAffiliateLevels(levels)
  const seen = new Set<string>()
  let prevInvites = -1
  let prevQuota = -1

  for (const level of normalized) {
    if (!level.key) return 'Level key cannot be empty'
    if (seen.has(level.key)) return 'Level key must be unique'
    seen.add(level.key)
    if (!level.name) return 'Level name cannot be empty'

    const numbers = [
      level.min_effective_invites,
      level.min_total_reward_quota,
      level.invitee_first_topup_bonus_percent,
      level.inviter_first_commission_percent,
      level.lifetime_commission_percent,
    ]
    if (numbers.some((value) => !Number.isFinite(value) || value < 0)) {
      return 'Level thresholds and percentages must be non-negative'
    }
    if (
      level.min_effective_invites < prevInvites ||
      level.min_total_reward_quota < prevQuota
    ) {
      return 'Levels must be sorted by thresholds ascending'
    }
    prevInvites = level.min_effective_invites
    prevQuota = level.min_total_reward_quota
  }

  return null
}
