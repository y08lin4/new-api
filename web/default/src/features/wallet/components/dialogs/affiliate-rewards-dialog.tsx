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
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatPercent, formatQuota } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getSelfAffiliateRewards, isApiSuccess } from '../../api'
import { formatTimestamp } from '../../lib/billing'
import type { AffiliateReward } from '../../types'

interface AffiliateRewardsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const rewardTypeLabels: Record<string, string> = {
  registration_inviter: 'Registration inviter reward',
  registration_invitee: 'Registration invitee reward',
  invitee_first_topup_bonus: 'Invitee first top-up bonus',
  inviter_first_commission: 'Inviter first commission',
  inviter_lifetime_commission: 'Inviter lifetime commission',
}

function getRelatedUser(reward: AffiliateReward) {
  if (reward.reward_type === 'invitee_first_topup_bonus') {
    return reward.inviter_id
  }
  if (reward.beneficiary_id === reward.inviter_id) {
    return reward.invitee_id
  }
  return reward.inviter_id || reward.invitee_id
}

export function AffiliateRewardsDialog({
  open,
  onOpenChange,
}: AffiliateRewardsDialogProps) {
  const { t } = useTranslation()
  const [records, setRecords] = useState<AffiliateReward[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetchRewards = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const response = await getSelfAffiliateRewards(page, pageSize)
      if (isApiSuccess(response) && response.data) {
        setRecords(response.data.items || [])
        setTotal(response.data.total || 0)
      } else {
        toast.error(response.message || t('Failed to load affiliate rewards'))
        setRecords([])
        setTotal(0)
      }
    } catch (_error) {
      toast.error(t('Failed to load affiliate rewards'))
      setRecords([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [open, page, t])

  useEffect(() => {
    fetchRewards()
  }, [fetchRewards])

  useEffect(() => {
    if (open) {
      setPage(1)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[calc(100dvh-2rem)] flex-col max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:p-4 sm:max-w-5xl'>
        <DialogHeader>
          <DialogTitle>{t('Affiliate Reward Details')}</DialogTitle>
          <DialogDescription>
            {t('Review settled registration and top-up affiliate rewards.')}
          </DialogDescription>
        </DialogHeader>

        <div className='min-h-0 flex-1'>
          <ScrollArea className='h-[calc(100dvh-12rem)] pr-3 sm:h-[520px] sm:pr-4'>
            {loading ? (
              <div className='flex flex-col gap-3'>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className='h-14 rounded-lg' />
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className='text-muted-foreground flex h-72 items-center justify-center text-sm'>
                {t('No affiliate rewards found')}
              </div>
            ) : (
              <Table className='min-w-[900px]'>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Time')}</TableHead>
                    <TableHead>{t('Reward Type')}</TableHead>
                    <TableHead>{t('Order')}</TableHead>
                    <TableHead>{t('Related User')}</TableHead>
                    <TableHead>{t('AFFMan Level')}</TableHead>
                    <TableHead className='text-right'>{t('Base')}</TableHead>
                    <TableHead className='text-right'>{t('Rate')}</TableHead>
                    <TableHead className='text-right'>{t('Reward')}</TableHead>
                    <TableHead>{t('Status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatTimestamp(record.created_at)}</TableCell>
                      <TableCell>
                        {t(
                          rewardTypeLabels[record.reward_type] ||
                            record.reward_type
                        )}
                      </TableCell>
                      <TableCell>
                        <code className='text-xs'>
                          {record.trade_no || `#${record.source_id}`}
                        </code>
                      </TableCell>
                      <TableCell>{getRelatedUser(record) || '-'}</TableCell>
                      <TableCell>
                        <Badge variant='secondary'>
                          {record.aff_level_key || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-right'>
                        {record.base_quota > 0
                          ? formatQuota(record.base_quota)
                          : '-'}
                      </TableCell>
                      <TableCell className='text-right'>
                        {record.rate > 0 ? formatPercent(record.rate) : '-'}
                      </TableCell>
                      <TableCell className='text-right font-medium'>
                        {formatQuota(record.reward_quota)}
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline'>{t('Settled')}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>

          {!loading && records.length > 0 ? (
            <div className='mt-3 flex flex-col items-center gap-3 border-t pt-3 sm:flex-row sm:justify-between'>
              <div className='text-muted-foreground text-xs'>
                {t('Showing')} {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, total)} {t('of')} {total}
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page <= 1}
                  className='size-8 p-0'
                >
                  <ChevronLeft data-icon='inline-start' />
                </Button>
                <span className='text-muted-foreground text-sm'>
                  {page} / {totalPages}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  disabled={page >= totalPages}
                  className='size-8 p-0'
                >
                  <ChevronRight data-icon='inline-start' />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
