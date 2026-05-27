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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SettingsControlGroup,
  SettingsFormGrid,
  SettingsSwitchField,
} from '../components/settings-form-layout'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type AffiliateRewardsSectionProps = {
  defaultValues: {
    enabled: boolean
    registrationRewardEnabled: boolean
    settleToAffQuota: boolean
    minRewardBaseQuota: number
    firstCommissionWindowDays: number
    quotaForInviter: number
    quotaForInvitee: number
  }
  complianceConfirmed?: boolean
}

export function AffiliateRewardsSection({
  defaultValues,
  complianceConfirmed = true,
}: AffiliateRewardsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
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

  useEffect(() => {
    setEnabled(defaultValues.enabled)
    setRegistrationRewardEnabled(defaultValues.registrationRewardEnabled)
    setSettleToAffQuota(defaultValues.settleToAffQuota)
    setMinRewardBaseQuota(defaultValues.minRewardBaseQuota)
    setFirstCommissionWindowDays(defaultValues.firstCommissionWindowDays)
    setQuotaForInviter(defaultValues.quotaForInviter)
    setQuotaForInvitee(defaultValues.quotaForInvitee)
  }, [defaultValues])

  const save = async () => {
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
    </SettingsSection>
  )
}
