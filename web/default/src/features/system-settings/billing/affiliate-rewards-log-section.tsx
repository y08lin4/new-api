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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatPercent, formatQuota } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAdminAffiliateRewards } from '../api'
import { SettingsSection } from '../components/settings-section'
import type { AffiliateReward } from '../types'
import { formatTimestamp } from '@/features/wallet/lib/billing'

const rewardTypeLabels: Record<string, string> = {
  registration_inviter: 'Registration inviter reward',
  registration_invitee: 'Registration invitee reward',
  invitee_first_topup_bonus: 'Invitee first top-up bonus',
  inviter_first_commission: 'Inviter first commission',
  inviter_lifetime_commission: 'Inviter lifetime commission',
}

type AffiliateRewardsLogSectionProps = {
  levels: string
}

type AffiliateLevelOption = {
  key: string
  name: string
}

function parseLevelOptions(value: string): AffiliateLevelOption[] {
  try {
    const parsed = JSON.parse(value || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (level): level is AffiliateLevelOption =>
          typeof level?.key === 'string' && typeof level?.name === 'string'
      )
      .map((level) => ({ key: level.key, name: level.name }))
  } catch {
    return []
  }
}

export function AffiliateRewardsLogSection({
  levels,
}: AffiliateRewardsLogSectionProps) {
  const { t } = useTranslation()
  const [records, setRecords] = useState<AffiliateReward[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [rewardType, setRewardType] = useState('all')
  const [levelKey, setLevelKey] = useState('all')
  const [loading, setLoading] = useState(false)
  const levelOptions = useMemo(() => parseLevelOptions(levels), [levels])
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetchRewards = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getAdminAffiliateRewards({
        p: page,
        page_size: pageSize,
        keyword,
        reward_type: rewardType === 'all' ? undefined : rewardType,
        level_key: levelKey === 'all' ? undefined : levelKey,
      })
      if (response.success && response.data) {
        setRecords(response.data.items || [])
        setTotal(response.data.total || 0)
      } else {
        toast.error(response.message || t('Failed to load affiliate rewards'))
      }
    } catch (_error) {
      toast.error(t('Failed to load affiliate rewards'))
    } finally {
      setLoading(false)
    }
  }, [keyword, levelKey, page, rewardType, t])

  useEffect(() => {
    fetchRewards()
  }, [fetchRewards])

  return (
    <SettingsSection title={t('Affiliate Reward Logs')}>
      <div className='flex flex-col gap-3 sm:flex-row'>
        <div className='relative min-w-0 flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2' />
          <Input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.currentTarget.value)
              setPage(1)
            }}
            placeholder={t('Search order or user ID')}
            className='pl-9'
          />
        </div>
        <Select
          value={rewardType}
          onValueChange={(value) => {
            if (!value) return
            setRewardType(value)
            setPage(1)
          }}
        >
          <SelectTrigger className='w-full sm:w-56'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value='all'>{t('All reward types')}</SelectItem>
              {Object.entries(rewardTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {t(label)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={levelKey}
          onValueChange={(value) => {
            if (!value) return
            setLevelKey(value)
            setPage(1)
          }}
        >
          <SelectTrigger className='w-full sm:w-48'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value='all'>{t('All levels')}</SelectItem>
              {levelOptions.map((level) => (
                <SelectItem key={level.key} value={level.key}>
                  {level.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className='overflow-x-auto'>
        <Table className='min-w-[980px]'>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Time')}</TableHead>
              <TableHead>{t('Type')}</TableHead>
              <TableHead>{t('Level')}</TableHead>
              <TableHead>{t('Inviter')}</TableHead>
              <TableHead>{t('Invitee')}</TableHead>
              <TableHead>{t('Beneficiary')}</TableHead>
              <TableHead>{t('Order')}</TableHead>
              <TableHead className='text-right'>{t('Base')}</TableHead>
              <TableHead className='text-right'>{t('Rate')}</TableHead>
              <TableHead className='text-right'>{t('Reward')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell>{formatTimestamp(record.created_at)}</TableCell>
                <TableCell>
                  {t(
                    rewardTypeLabels[record.reward_type] || record.reward_type
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant='secondary'>
                    {record.aff_level_key || '-'}
                  </Badge>
                </TableCell>
                <TableCell>{record.inviter_id || '-'}</TableCell>
                <TableCell>{record.invitee_id || '-'}</TableCell>
                <TableCell>{record.beneficiary_id || '-'}</TableCell>
                <TableCell>
                  <code className='text-xs'>
                    {record.trade_no || `#${record.source_id}`}
                  </code>
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
              </TableRow>
            ))}
            {!loading && records.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className='text-muted-foreground h-28 text-center'
                >
                  {t('No affiliate rewards found')}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-between gap-3 border-t pt-3'>
        <span className='text-muted-foreground text-xs'>
          {loading ? t('Loading...') : `${t('Total')}: ${total}`}
        </span>
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
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page >= totalPages}
            className='size-8 p-0'
          >
            <ChevronRight data-icon='inline-start' />
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
