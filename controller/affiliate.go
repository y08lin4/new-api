package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func parseQueryInt(c *gin.Context, key string) int {
	value := c.Query(key)
	if value == "" {
		return 0
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 0 {
		return 0
	}
	return parsed
}

func buildAffiliateRewardFilters(c *gin.Context) model.AffiliateRewardFilters {
	return model.AffiliateRewardFilters{
		Keyword:       c.Query("keyword"),
		RewardType:    c.Query("reward_type"),
		LevelKey:      c.Query("level_key"),
		BeneficiaryId: parseQueryInt(c, "beneficiary_id"),
		InviterId:     parseQueryInt(c, "inviter_id"),
		InviteeId:     parseQueryInt(c, "invitee_id"),
		TradeNo:       c.Query("trade_no"),
	}
}

func GetSelfAffiliateRewards(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	rewards, total, err := model.ListAffiliateRewards(pageInfo, buildAffiliateRewardFilters(c), c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(rewards)
	common.ApiSuccess(c, pageInfo)
}

func GetSelfAffiliateStats(c *gin.Context) {
	userId := c.GetInt("id")
	stat, err := model.GetAffiliateUserStat(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	policy, err := model.GetAffiliatePolicyForUser(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"stat":   stat,
		"policy": policy,
	})
}

func GetAffiliateRewards(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	rewards, total, err := model.ListAffiliateRewards(pageInfo, buildAffiliateRewardFilters(c), 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(rewards)
	common.ApiSuccess(c, pageInfo)
}

func GetAffiliateStats(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	stats, total, err := model.ListAffiliateStats(pageInfo, model.AffiliateStatFilters{
		Keyword:  c.Query("keyword"),
		LevelKey: c.Query("level_key"),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(stats)
	common.ApiSuccess(c, pageInfo)
}
