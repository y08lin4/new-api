# AFF 充值返佣差异说明

本文只记录本仓库相对上游 `QuantumNous/new-api` 的 AFF 系统差异，用于后续从上游同步代码时快速确认需要保留和重放的本地改动。

## 仓库关系

- 上游仓库：`https://github.com/QuantumNous/new-api`
- 本仓库：`https://github.com/y08lin4/new-api`
- 功能分支：`feature/aff-recharge-affman`
- 同步原则：同步上游时尽量保持上游结构，只在 AFF、充值结算、系统设置、钱包邀请卡、管理端返佣视图和相关测试中保留本仓库差异。

## 行为差异

上游 AFF 以“邀请注册即奖励”为主。本仓库改为“注册绑定邀请关系，充值成功后结算返佣”为主，同时保留注册固定奖励能力。

- 注册固定奖励保留 `QuotaForInviter`、`QuotaForInvitee`，但新增 `affiliate_setting.registration_reward_enabled` 独立开关，默认关闭。
- 充值成功后才触发首充多送、邀请人首充返佣、邀请人长期返佣。
- 充值返佣比例由邀请人当前 AFFMan 等级决定。
- AFFMan 等级按“有效邀请人数 + 已获得充值返佣额度”双门槛自动升级，只升不降。
- 当前订单使用结算前的邀请人等级；本次奖励入账后再刷新统计，升级只影响后续订单。
- 返佣基数只使用本次实际付费充值到账额度，不包含首充多送、返佣额度或其他赠送额度。

## 后端差异

- `setting/operation_setting/affiliate_setting.go`
  - 新增 `affiliate_setting` 配置结构。
  - 配置项包含 `enabled`、`registration_reward_enabled`、`settle_to_aff_quota`、`min_reward_base_quota`、`first_commission_window_days`、`levels`。
  - `levels` 是 JSON 数组，按门槛升序配置 AFFMan 等级和比例。

- `model/affiliate.go`
  - 新增 `AffiliateReward` 流水模型。
  - 新增 `AffiliateUserStat` 统计模型。
  - 新增 `ApplyRegistrationAffiliateRewards`、`ApplyAffiliateRewardsTx`、`GetAffiliatePolicyForUser`、列表查询和统计刷新逻辑。
  - 通过唯一索引保证重复 webhook 或重复补单不会重复发奖。

- `model/main.go`
  - 自动迁移 `AffiliateReward`、`AffiliateUserStat`。

- `model/user.go`
  - 注册奖励改为受 `registration_reward_enabled` 控制。
  - 用户列表模型补充非持久化字段 `aff_level_key`，管理端用户表可显示当前 AFFMan 等级。

- `model/topup.go`
  - Stripe、Epay、Creem、Waffo、Waffo Pancake、管理员补单等充值成功路径在同一事务中调用 `ApplyAffiliateRewardsTx`。
  - Epay 回调抽到模型层 `RechargeEpay`，便于统一幂等和返佣结算。

- `controller/affiliate.go`、`router/api-router.go`
  - 新增用户接口：
    - `GET /api/user/self/affiliate/rewards`
    - `GET /api/user/self/affiliate/stats`
  - 新增管理员接口：
    - `GET /api/affiliate/rewards`
    - `GET /api/affiliate/stats`

- `controller/topup.go`
  - `GET /api/user/topup/info` 返回 `affiliate_policy`，供钱包邀请卡展示当前等级、比例和升级进度。

- `controller/option.go`
  - 保存 `affiliate_setting.levels` 时校验 JSON、等级 key 唯一、门槛和比例非负、等级按门槛升序。

## 前端差异

- `web/default/src/features/wallet/*`
  - 钱包邀请卡显示 AFFMan 等级、当前首充返佣、长期返佣、被邀请人首充多送比例和下一等级进度。
  - 新增“奖励明细”弹窗，展示时间、类型、订单、关联用户、等级、基数、比例、奖励额度和状态。

- `web/default/src/features/system-settings/billing/*`
  - Billing 设置新增 `Affiliate Rewards` 分区。
  - 支持总开关、注册奖励开关、结算到邀请余额开关、最低返佣充值额度、首充窗口和 AFFMan 等级编辑器。
  - 新增管理端返佣流水表，支持奖励类型、等级和订单/用户搜索。
  - 新增管理端 AFFMan 统计表，显示当前等级、有效邀请数、累计返佣和下一等级进度。

- `web/default/src/features/users/*`
  - 用户表邀请信息列补充 AFFMan 等级徽标。

- `web/default/src/i18n/locales/*`
  - 新增 AFF 充值返佣和 AFFMan 管理相关文案，覆盖 `en`、`zh`、`fr`、`ja`、`ru`、`vi`。

- `web/classic/src/components/topup/*`
  - classic 钱包邀请卡显示 AFFMan 等级和升级进度。
  - 新增奖励明细弹窗，使用 Semi UI `Modal`、`Table`、`Tag`。

- `web/classic/src/pages/Setting/Operation/SettingsCreditLimit.jsx`
  - 旧版额度设置页新增 AFF 充值返佣配置。
  - `affiliate_setting.levels` 在 classic 端使用 JSON 文本方式维护。

- `web/classic/src/components/table/users/UsersColumnDefs.jsx`
  - classic 用户表邀请信息列显示 AFFMan 等级。

## 同步上游时重点检查

每次从 `QuantumNous/new-api` 同步后，重点检查这些文件是否发生冲突或上游逻辑迁移：

- `model/user.go`
- `model/topup.go`
- `model/main.go`
- `model/affiliate.go`
- `controller/topup.go`
- `controller/option.go`
- `controller/affiliate.go`
- `router/api-router.go`
- `setting/operation_setting/affiliate_setting.go`
- `web/default/src/features/wallet/*`
- `web/default/src/features/system-settings/billing/*`
- `web/default/src/features/users/*`
- `web/classic/src/components/topup/*`
- `web/classic/src/pages/Setting/Operation/SettingsCreditLimit.jsx`
- `web/classic/src/components/table/users/UsersColumnDefs.jsx`

同步后的最小验证顺序：

1. 注册奖励默认关闭时，注册只绑定邀请关系，不发固定奖励。
2. 打开注册奖励后，固定注册奖励正常发放并写流水，但不影响 AFFMan 统计。
3. 首充成功按邀请人当前等级结算被邀请人多送和邀请人返佣。
4. 当前订单触发升级后，下一笔订单才使用新等级。
5. 重复 webhook 或重复补单不会重复发奖。
6. default/classic 钱包邀请卡、奖励明细、管理端返佣流水和 AFFMan 统计能正常加载。
