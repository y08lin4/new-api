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
import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  SettingsControlGroup,
  SettingsFormGrid,
  SettingsFormGridItem,
  SettingsSwitchField,
} from '../components/settings-form-layout'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type AffiliateLevelForm = {
  key: string
  name: string
  min_effective_invites: number
  min_total_reward_quota: number
  invitee_first_topup_bonus_percent: number
  inviter_first_commission_percent: number
  lifetime_commission_enabled: boolean
  lifetime_commission_percent: number
}

type AffiliateRewardsSectionProps = {
  defaultValues: {
    enabled: boolean
    registrationRewardEnabled: boolean
    settleToAffQuota: boolean
    minRewardBaseQuota: number
    firstCommissionWindowDays: number
    quotaForInviter: number
    quotaForInvitee: number
    levels: string
  }
  complianceConfirmed?: boolean
}

const fallbackLevels: AffiliateLevelForm[] = [
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

function parseLevels(value: string): AffiliateLevelForm[] {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallbackLevels
  } catch {
    return fallbackLevels
  }
}

function validateLevels(levels: AffiliateLevelForm[]) {
  const seen = new Set<string>()
  let prevInvites = -1
  let prevQuota = -1

  for (const level of levels) {
    const key = level.key.trim()
    if (!key) return 'Level key cannot be empty'
    if (seen.has(key)) return 'Level key must be unique'
    seen.add(key)
    if (!level.name.trim()) return 'Level name cannot be empty'

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

export function AffiliateRewardsSection({
  defaultValues,
  complianceConfirmed = true,
}: AffiliateRewardsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const parsedLevels = useMemo(
    () => parseLevels(defaultValues.levels),
    [defaultValues.levels]
  )
  const [enabled, setEnabled] = useState(defaultValues.enabled)
  const [registrationRewardEnabled, setRegistrationRewardEnabled] = useState(
    defaultValues.registrationRewardEnabled
  )
  const [settleToAffQuota, setSettleToAffQuota] = useState(
    defaultValues.settleToAffQuota
  )
  const [minRewardBaseQuota, setMinRewardBaseQuota] = useState(
    defaultValues.minRewardBaseQuota
  )
  const [firstCommissionWindowDays, setFirstCommissionWindowDays] = useState(
    defaultValues.firstCommissionWindowDays
  )
  const [quotaForInviter, setQuotaForInviter] = useState(
    defaultValues.quotaForInviter
  )
  const [quotaForInvitee, setQuotaForInvitee] = useState(
    defaultValues.quotaForInvitee
  )
  const [levels, setLevels] = useState<AffiliateLevelForm[]>(parsedLevels)

  useEffect(() => {
    setEnabled(defaultValues.enabled)
    setRegistrationRewardEnabled(defaultValues.registrationRewardEnabled)
    setSettleToAffQuota(defaultValues.settleToAffQuota)
    setMinRewardBaseQuota(defaultValues.minRewardBaseQuota)
    setFirstCommissionWindowDays(defaultValues.firstCommissionWindowDays)
    setQuotaForInviter(defaultValues.quotaForInviter)
    setQuotaForInvitee(defaultValues.quotaForInvitee)
    setLevels(parsedLevels)
  }, [defaultValues, parsedLevels])

  const updateLevel = (
    index: number,
    key: keyof AffiliateLevelForm,
    value: string | number | boolean
  ) => {
    setLevels((current) =>
      current.map((level, levelIndex) =>
        levelIndex === index ? { ...level, [key]: value } : level
      )
    )
  }

  const addLevel = () => {
    setLevels((current) => [
      ...current,
      {
        ...fallbackLevels[0],
        key: `level_${current.length + 1}`,
        name: `AFFMan Lv.${current.length + 1}`,
      },
    ])
  }

  const removeLevel = (index: number) => {
    setLevels((current) =>
      current.filter((_, levelIndex) => levelIndex !== index)
    )
  }

  const save = async () => {
    const validationError = validateLevels(levels)
    if (validationError) {
      toast.error(t(validationError))
      return
    }

    const updates = [
      ['affiliate_setting.enabled', enabled],
      ['affiliate_setting.registration_reward_enabled', registrationRewardEnabled],
      ['affiliate_setting.settle_to_aff_quota', settleToAffQuota],
      ['affiliate_setting.min_reward_base_quota', minRewardBaseQuota],
      [
        'affiliate_setting.first_commission_window_days',
        firstCommissionWindowDays,
      ],
      ['QuotaForInviter', quotaForInviter],
      ['QuotaForInvitee', quotaForInvitee],
      ['affiliate_setting.levels', JSON.stringify(levels)],
    ] as const

    for (const [key, value] of updates) {
      const result = await updateOption.mutateAsync({ key, value })
      if (!result.success) return
    }
  }

  return (
    <SettingsSection title={t('Affiliate Rewards')}>
      {!complianceConfirmed ? (
        <Alert variant='destructive'>
          <AlertDescription>
            {t(
              'Affiliate reward switches require compliance confirmation in Payment Gateway settings.'
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className='flex justify-end'>
        <Button onClick={save} disabled={updateOption.isPending}>
          {t('Save Affiliate Rewards')}
        </Button>
      </div>

      <SettingsControlGroup>
        <SettingsSwitchField
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={!complianceConfirmed || updateOption.isPending}
          label={t('Enable top-up affiliate rewards')}
          description={t(
            'When enabled, successful top-ups can create invitee bonuses and inviter commissions.'
          )}
        />
        <SettingsSwitchField
          checked={registrationRewardEnabled}
          onCheckedChange={setRegistrationRewardEnabled}
          disabled={!complianceConfirmed || updateOption.isPending}
          label={t('Enable registration rewards')}
          description={t(
            'Keep the legacy fixed registration rewards available behind a separate switch.'
          )}
        />
        <SettingsSwitchField
          checked={settleToAffQuota}
          onCheckedChange={setSettleToAffQuota}
          disabled={updateOption.isPending}
          label={t('Settle inviter rewards to affiliate balance')}
          description={t(
            'When disabled, inviter rewards are credited directly to the main balance.'
          )}
        />
      </SettingsControlGroup>

      <SettingsFormGrid>
        {[
          {
            label: 'Minimum rewarded top-up quota',
            value: minRewardBaseQuota,
            setValue: setMinRewardBaseQuota,
          },
          {
            label: 'First commission window days',
            value: firstCommissionWindowDays,
            setValue: setFirstCommissionWindowDays,
          },
          {
            label: 'Registration inviter fixed reward',
            value: quotaForInviter,
            setValue: setQuotaForInviter,
          },
          {
            label: 'Registration invitee fixed reward',
            value: quotaForInvitee,
            setValue: setQuotaForInvitee,
          },
        ].map((item) => (
          <div key={item.label} className='min-w-0'>
            <Label>{t(item.label)}</Label>
            <Input
              type='number'
              min={0}
              value={item.value}
              onChange={(event) =>
                item.setValue(Number(event.currentTarget.value || 0))
              }
            />
          </div>
        ))}
      </SettingsFormGrid>

      <SettingsControlGroup className='gap-3'>
        <div className='flex items-center justify-between gap-3'>
          <div className='min-w-0'>
            <Label>{t('AFFMan Levels')}</Label>
            <p className='text-muted-foreground text-xs'>
              {t('Levels upgrade only after both thresholds are met.')}
            </p>
          </div>
          <Button type='button' variant='outline' size='sm' onClick={addLevel}>
            <Plus data-icon='inline-start' />
            {t('Add Level')}
          </Button>
        </div>

        <div className='flex flex-col gap-3'>
          {levels.map((level, index) => (
            <SettingsControlGroup key={`${level.key}-${index}`}>
              <div className='grid gap-3 md:grid-cols-4'>
                <Input
                  value={level.key}
                  onChange={(event) =>
                    updateLevel(index, 'key', event.currentTarget.value)
                  }
                  placeholder='level_1'
                />
                <Input
                  value={level.name}
                  onChange={(event) =>
                    updateLevel(index, 'name', event.currentTarget.value)
                  }
                  placeholder='AFFMan Lv.1'
                />
                <Input
                  type='number'
                  min={0}
                  value={level.min_effective_invites}
                  onChange={(event) =>
                    updateLevel(
                      index,
                      'min_effective_invites',
                      Number(event.currentTarget.value || 0)
                    )
                  }
                  placeholder={t('Effective invites')}
                />
                <Input
                  type='number'
                  min={0}
                  value={level.min_total_reward_quota}
                  onChange={(event) =>
                    updateLevel(
                      index,
                      'min_total_reward_quota',
                      Number(event.currentTarget.value || 0)
                    )
                  }
                  placeholder={t('Reward quota')}
                />
              </div>
              <div className='grid gap-3 md:grid-cols-4'>
                <Input
                  type='number'
                  min={0}
                  value={level.invitee_first_topup_bonus_percent}
                  onChange={(event) =>
                    updateLevel(
                      index,
                      'invitee_first_topup_bonus_percent',
                      Number(event.currentTarget.value || 0)
                    )
                  }
                  placeholder={t('Invitee bonus %')}
                />
                <Input
                  type='number'
                  min={0}
                  value={level.inviter_first_commission_percent}
                  onChange={(event) =>
                    updateLevel(
                      index,
                      'inviter_first_commission_percent',
                      Number(event.currentTarget.value || 0)
                    )
                  }
                  placeholder={t('First commission %')}
                />
                <div className='flex items-center justify-between gap-3 rounded-md border px-3'>
                  <span className='text-sm'>{t('Lifetime enabled')}</span>
                  <Switch
                    checked={level.lifetime_commission_enabled}
                    onCheckedChange={(checked) =>
                      updateLevel(index, 'lifetime_commission_enabled', checked)
                    }
                  />
                </div>
                <div className='flex gap-2'>
                  <Input
                    type='number'
                    min={0}
                    value={level.lifetime_commission_percent}
                    onChange={(event) =>
                      updateLevel(
                        index,
                        'lifetime_commission_percent',
                        Number(event.currentTarget.value || 0)
                      )
                    }
                    placeholder={t('Lifetime %')}
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    disabled={levels.length <= 1}
                    onClick={() => removeLevel(index)}
                  >
                    <Trash2 data-icon='inline-start' />
                  </Button>
                </div>
              </div>
            </SettingsControlGroup>
          ))}
        </div>
      </SettingsControlGroup>

      <SettingsFormGridItem span='full'>
        <p className='text-muted-foreground text-xs'>
          {t(
            'Reward base uses only paid top-up quota and excludes bonuses and commissions.'
          )}
        </p>
      </SettingsFormGridItem>
    </SettingsSection>
  )
}
