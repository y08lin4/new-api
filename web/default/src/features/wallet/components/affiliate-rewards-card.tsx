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
import { Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatPercent, formatQuota } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/copy-button'
import type { AffiliatePolicy, UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  onTransfer: () => void
  onOpenRewards: () => void
  policy?: AffiliatePolicy
  complianceConfirmed?: boolean
  loading?: boolean
}

export function AffiliateRewardsCard({
  user,
  affiliateLink,
  onTransfer,
  onOpenRewards,
  policy,
  complianceConfirmed = true,
  loading,
}: AffiliateRewardsCardProps) {
  const { t } = useTranslation()
  if (loading) {
    return (
      <Card className='bg-muted/20 py-0'>
        <CardContent className='grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,0.72fr)_minmax(320px,1.15fr)] lg:items-center'>
          <div>
            <Skeleton className='h-5 w-32' />
            <Skeleton className='mt-2 h-4 w-48' />
          </div>
          <Skeleton className='h-14 rounded-lg' />
          <Skeleton className='h-10 rounded-lg' />
        </CardContent>
      </Card>
    )
  }

  const hasRewards = (user?.aff_quota ?? 0) > 0
  const currentLevel = policy?.current_level
  const nextLevel = policy?.next_level
  const inviteProgress = Math.round((policy?.invite_progress ?? 0) * 100)
  const rewardProgress = Math.round((policy?.reward_progress ?? 0) * 100)

  return (
    <Card className='bg-muted/20 py-0'>
      <CardContent className='grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,0.75fr)_minmax(300px,1fr)] lg:items-center'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border'>
            <Share2 className='text-muted-foreground size-4' />
          </div>
          <div className='min-w-0'>
            <h3 className='truncate text-sm font-semibold'>
              {t('Referral Program')}
            </h3>
            <div className='mt-1 flex flex-wrap items-center gap-1.5'>
              <Badge variant='secondary'>
                {currentLevel?.name || t('AFFMan Lv.1')}
              </Badge>
              {policy?.enabled ? (
                <Badge variant='outline'>{t('Top-up rewards enabled')}</Badge>
              ) : (
                <Badge variant='outline'>{t('Top-up rewards disabled')}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className='grid grid-cols-3 gap-1.5 text-center'>
          {[
            [t('Pending'), formatQuota(user?.aff_quota ?? 0)],
            [t('Total Earned'), formatQuota(user?.aff_history_quota ?? 0)],
            [t('Invites'), String(user?.aff_count ?? 0)],
          ].map(([label, value]) => (
            <div key={label}>
              <div className='text-muted-foreground truncate text-[10px] font-medium tracking-wider uppercase'>
                {label}
              </div>
              <div className='mt-0.5 truncate text-sm font-semibold tabular-nums'>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className='flex min-w-0 flex-col gap-2'>
          <div className='flex items-center gap-2'>
            <Input
              value={affiliateLink}
              readOnly
              className='border-muted bg-background/70 h-9 min-w-0 flex-1 font-mono text-xs'
            />
            <CopyButton
              value={affiliateLink}
              variant='outline'
              className='bg-background size-9 shrink-0'
              iconClassName='size-4'
              tooltip={t('Copy referral link')}
              aria-label={t('Copy referral link')}
            />
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              onClick={onOpenRewards}
              variant='outline'
              className='h-9 shrink-0 px-3'
              size='sm'
            >
              {t('Reward Details')}
            </Button>
            {hasRewards && (
              <Button
                onClick={onTransfer}
                disabled={!complianceConfirmed}
                className='h-9 shrink-0 px-3'
                size='sm'
              >
                {t('Transfer to Balance')}
              </Button>
            )}
          </div>
        </div>

        <div className='grid gap-2 border-t pt-3 lg:col-span-3'>
          <div className='grid gap-2 text-xs sm:grid-cols-3'>
            <div className='text-muted-foreground'>
              {t('First commission')}:{' '}
              <span className='text-foreground font-medium'>
                {formatPercent(
                  currentLevel?.inviter_first_commission_percent ?? 0
                )}
              </span>
            </div>
            <div className='text-muted-foreground'>
              {t('Lifetime commission')}:{' '}
              <span className='text-foreground font-medium'>
                {currentLevel?.lifetime_commission_enabled
                  ? formatPercent(
                      currentLevel?.lifetime_commission_percent ?? 0
                    )
                  : t('Disabled')}
              </span>
            </div>
            <div className='text-muted-foreground'>
              {t('Invitee first top-up bonus')}:{' '}
              <span className='text-foreground font-medium'>
                {formatPercent(
                  currentLevel?.invitee_first_topup_bonus_percent ?? 0
                )}
              </span>
            </div>
          </div>
          {nextLevel ? (
            <div className='grid gap-2 sm:grid-cols-2'>
              <div className='min-w-0'>
                <div className='mb-1 flex justify-between text-xs'>
                  <span className='text-muted-foreground'>
                    {t('Effective invites to next level')}
                  </span>
                  <span className='font-medium'>{inviteProgress}%</span>
                </div>
                <Progress value={inviteProgress} />
              </div>
              <div className='min-w-0'>
                <div className='mb-1 flex justify-between text-xs'>
                  <span className='text-muted-foreground'>
                    {t('Reward quota to next level')}
                  </span>
                  <span className='font-medium'>{rewardProgress}%</span>
                </div>
                <Progress value={rewardProgress} />
              </div>
            </div>
          ) : (
            <p className='text-muted-foreground text-xs'>
              {t('You are already at the highest AFFMan level.')}
            </p>
          )}
        </div>

        {!complianceConfirmed ? (
          <p className='text-muted-foreground text-xs lg:col-span-3'>
            {t(
              'Referral reward transfer is disabled until the administrator confirms compliance terms.'
            )}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
