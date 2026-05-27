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
import { ArrowDown, ArrowUp, Plus, Save, SortAsc, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatPercent, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SettingsControlGroup } from '../components/settings-form-layout'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  type AffiliateLevelForm,
  createAffiliateLevel,
  normalizeAffiliateLevels,
  parseAffiliateLevels,
  validateAffiliateLevels,
} from './affiliate-levels'

type AffiliateLevelsSectionProps = {
  defaultValues: {
    levels: string
  }
}

type FieldHeaderProps = {
  label: string
  description: string
  className?: string
}

type IconButtonProps = {
  label: string
  icon: React.ReactNode
  disabled?: boolean
  onClick: () => void
}

function FieldHeader({ label, description, className }: FieldHeaderProps) {
  return (
    <div className={cn('min-w-40 space-y-1 whitespace-normal', className)}>
      <span className='block text-sm font-medium'>{label}</span>
      <span className='text-muted-foreground block text-xs leading-snug'>
        {description}
      </span>
    </div>
  )
}

function IconButton({ label, icon, disabled, onClick }: IconButtonProps) {
  const button = (
    <Button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      size='icon'
      type='button'
      variant='outline'
    >
      {icon}
    </Button>
  )

  return (
    <Tooltip>
      <TooltipTrigger render={button}></TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function getNextLevelIndex(levels: AffiliateLevelForm[]) {
  const used = new Set(levels.map((level) => level.key))
  let next = levels.length + 1
  while (used.has(`level_${next}`)) next += 1
  return next
}

export function AffiliateLevelsSection({
  defaultValues,
}: AffiliateLevelsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const parsedLevels = useMemo(
    () => parseAffiliateLevels(defaultValues.levels),
    [defaultValues.levels]
  )
  const [levels, setLevels] = useState<AffiliateLevelForm[]>(parsedLevels)
  const validationError = useMemo(
    () => validateAffiliateLevels(levels),
    [levels]
  )

  useEffect(() => {
    setLevels(parsedLevels)
  }, [parsedLevels])

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
      createAffiliateLevel(getNextLevelIndex(current)),
    ])
  }

  const removeLevel = (index: number) => {
    setLevels((current) =>
      current.length <= 1
        ? current
        : current.filter((_, levelIndex) => levelIndex !== index)
    )
  }

  const moveLevel = (index: number, direction: -1 | 1) => {
    setLevels((current) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= current.length) return current
      const next = [...current]
      const [level] = next.splice(index, 1)
      next.splice(targetIndex, 0, level)
      return next
    })
  }

  const sortLevels = () => {
    setLevels((current) =>
      [...current].sort((a, b) => {
        if (a.min_effective_invites !== b.min_effective_invites) {
          return a.min_effective_invites - b.min_effective_invites
        }
        return a.min_total_reward_quota - b.min_total_reward_quota
      })
    )
  }

  const save = async () => {
    if (validationError) {
      toast.error(t(validationError))
      return
    }

    const result = await updateOption.mutateAsync({
      key: 'affiliate_setting.levels',
      value: JSON.stringify(normalizeAffiliateLevels(levels)),
    })
    if (result.success) {
      toast.success(t('AFFMan levels saved'))
    }
  }

  return (
    <SettingsSection title={t('AFFMan Levels')}>
      <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
        <div className='min-w-0 space-y-1'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Rows are evaluated from top to bottom. A user upgrades only after both thresholds are met; existing users do not downgrade automatically.'
            )}
          </p>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Reward base uses only paid top-up quota and excludes bonuses and commissions.'
            )}
          </p>
        </div>
        <div className='flex shrink-0 flex-wrap gap-2'>
          <Button type='button' variant='outline' onClick={sortLevels}>
            <SortAsc data-icon='inline-start' />
            {t('Sort by thresholds')}
          </Button>
          <Button type='button' variant='outline' onClick={addLevel}>
            <Plus data-icon='inline-start' />
            {t('Add Level')}
          </Button>
          <Button onClick={save} disabled={updateOption.isPending}>
            <Save data-icon='inline-start' />
            {t('Save AFFMan Levels')}
          </Button>
        </div>
      </div>

      {validationError ? (
        <Alert variant='destructive'>
          <AlertDescription>{t(validationError)}</AlertDescription>
        </Alert>
      ) : null}

      <SettingsControlGroup className='p-0'>
        <TooltipProvider>
          <Table className='min-w-[1440px]'>
            <TableHeader>
              <TableRow>
                <TableHead className='w-28 whitespace-normal'>
                  {t('Level')}
                </TableHead>
                <TableHead className='whitespace-normal align-top'>
                  <FieldHeader
                    label={t('Level ID')}
                    description={t(
                      'Stable key stored in logs and user stats. Avoid changing it after users reach this level.'
                    )}
                  />
                </TableHead>
                <TableHead className='whitespace-normal align-top'>
                  <FieldHeader
                    label={t('Display name')}
                    description={t('Name shown to users.')}
                  />
                </TableHead>
                <TableHead className='whitespace-normal align-top'>
                  <FieldHeader
                    label={t('Effective invite threshold')}
                    description={t(
                      'Invited users who have generated inviter commission.'
                    )}
                  />
                </TableHead>
                <TableHead className='whitespace-normal align-top'>
                  <FieldHeader
                    label={t('Total commission threshold')}
                    description={t(
                      'Historical inviter commission quota required for this level.'
                    )}
                  />
                </TableHead>
                <TableHead className='whitespace-normal align-top'>
                  <FieldHeader
                    label={t('Invitee first top-up bonus')}
                    description={t(
                      'Extra quota given to the invitee on their first rewarded top-up.'
                    )}
                  />
                </TableHead>
                <TableHead className='whitespace-normal align-top'>
                  <FieldHeader
                    label={t('Inviter first commission')}
                    description={t(
                      'Commission paid to the inviter on first top-up or inside the first-commission window.'
                    )}
                  />
                </TableHead>
                <TableHead className='whitespace-normal align-top'>
                  <FieldHeader
                    label={t('Lifetime commission')}
                    description={t(
                      'Pay inviter commission for later top-ups after the first-commission window.'
                    )}
                  />
                </TableHead>
                <TableHead className='whitespace-normal align-top'>
                  <FieldHeader
                    label={t('Lifetime commission rate')}
                    description={t(
                      'Commission paid on later top-ups when lifetime commission is enabled.'
                    )}
                  />
                </TableHead>
                <TableHead className='w-32 text-right whitespace-normal'>
                  {t('Actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((level, index) => (
                <TableRow key={`${level.key}-${index}`}>
                  <TableCell className='align-top whitespace-normal'>
                    <div className='flex flex-col gap-2'>
                      <Badge variant={index === 0 ? 'default' : 'secondary'}>
                        {t('Level {{number}}', { number: index + 1 })}
                      </Badge>
                      <span className='text-muted-foreground text-xs'>
                        {level.name || level.key}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className='align-top whitespace-normal'>
                    <Input
                      value={level.key}
                      onChange={(event) =>
                        updateLevel(index, 'key', event.currentTarget.value)
                      }
                      placeholder='level_1'
                    />
                  </TableCell>
                  <TableCell className='align-top whitespace-normal'>
                    <Input
                      value={level.name}
                      onChange={(event) =>
                        updateLevel(index, 'name', event.currentTarget.value)
                      }
                      placeholder='AFFMan Lv.1'
                    />
                  </TableCell>
                  <TableCell className='align-top whitespace-normal'>
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
                    />
                  </TableCell>
                  <TableCell className='align-top whitespace-normal'>
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
                    />
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {formatQuota(level.min_total_reward_quota)}
                    </p>
                  </TableCell>
                  <TableCell className='align-top whitespace-normal'>
                    <Input
                      type='number'
                      min={0}
                      step={0.01}
                      value={level.invitee_first_topup_bonus_percent}
                      onChange={(event) =>
                        updateLevel(
                          index,
                          'invitee_first_topup_bonus_percent',
                          Number(event.currentTarget.value || 0)
                        )
                      }
                    />
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {formatPercent(level.invitee_first_topup_bonus_percent)}
                    </p>
                  </TableCell>
                  <TableCell className='align-top whitespace-normal'>
                    <Input
                      type='number'
                      min={0}
                      step={0.01}
                      value={level.inviter_first_commission_percent}
                      onChange={(event) =>
                        updateLevel(
                          index,
                          'inviter_first_commission_percent',
                          Number(event.currentTarget.value || 0)
                        )
                      }
                    />
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {formatPercent(level.inviter_first_commission_percent)}
                    </p>
                  </TableCell>
                  <TableCell className='align-top whitespace-normal'>
                    <div className='flex h-9 items-center gap-3'>
                      <Switch
                        checked={level.lifetime_commission_enabled}
                        onCheckedChange={(checked) =>
                          updateLevel(
                            index,
                            'lifetime_commission_enabled',
                            checked
                          )
                        }
                      />
                      <Label className='text-sm'>
                        {level.lifetime_commission_enabled
                          ? t('Enabled')
                          : t('Disabled')}
                      </Label>
                    </div>
                  </TableCell>
                  <TableCell className='align-top whitespace-normal'>
                    <Input
                      type='number'
                      min={0}
                      step={0.01}
                      value={level.lifetime_commission_percent}
                      disabled={!level.lifetime_commission_enabled}
                      onChange={(event) =>
                        updateLevel(
                          index,
                          'lifetime_commission_percent',
                          Number(event.currentTarget.value || 0)
                        )
                      }
                    />
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {formatPercent(level.lifetime_commission_percent)}
                    </p>
                  </TableCell>
                  <TableCell className='align-top whitespace-normal'>
                    <div className='flex justify-end gap-2'>
                      <IconButton
                        label={t('Move level up')}
                        icon={<ArrowUp data-icon='inline-start' />}
                        disabled={index === 0}
                        onClick={() => moveLevel(index, -1)}
                      />
                      <IconButton
                        label={t('Move level down')}
                        icon={<ArrowDown data-icon='inline-start' />}
                        disabled={index === levels.length - 1}
                        onClick={() => moveLevel(index, 1)}
                      />
                      <IconButton
                        label={t('Delete level')}
                        icon={<Trash2 data-icon='inline-start' />}
                        disabled={levels.length <= 1}
                        onClick={() => removeLevel(index)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </SettingsControlGroup>
    </SettingsSection>
  )
}
