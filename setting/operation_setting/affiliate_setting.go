package operation_setting

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type AffiliateLevel struct {
	Key                           string  `json:"key"`
	Name                          string  `json:"name"`
	MinEffectiveInvites           int     `json:"min_effective_invites"`
	MinTotalRewardQuota           int     `json:"min_total_reward_quota"`
	InviteeFirstTopupBonusPercent float64 `json:"invitee_first_topup_bonus_percent"`
	InviterFirstCommissionPercent float64 `json:"inviter_first_commission_percent"`
	LifetimeCommissionEnabled     bool    `json:"lifetime_commission_enabled"`
	LifetimeCommissionPercent     float64 `json:"lifetime_commission_percent"`
}

type AffiliateSetting struct {
	Enabled                   bool             `json:"enabled"`
	RegistrationRewardEnabled bool             `json:"registration_reward_enabled"`
	SettleToAffQuota          bool             `json:"settle_to_aff_quota"`
	MinRewardBaseQuota        int              `json:"min_reward_base_quota"`
	FirstCommissionWindowDays int              `json:"first_commission_window_days"`
	Levels                    []AffiliateLevel `json:"levels"`
}

var defaultAffiliateLevels = []AffiliateLevel{
	{
		Key:                           "level_1",
		Name:                          "AFFMan Lv.1",
		MinEffectiveInvites:           0,
		MinTotalRewardQuota:           0,
		InviteeFirstTopupBonusPercent: 0,
		InviterFirstCommissionPercent: 0,
		LifetimeCommissionEnabled:     false,
		LifetimeCommissionPercent:     0,
	},
}

var affiliateSetting = AffiliateSetting{
	Enabled:                   false,
	RegistrationRewardEnabled: false,
	SettleToAffQuota:          true,
	MinRewardBaseQuota:        0,
	FirstCommissionWindowDays: 0,
	Levels:                    append([]AffiliateLevel(nil), defaultAffiliateLevels...),
}

func init() {
	config.GlobalConfig.Register("affiliate_setting", &affiliateSetting)
}

func GetAffiliateSetting() *AffiliateSetting {
	if len(affiliateSetting.Levels) == 0 {
		affiliateSetting.Levels = append([]AffiliateLevel(nil), defaultAffiliateLevels...)
	}
	return &affiliateSetting
}

func GetAffiliateLevels() []AffiliateLevel {
	levels := GetAffiliateSetting().Levels
	cp := make([]AffiliateLevel, len(levels))
	copy(cp, levels)
	return cp
}

func GetAffiliateDefaultLevel() AffiliateLevel {
	levels := GetAffiliateLevels()
	if len(levels) == 0 {
		return defaultAffiliateLevels[0]
	}
	return levels[0]
}

func GetAffiliateLevelByKey(key string) AffiliateLevel {
	levels := GetAffiliateLevels()
	for _, level := range levels {
		if level.Key == key {
			return level
		}
	}
	if len(levels) == 0 {
		return defaultAffiliateLevels[0]
	}
	return levels[0]
}

func GetAffiliateLevelIndex(key string) int {
	levels := GetAffiliateLevels()
	for i, level := range levels {
		if level.Key == key {
			return i
		}
	}
	return 0
}

func ResolveAffiliateLevel(effectiveInvites int, totalRewardQuota int) AffiliateLevel {
	levels := GetAffiliateLevels()
	if len(levels) == 0 {
		return defaultAffiliateLevels[0]
	}
	resolved := levels[0]
	for _, level := range levels {
		if effectiveInvites >= level.MinEffectiveInvites && totalRewardQuota >= level.MinTotalRewardQuota {
			resolved = level
		}
	}
	return resolved
}

func GetNextAffiliateLevel(levelKey string) *AffiliateLevel {
	levels := GetAffiliateLevels()
	for i, level := range levels {
		if level.Key == levelKey && i+1 < len(levels) {
			next := levels[i+1]
			return &next
		}
	}
	return nil
}

func CheckAffiliateLevelsJSON(jsonStr string) error {
	var levels []AffiliateLevel
	if err := common.UnmarshalJsonStr(jsonStr, &levels); err != nil {
		return err
	}
	return ValidateAffiliateLevels(levels)
}

func ValidateAffiliateLevels(levels []AffiliateLevel) error {
	if len(levels) == 0 {
		return errors.New("affiliate levels cannot be empty")
	}
	seen := make(map[string]struct{}, len(levels))
	prevInvites := -1
	prevQuota := -1
	for i, level := range levels {
		key := strings.TrimSpace(level.Key)
		if key == "" {
			return fmt.Errorf("affiliate level %d key cannot be empty", i+1)
		}
		if _, ok := seen[key]; ok {
			return fmt.Errorf("affiliate level key duplicated: %s", key)
		}
		seen[key] = struct{}{}
		if strings.TrimSpace(level.Name) == "" {
			return fmt.Errorf("affiliate level %s name cannot be empty", key)
		}
		if level.MinEffectiveInvites < 0 || level.MinTotalRewardQuota < 0 {
			return fmt.Errorf("affiliate level %s thresholds cannot be negative", key)
		}
		if level.InviteeFirstTopupBonusPercent < 0 ||
			level.InviterFirstCommissionPercent < 0 ||
			level.LifetimeCommissionPercent < 0 {
			return fmt.Errorf("affiliate level %s percentages cannot be negative", key)
		}
		if i > 0 && level.MinEffectiveInvites < prevInvites {
			return fmt.Errorf("affiliate level %s min_effective_invites must be sorted ascending", key)
		}
		if i > 0 && level.MinTotalRewardQuota < prevQuota {
			return fmt.Errorf("affiliate level %s min_total_reward_quota must be sorted ascending", key)
		}
		prevInvites = level.MinEffectiveInvites
		prevQuota = level.MinTotalRewardQuota
	}
	return nil
}
