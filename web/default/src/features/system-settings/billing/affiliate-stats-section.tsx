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
import { formatQuota } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
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
import { formatTimestamp } from '@/features/wallet/lib/billing'
import { getAdminAffiliateStats } from '../api'
import { SettingsSection } from '../components/settings-section'
import type { AffiliateUserStat } from '../types'

type AffiliateStatsSectionProps = {
  levels: string
}

type AffiliateLevel = {
  key: string
  name: string
  min_effective_invites: number
  min_total_reward_quota: number
}

function parseLevels(value: string): AffiliateLevel[] {
  try {
    const parsed = JSON.parse(value || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (level) =>
          typeof level?.key === 'string' &&
          typeof level?.name === 'string' &&
          Number.isFinite(Number(level.min_effective_invites)) &&
          Number.isFinite(Number(level.min_total_reward_quota))
      )
      .map((level) => ({
        key: level.key,
        name: level.name,
        min_effective_invites: Number(level.min_effective_invites),
        min_total_reward_quota: Number(level.min_total_reward_quota),
      }))
  } catch {
    return []
  }
}

function getProgress(value: number, target: number) {
  if (target <= 0) return 100
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)))
}

function getNextLevel(stat: AffiliateUserStat, levels: AffiliateLevel[]) {
  const currentIndex = levels.findIndex((level) => level.key === stat.level_key)
  if (currentIndex >= 0) return levels[currentIndex + 1]
  return levels.find(
    (level) =>
      stat.effective_invite_count < level.min_effective_invites ||
      stat.total_reward_quota < level.min_total_reward_quota
  )
}

export function AffiliateStatsSection({ levels }: AffiliateStatsSectionProps) {
  const { t } = useTranslation()
  const [stats, setStats] = useState<AffiliateUserStat[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [levelKey, setLevelKey] = useState('all')
  const [loading, setLoading] = useState(false)
  const levelList = useMemo(() => parseLevels(levels), [levels])
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getAdminAffiliateStats({
        p: page,
        page_size: pageSize,
        keyword,
        level_key: levelKey === 'all' ? undefined : levelKey,
      })
      if (response.success && response.data) {
        setStats(response.data.items || [])
        setTotal(response.data.total || 0)
      } else {
        toast.error(response.message || t('Failed to load AFFMan stats'))
      }
    } catch (_error) {
      toast.error(t('Failed to load AFFMan stats'))
    } finally {
      setLoading(false)
    }
  }, [keyword, levelKey, page, t])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <SettingsSection title={t('AFFMan Stats')}>
      <div className='flex flex-col gap-3 sm:flex-row'>
        <div className='relative min-w-0 flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2' />
          <Input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.currentTarget.value)
              setPage(1)
            }}
            placeholder={t('Search user ID')}
            className='pl-9'
          />
        </div>
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
              {levelList.map((level) => (
                <SelectItem key={level.key} value={level.key}>
                  {level.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Table className='min-w-[960px]'>
        <TableHeader>
          <TableRow>
            <TableHead>{t('User')}</TableHead>
            <TableHead>{t('Current Level')}</TableHead>
            <TableHead className='text-right'>{t('Effective Invites')}</TableHead>
            <TableHead className='text-right'>{t('Total Commission')}</TableHead>
            <TableHead>{t('Next Level Progress')}</TableHead>
            <TableHead>{t('Level Updated')}</TableHead>
            <TableHead>{t('Updated')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((stat) => {
            const nextLevel = getNextLevel(stat, levelList)
            const inviteProgress = nextLevel
              ? getProgress(
                  stat.effective_invite_count,
                  nextLevel.min_effective_invites
                )
              : 100
            const rewardProgress = nextLevel
              ? getProgress(
                  stat.total_reward_quota,
                  nextLevel.min_total_reward_quota
                )
              : 100

            return (
              <TableRow key={stat.user_id}>
                <TableCell>{stat.user_id}</TableCell>
                <TableCell>
                  <Badge variant='secondary'>{stat.level_key}</Badge>
                </TableCell>
                <TableCell className='text-right'>
                  {stat.effective_invite_count}
                </TableCell>
                <TableCell className='text-right font-medium'>
                  {formatQuota(stat.total_reward_quota)}
                </TableCell>
                <TableCell>
                  {nextLevel ? (
                    <div className='flex min-w-48 flex-col gap-1'>
                      <div className='text-muted-foreground flex items-center justify-between text-xs'>
                        <span>{nextLevel.name}</span>
                        <span>{inviteProgress}% / {rewardProgress}%</span>
                      </div>
                      <div className='grid gap-1 sm:grid-cols-2'>
                        <Progress value={inviteProgress} />
                        <Progress value={rewardProgress} />
                      </div>
                    </div>
                  ) : (
                    <Badge variant='outline'>{t('Highest level')}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {stat.level_updated_at
                    ? formatTimestamp(stat.level_updated_at)
                    : '-'}
                </TableCell>
                <TableCell>
                  {stat.updated_at ? formatTimestamp(stat.updated_at) : '-'}
                </TableCell>
              </TableRow>
            )
          })}
          {!loading && stats.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className='text-muted-foreground h-28 text-center'
              >
                {t('No AFFMan stats found')}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

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
