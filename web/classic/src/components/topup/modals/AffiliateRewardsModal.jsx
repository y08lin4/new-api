/*
Copyright (C) 2025 QuantumNous

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

import React, { useEffect, useState } from 'react';
import { Modal, Table, Tag } from '@douyinfe/semi-ui';
import { API, showError, timestamp2string } from '../../../helpers';

const rewardTypeLabels = {
  registration_inviter: '注册邀请人奖励',
  registration_invitee: '注册被邀请人奖励',
  invitee_first_topup_bonus: '被邀请人首充多送',
  inviter_first_commission: '邀请人首充返佣',
  inviter_lifetime_commission: '邀请人长期返佣',
};

const AffiliateRewardsModal = ({ visible, onCancel, t, renderQuota }) => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (!visible) return;
    const fetchRewards = async () => {
      setLoading(true);
      try {
        const res = await API.get(
          `/api/user/self/affiliate/rewards?p=${page}&page_size=${pageSize}`,
        );
        if (res.data?.success) {
          setRecords(res.data.data?.items || []);
          setTotal(res.data.data?.total || 0);
        } else {
          showError(res.data?.message || t('加载返佣明细失败'));
        }
      } catch {
        showError(t('加载返佣明细失败'));
      } finally {
        setLoading(false);
      }
    };
    fetchRewards();
  }, [visible, page]);

  const columns = [
    {
      title: t('时间'),
      dataIndex: 'created_at',
      render: (value) => (value ? timestamp2string(value) : '-'),
    },
    {
      title: t('类型'),
      dataIndex: 'reward_type',
      render: (value) => t(rewardTypeLabels[value] || value),
    },
    {
      title: t('订单号'),
      dataIndex: 'trade_no',
      render: (value, record) => value || `#${record.source_id}`,
    },
    {
      title: t('关联用户'),
      render: (_, record) =>
        record.beneficiary_id === record.inviter_id
          ? record.invitee_id || '-'
          : record.inviter_id || '-',
    },
    {
      title: t('AFFMan等级'),
      dataIndex: 'aff_level_key',
      render: (value) => <Tag>{value || '-'}</Tag>,
    },
    {
      title: t('基数'),
      dataIndex: 'base_quota',
      render: (value) => (value > 0 ? renderQuota(value) : '-'),
    },
    {
      title: t('比例'),
      dataIndex: 'rate',
      render: (value) => (value > 0 ? `${value}%` : '-'),
    },
    {
      title: t('奖励'),
      dataIndex: 'reward_quota',
      render: (value) => renderQuota(value || 0),
    },
    {
      title: t('状态'),
      render: () => <Tag color='green'>{t('已结算')}</Tag>,
    },
  ];

  return (
    <Modal
      title={t('奖励明细')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={1000}
    >
      <Table
        rowKey='id'
        columns={columns}
        dataSource={records}
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize,
          total,
          onPageChange: setPage,
        }}
      />
    </Modal>
  );
};

export default AffiliateRewardsModal;
