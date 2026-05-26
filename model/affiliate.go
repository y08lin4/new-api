package model

import (
	"errors"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	AffiliateSourceRegistration = "registration"
	AffiliateSourceTopup        = "topup"

	AffiliateRewardRegistrationInviter     = "registration_inviter"
	AffiliateRewardRegistrationInvitee     = "registration_invitee"
	AffiliateRewardInviteeFirstTopupBonus  = "invitee_first_topup_bonus"
	AffiliateRewardInviterFirstCommission  = "inviter_first_commission"
	AffiliateRewardInviterLifetime         = "inviter_lifetime_commission"
)

var inviterRewardTypes = []string{
	AffiliateRewardInviterFirstCommission,
	AffiliateRewardInviterLifetime,
}

type AffiliateReward struct {
	Id            int     `json:"id"`
	SourceType    string  `json:"source_type" gorm:"type:varchar(32);not null;uniqueIndex:idx_affiliate_reward_once,priority:1"`
	SourceId      int     `json:"source_id" gorm:"not null;uniqueIndex:idx_affiliate_reward_once,priority:2"`
	RewardType    string  `json:"reward_type" gorm:"type:varchar(64);not null;index;uniqueIndex:idx_affiliate_reward_once,priority:3"`
	InviterId     int     `json:"inviter_id" gorm:"index"`
	InviteeId     int     `json:"invitee_id" gorm:"index"`
	BeneficiaryId int     `json:"beneficiary_id" gorm:"index;uniqueIndex:idx_affiliate_reward_once,priority:4"`
	TradeNo       string  `json:"trade_no" gorm:"type:varchar(255);index"`
	BaseQuota     int     `json:"base_quota"`
	Rate          float64 `json:"rate"`
	RewardQuota   int     `json:"reward_quota"`
	AffLevelKey   string  `json:"aff_level_key" gorm:"type:varchar(64);index"`
	CreatedAt     int64   `json:"created_at" gorm:"autoCreateTime;column:created_at"`
}

type AffiliateUserStat struct {
	UserId               int    `json:"user_id" gorm:"primaryKey"`
	LevelKey             string `json:"level_key" gorm:"type:varchar(64);index"`
	EffectiveInviteCount int    `json:"effective_invite_count"`
	TotalRewardQuota     int    `json:"total_reward_quota"`
	LevelUpdatedAt        int64  `json:"level_updated_at"`
	UpdatedAt             int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

type AffiliateRewardFilters struct {
	Keyword       string
	RewardType    string
	LevelKey      string
	BeneficiaryId int
	InviterId     int
	InviteeId     int
	TradeNo       string
}

type AffiliateStatFilters struct {
	Keyword  string
	LevelKey string
}

type AffiliatePolicy struct {
	Enabled                   bool                              `json:"enabled"`
	RegistrationRewardEnabled bool                              `json:"registration_reward_enabled"`
	CurrentLevel              operation_setting.AffiliateLevel  `json:"current_level"`
	NextLevel                 *operation_setting.AffiliateLevel `json:"next_level,omitempty"`
	EffectiveInviteCount      int                               `json:"effective_invite_count"`
	TotalRewardQuota          int                               `json:"total_reward_quota"`
	InviteProgress            float64                           `json:"invite_progress"`
	RewardProgress            float64                           `json:"reward_progress"`
	FirstCommissionWindowDays int                               `json:"first_commission_window_days"`
}

func ApplyRegistrationAffiliateRewards(userId int, inviterId int) error {
	if inviterId == 0 || inviterId == userId || !operation_setting.IsPaymentComplianceConfirmed() {
		return nil
	}
	setting := operation_setting.GetAffiliateSetting()
	return DB.Transaction(func(tx *gorm.DB) error {
		var inviter User
		if err := tx.Where("id = ? AND status = ?", inviterId, common.UserStatusEnabled).First(&inviter).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", inviterId).Update("aff_count", gorm.Expr("aff_count + ?", 1)).Error; err != nil {
			return err
		}
		if !setting.RegistrationRewardEnabled {
			return nil
		}
		if common.QuotaForInvitee > 0 {
			if err := createAffiliateRewardTx(tx, AffiliateReward{
				SourceType:    AffiliateSourceRegistration,
				SourceId:      userId,
				RewardType:    AffiliateRewardRegistrationInvitee,
				InviterId:     inviterId,
				InviteeId:     userId,
				BeneficiaryId: userId,
				RewardQuota:   common.QuotaForInvitee,
			}); err != nil {
				return err
			}
		}
		if common.QuotaForInviter > 0 {
			if err := createAffiliateRewardTx(tx, AffiliateReward{
				SourceType:    AffiliateSourceRegistration,
				SourceId:      userId,
				RewardType:    AffiliateRewardRegistrationInviter,
				InviterId:     inviterId,
				InviteeId:     userId,
				BeneficiaryId: inviterId,
				RewardQuota:   common.QuotaForInviter,
			}); err != nil {
				return err
			}
		}
		return nil
	})
}

func ApplyAffiliateRewardsTx(tx *gorm.DB, topUp *TopUp, baseQuota int) error {
	setting := operation_setting.GetAffiliateSetting()
	if !setting.Enabled || topUp == nil || baseQuota <= 0 || baseQuota < setting.MinRewardBaseQuota {
		return nil
	}
	var invitee User
	if err := tx.Select("id", "inviter_id", "created_at").Where("id = ?", topUp.UserId).First(&invitee).Error; err != nil {
		return err
	}
	if invitee.InviterId == 0 || invitee.InviterId == invitee.Id {
		return nil
	}
	var inviter User
	if err := tx.Select("id", "status").Where("id = ? AND status = ?", invitee.InviterId, common.UserStatusEnabled).First(&inviter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	stat, err := getOrCreateAffiliateUserStatTx(tx, inviter.Id)
	if err != nil {
		return err
	}
	level := operation_setting.GetAffiliateLevelByKey(stat.LevelKey)
	firstTopup, err := isFirstSuccessfulTopupTx(tx, topUp)
	if err != nil {
		return err
	}
	if firstTopup && level.InviteeFirstTopupBonusPercent > 0 {
		quota := quotaFromPercent(baseQuota, level.InviteeFirstTopupBonusPercent)
		if quota > 0 {
			if err := createAffiliateRewardTx(tx, AffiliateReward{
				SourceType:    AffiliateSourceTopup,
				SourceId:      topUp.Id,
				RewardType:    AffiliateRewardInviteeFirstTopupBonus,
				InviterId:     inviter.Id,
				InviteeId:     invitee.Id,
				BeneficiaryId: invitee.Id,
				TradeNo:       topUp.TradeNo,
				BaseQuota:     baseQuota,
				Rate:          level.InviteeFirstTopupBonusPercent,
				RewardQuota:   quota,
				AffLevelKey:   level.Key,
			}); err != nil {
				return err
			}
		}
	}
	rewardType := ""
	rate := 0.0
	if firstTopup || isWithinAffiliateFirstWindow(invitee.CreatedAt, topUp.CompleteTime, setting.FirstCommissionWindowDays) {
		rewardType = AffiliateRewardInviterFirstCommission
		rate = level.InviterFirstCommissionPercent
	} else if level.LifetimeCommissionEnabled {
		rewardType = AffiliateRewardInviterLifetime
		rate = level.LifetimeCommissionPercent
	}
	rewardQuota := quotaFromPercent(baseQuota, rate)
	if rewardType == "" || rewardQuota <= 0 {
		return nil
	}
	if err := createAffiliateRewardTx(tx, AffiliateReward{
		SourceType:    AffiliateSourceTopup,
		SourceId:      topUp.Id,
		RewardType:    rewardType,
		InviterId:     inviter.Id,
		InviteeId:     invitee.Id,
		BeneficiaryId: inviter.Id,
		TradeNo:       topUp.TradeNo,
		BaseQuota:     baseQuota,
		Rate:          rate,
		RewardQuota:   rewardQuota,
		AffLevelKey:   level.Key,
	}); err != nil {
		return err
	}
	return refreshAffiliateUserStatTx(tx, inviter.Id)
}

func GetAffiliatePolicyForUser(userId int) (*AffiliatePolicy, error) {
	setting := operation_setting.GetAffiliateSetting()
	stat, err := GetAffiliateUserStat(userId)
	if err != nil {
		return nil, err
	}
	current := operation_setting.GetAffiliateLevelByKey(stat.LevelKey)
	next := operation_setting.GetNextAffiliateLevel(current.Key)
	policy := &AffiliatePolicy{
		Enabled:                   setting.Enabled,
		RegistrationRewardEnabled: setting.RegistrationRewardEnabled,
		CurrentLevel:              current,
		NextLevel:                 next,
		EffectiveInviteCount:      stat.EffectiveInviteCount,
		TotalRewardQuota:          stat.TotalRewardQuota,
		FirstCommissionWindowDays: setting.FirstCommissionWindowDays,
	}
	if next != nil {
		if next.MinEffectiveInvites <= 0 {
			policy.InviteProgress = 1
		} else {
			policy.InviteProgress = clampProgress(float64(stat.EffectiveInviteCount) / float64(next.MinEffectiveInvites))
		}
		if next.MinTotalRewardQuota <= 0 {
			policy.RewardProgress = 1
		} else {
			policy.RewardProgress = clampProgress(float64(stat.TotalRewardQuota) / float64(next.MinTotalRewardQuota))
		}
	} else {
		policy.InviteProgress = 1
		policy.RewardProgress = 1
	}
	return policy, nil
}

func GetAffiliateUserStat(userId int) (*AffiliateUserStat, error) {
	return getOrCreateAffiliateUserStatTx(DB, userId)
}

func ListAffiliateRewards(pageInfo *common.PageInfo, filters AffiliateRewardFilters, currentUserId int) ([]*AffiliateReward, int64, error) {
	query := DB.Model(&AffiliateReward{})
	if currentUserId > 0 {
		query = query.Where("beneficiary_id = ?", currentUserId)
	}
	query = applyAffiliateRewardFilters(query, filters)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rewards []*AffiliateReward
	err := query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&rewards).Error
	return rewards, total, err
}

func ListAffiliateStats(pageInfo *common.PageInfo, filters AffiliateStatFilters) ([]*AffiliateUserStat, int64, error) {
	query := DB.Model(&AffiliateUserStat{})
	if filters.LevelKey != "" {
		query = query.Where("level_key = ?", filters.LevelKey)
	}
	if filters.Keyword != "" {
		keyword := strings.TrimSpace(filters.Keyword)
		if userId, err := strconv.Atoi(keyword); err == nil && userId > 0 {
			query = query.Where("user_id = ?", userId)
		}
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var stats []*AffiliateUserStat
	err := query.Order("total_reward_quota desc, effective_invite_count desc, user_id asc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&stats).Error
	return stats, total, err
}

func createAffiliateRewardTx(tx *gorm.DB, reward AffiliateReward) error {
	if reward.RewardQuota <= 0 {
		return nil
	}
	result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&reward)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return nil
	}
	switch reward.RewardType {
	case AffiliateRewardRegistrationInvitee, AffiliateRewardInviteeFirstTopupBonus:
		return tx.Model(&User{}).Where("id = ?", reward.BeneficiaryId).Update("quota", gorm.Expr("quota + ?", reward.RewardQuota)).Error
	case AffiliateRewardRegistrationInviter, AffiliateRewardInviterFirstCommission, AffiliateRewardInviterLifetime:
		setting := operation_setting.GetAffiliateSetting()
		updates := map[string]interface{}{
			"aff_history": gorm.Expr("aff_history + ?", reward.RewardQuota),
		}
		if setting.SettleToAffQuota {
			updates["aff_quota"] = gorm.Expr("aff_quota + ?", reward.RewardQuota)
		} else {
			updates["quota"] = gorm.Expr("quota + ?", reward.RewardQuota)
		}
		return tx.Model(&User{}).Where("id = ?", reward.BeneficiaryId).Updates(updates).Error
	default:
		return nil
	}
}

func getOrCreateAffiliateUserStatTx(tx *gorm.DB, userId int) (*AffiliateUserStat, error) {
	defaultLevel := operation_setting.GetAffiliateDefaultLevel()
	stat := &AffiliateUserStat{}
	err := tx.Where("user_id = ?", userId).First(stat).Error
	if err == nil {
		if stat.LevelKey == "" {
			stat.LevelKey = defaultLevel.Key
			stat.LevelUpdatedAt = common.GetTimestamp()
			if saveErr := tx.Save(stat).Error; saveErr != nil {
				return nil, saveErr
			}
		}
		return stat, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	stat = &AffiliateUserStat{
		UserId:        userId,
		LevelKey:      defaultLevel.Key,
		LevelUpdatedAt: common.GetTimestamp(),
	}
	if err := tx.Create(stat).Error; err != nil {
		return nil, err
	}
	return stat, nil
}

func refreshAffiliateUserStatTx(tx *gorm.DB, userId int) error {
	stat, err := getOrCreateAffiliateUserStatTx(tx, userId)
	if err != nil {
		return err
	}
	var effectiveInviteCount int64
	if err := tx.Model(&AffiliateReward{}).
		Where("beneficiary_id = ? AND reward_type IN ? AND reward_quota > 0", userId, inviterRewardTypes).
		Distinct("invitee_id").
		Count(&effectiveInviteCount).Error; err != nil {
		return err
	}
	var totalRewardQuota int
	if err := tx.Model(&AffiliateReward{}).
		Where("beneficiary_id = ? AND reward_type IN ?", userId, inviterRewardTypes).
		Select("COALESCE(SUM(reward_quota), 0)").
		Scan(&totalRewardQuota).Error; err != nil {
		return err
	}
	nextLevel := operation_setting.ResolveAffiliateLevel(int(effectiveInviteCount), totalRewardQuota)
	currentIndex := operation_setting.GetAffiliateLevelIndex(stat.LevelKey)
	nextIndex := operation_setting.GetAffiliateLevelIndex(nextLevel.Key)
	updates := map[string]interface{}{
		"effective_invite_count": int(effectiveInviteCount),
		"total_reward_quota":     totalRewardQuota,
	}
	if nextIndex > currentIndex {
		updates["level_key"] = nextLevel.Key
		updates["level_updated_at"] = common.GetTimestamp()
	}
	return tx.Model(&AffiliateUserStat{}).Where("user_id = ?", userId).Updates(updates).Error
}

func isFirstSuccessfulTopupTx(tx *gorm.DB, topUp *TopUp) (bool, error) {
	var count int64
	err := tx.Model(&TopUp{}).
		Where("user_id = ? AND status = ? AND id <> ?", topUp.UserId, common.TopUpStatusSuccess, topUp.Id).
		Count(&count).Error
	return count == 0, err
}

func isWithinAffiliateFirstWindow(userCreatedAt int64, completeTime int64, days int) bool {
	if days <= 0 || userCreatedAt <= 0 || completeTime <= 0 {
		return false
	}
	return completeTime <= userCreatedAt+int64(days)*24*60*60
}

func quotaFromPercent(baseQuota int, percent float64) int {
	if baseQuota <= 0 || percent <= 0 {
		return 0
	}
	return int(decimal.NewFromInt(int64(baseQuota)).
		Mul(decimal.NewFromFloat(percent)).
		Div(decimal.NewFromInt(100)).
		IntPart())
}

func clampProgress(value float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}

func applyAffiliateRewardFilters(query *gorm.DB, filters AffiliateRewardFilters) *gorm.DB {
	if filters.RewardType != "" {
		query = query.Where("reward_type = ?", filters.RewardType)
	}
	if filters.LevelKey != "" {
		query = query.Where("aff_level_key = ?", filters.LevelKey)
	}
	if filters.BeneficiaryId > 0 {
		query = query.Where("beneficiary_id = ?", filters.BeneficiaryId)
	}
	if filters.InviterId > 0 {
		query = query.Where("inviter_id = ?", filters.InviterId)
	}
	if filters.InviteeId > 0 {
		query = query.Where("invitee_id = ?", filters.InviteeId)
	}
	if filters.TradeNo != "" {
		query = query.Where("trade_no = ?", filters.TradeNo)
	}
	if filters.Keyword != "" {
		keyword := strings.TrimSpace(filters.Keyword)
		keywordQuery := DB.Where("trade_no LIKE ?", "%"+keyword+"%")
		if userId, err := strconv.Atoi(keyword); err == nil && userId > 0 {
			keywordQuery = keywordQuery.Or("inviter_id = ? OR invitee_id = ? OR beneficiary_id = ?", userId, userId, userId)
		}
		query = query.Where(keywordQuery)
	}
	return query
}
