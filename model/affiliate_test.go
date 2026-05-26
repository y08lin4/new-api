package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func configureAffiliateForTest(t *testing.T, levels []operation_setting.AffiliateLevel) {
	t.Helper()

	oldQuotaForInviter := common.QuotaForInviter
	oldQuotaForInvitee := common.QuotaForInvitee
	oldQuotaPerUnit := common.QuotaPerUnit
	paymentSetting := operation_setting.GetPaymentSetting()
	oldComplianceConfirmed := paymentSetting.ComplianceConfirmed
	oldComplianceTermsVersion := paymentSetting.ComplianceTermsVersion
	affiliateSetting := operation_setting.GetAffiliateSetting()
	oldAffiliateSetting := *affiliateSetting
	oldLevels := append([]operation_setting.AffiliateLevel(nil), affiliateSetting.Levels...)

	t.Cleanup(func() {
		common.QuotaForInviter = oldQuotaForInviter
		common.QuotaForInvitee = oldQuotaForInvitee
		common.QuotaPerUnit = oldQuotaPerUnit
		paymentSetting.ComplianceConfirmed = oldComplianceConfirmed
		paymentSetting.ComplianceTermsVersion = oldComplianceTermsVersion
		*affiliateSetting = oldAffiliateSetting
		affiliateSetting.Levels = oldLevels
	})

	common.QuotaPerUnit = 1000
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	affiliateSetting.Enabled = true
	affiliateSetting.RegistrationRewardEnabled = false
	affiliateSetting.SettleToAffQuota = true
	affiliateSetting.MinRewardBaseQuota = 0
	affiliateSetting.FirstCommissionWindowDays = 0
	affiliateSetting.Levels = levels
}

func defaultAffiliateTestLevels() []operation_setting.AffiliateLevel {
	return []operation_setting.AffiliateLevel{
		{
			Key:                           "level_1",
			Name:                          "AFFMan Lv.1",
			MinEffectiveInvites:           0,
			MinTotalRewardQuota:           0,
			InviteeFirstTopupBonusPercent: 10,
			InviterFirstCommissionPercent: 20,
			LifetimeCommissionEnabled:     true,
			LifetimeCommissionPercent:     1,
		},
		{
			Key:                           "level_2",
			Name:                          "AFFMan Lv.2",
			MinEffectiveInvites:           1,
			MinTotalRewardQuota:           200,
			InviteeFirstTopupBonusPercent: 15,
			InviterFirstCommissionPercent: 40,
			LifetimeCommissionEnabled:     true,
			LifetimeCommissionPercent:     5,
		},
	}
}

func insertAffiliateTestUser(t *testing.T, name string, inviterId int) User {
	t.Helper()
	user := User{
		Username:    name,
		Password:    "password",
		DisplayName: name,
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		AffCode:     fmt.Sprintf("aff_%s", name),
		InviterId:   inviterId,
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

func insertAffiliateTestTopUp(t *testing.T, userId int, tradeNo string, completeTime int64) TopUp {
	t.Helper()
	topup := TopUp{
		UserId:          userId,
		Amount:          1,
		Money:           1,
		TradeNo:         tradeNo,
		PaymentMethod:   PaymentMethodBalance,
		PaymentProvider: PaymentProviderBalance,
		CreateTime:      completeTime,
		CompleteTime:    completeTime,
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, DB.Create(&topup).Error)
	return topup
}

func TestApplyRegistrationAffiliateRewards_DefaultOffOnlyBindsCount(t *testing.T) {
	truncateTables(t)
	configureAffiliateForTest(t, defaultAffiliateTestLevels())
	common.QuotaForInviter = 300
	common.QuotaForInvitee = 100
	operation_setting.GetAffiliateSetting().RegistrationRewardEnabled = false

	inviter := insertAffiliateTestUser(t, "aff_reg_inviter_off", 0)
	invitee := insertAffiliateTestUser(t, "aff_reg_invitee_off", inviter.Id)

	require.NoError(t, ApplyRegistrationAffiliateRewards(invitee.Id, inviter.Id))

	var reloadedInviter User
	require.NoError(t, DB.First(&reloadedInviter, inviter.Id).Error)
	assert.Equal(t, 1, reloadedInviter.AffCount)
	assert.Equal(t, 0, reloadedInviter.AffQuota)
	assert.Equal(t, 0, reloadedInviter.AffHistoryQuota)

	var rewardCount int64
	require.NoError(t, DB.Model(&AffiliateReward{}).Count(&rewardCount).Error)
	assert.EqualValues(t, 0, rewardCount)
}

func TestApplyRegistrationAffiliateRewards_WhenEnabledWritesFixedRewards(t *testing.T) {
	truncateTables(t)
	configureAffiliateForTest(t, defaultAffiliateTestLevels())
	common.QuotaForInviter = 300
	common.QuotaForInvitee = 100
	operation_setting.GetAffiliateSetting().RegistrationRewardEnabled = true

	inviter := insertAffiliateTestUser(t, "aff_reg_inviter_on", 0)
	invitee := insertAffiliateTestUser(t, "aff_reg_invitee_on", inviter.Id)

	require.NoError(t, ApplyRegistrationAffiliateRewards(invitee.Id, inviter.Id))

	var reloadedInviter User
	require.NoError(t, DB.First(&reloadedInviter, inviter.Id).Error)
	var reloadedInvitee User
	require.NoError(t, DB.First(&reloadedInvitee, invitee.Id).Error)
	assert.Equal(t, 1, reloadedInviter.AffCount)
	assert.Equal(t, 300, reloadedInviter.AffQuota)
	assert.Equal(t, 300, reloadedInviter.AffHistoryQuota)
	assert.Equal(t, 100, reloadedInvitee.Quota)

	var stat AffiliateUserStat
	err := DB.First(&stat, "user_id = ?", inviter.Id).Error
	assert.Error(t, err)
}

func TestApplyAffiliateRewards_FirstTopupUpgradesForNextOrder(t *testing.T) {
	truncateTables(t)
	configureAffiliateForTest(t, defaultAffiliateTestLevels())

	inviter := insertAffiliateTestUser(t, "aff_topup_inviter", 0)
	invitee := insertAffiliateTestUser(t, "aff_topup_invitee", inviter.Id)

	firstTopup := insertAffiliateTestTopUp(t, invitee.Id, "aff_topup_first", common.GetTimestamp())
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ApplyAffiliateRewardsTx(tx, &firstTopup, 1000)
	}))

	var firstRewards []AffiliateReward
	require.NoError(t, DB.Where("source_id = ?", firstTopup.Id).Order("reward_type asc").Find(&firstRewards).Error)
	require.Len(t, firstRewards, 2)
	for _, reward := range firstRewards {
		assert.Equal(t, "level_1", reward.AffLevelKey)
	}

	var reloadedInviter User
	require.NoError(t, DB.First(&reloadedInviter, inviter.Id).Error)
	var reloadedInvitee User
	require.NoError(t, DB.First(&reloadedInvitee, invitee.Id).Error)
	assert.Equal(t, 200, reloadedInviter.AffQuota)
	assert.Equal(t, 200, reloadedInviter.AffHistoryQuota)
	assert.Equal(t, 100, reloadedInvitee.Quota)

	stat, err := GetAffiliateUserStat(inviter.Id)
	require.NoError(t, err)
	assert.Equal(t, "level_2", stat.LevelKey)
	assert.Equal(t, 1, stat.EffectiveInviteCount)
	assert.Equal(t, 200, stat.TotalRewardQuota)

	secondTopup := insertAffiliateTestTopUp(t, invitee.Id, "aff_topup_second", common.GetTimestamp()+10)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ApplyAffiliateRewardsTx(tx, &secondTopup, 1000)
	}))

	var lifetimeReward AffiliateReward
	require.NoError(t, DB.Where("source_id = ? AND reward_type = ?", secondTopup.Id, AffiliateRewardInviterLifetime).First(&lifetimeReward).Error)
	assert.Equal(t, "level_2", lifetimeReward.AffLevelKey)
	assert.Equal(t, 5.0, lifetimeReward.Rate)
	assert.Equal(t, 50, lifetimeReward.RewardQuota)
}

func TestApplyAffiliateRewards_IsIdempotentForSameTopup(t *testing.T) {
	truncateTables(t)
	configureAffiliateForTest(t, defaultAffiliateTestLevels())

	inviter := insertAffiliateTestUser(t, "aff_idem_inviter", 0)
	invitee := insertAffiliateTestUser(t, "aff_idem_invitee", inviter.Id)
	topup := insertAffiliateTestTopUp(t, invitee.Id, "aff_topup_idem", common.GetTimestamp())

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ApplyAffiliateRewardsTx(tx, &topup, 1000)
	}))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ApplyAffiliateRewardsTx(tx, &topup, 1000)
	}))

	var rewardCount int64
	require.NoError(t, DB.Model(&AffiliateReward{}).Where("source_id = ?", topup.Id).Count(&rewardCount).Error)
	assert.EqualValues(t, 2, rewardCount)

	var reloadedInviter User
	require.NoError(t, DB.First(&reloadedInviter, inviter.Id).Error)
	var reloadedInvitee User
	require.NoError(t, DB.First(&reloadedInvitee, invitee.Id).Error)
	assert.Equal(t, 200, reloadedInviter.AffQuota)
	assert.Equal(t, 200, reloadedInviter.AffHistoryQuota)
	assert.Equal(t, 100, reloadedInvitee.Quota)
}
