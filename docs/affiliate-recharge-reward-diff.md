# AFF 充值返佣系统差异说明

本文用于记录本仓库相对原仓库的 AFF 系统差异。后续从原仓库同步代码时，优先按本文检查需要保留、合并或重新套用的本地改动。

## 仓库信息

- 原仓库：`https://github.com/QuantumNous/new-api`
- 本仓库：`https://github.com/y08lin4/new-api`
- 功能分支：`feature/aff-recharge-affman`
- 当前分支基线：本地 `main` 分支的 `5bc4c74`
- 改动范围：后端返佣结算、AFFMan 等级、配置校验、接口、默认前端、经典前端、多语言、测试和同步文档。

## 原仓库 AFF 行为

原仓库的 AFF 逻辑以“邀请注册即奖励”为主。

1. 新用户注册时可以携带邀请码。
2. 后端根据邀请码找到邀请人，并把邀请人编号写入新用户的 `inviter_id`。
3. 注册完成后，如果支付合规声明已经确认：
   - 被邀请人获得固定额度 `QuotaForInvitee`。
   - 邀请人获得固定额度 `QuotaForInviter`。
   - 邀请人的奖励进入 `aff_quota`，之后可由用户手动转入主余额。
4. 用户表中的 `aff_count`、`aff_quota`、`aff_history` 用于保存邀请人数、待转入邀请奖励和历史邀请收益。
5. 用户钱包页展示邀请链接、邀请收益、邀请人数和“转入余额”入口。
6. 管理端主要通过旧的额度设置项维护注册邀请奖励额度。

原仓库没有以下能力：

- 不按充值成功事件结算邀请返佣。
- 没有首充多送。
- 没有首充高返窗口。
- 没有长期返佣。
- 没有 AFFMan 等级体系。
- 没有返佣流水表。
- 没有按充值返佣统计有效邀请人数。
- 没有管理员返佣流水和 AFFMan 统计视图。

## 本仓库总体差异

本仓库把 AFF 的主模式改为“注册绑定邀请关系，充值成功后结算返佣”，同时保留“注册即奖励”能力，但默认关闭。

| 范围 | 原仓库 | 本仓库 |
| --- | --- | --- |
| 注册行为 | 注册后立即发固定邀请奖励 | 注册时只绑定邀请关系；固定奖励由独立开关控制，默认关闭 |
| 返佣触发 | 注册事件 | 充值成功事件 |
| 被邀请人奖励 | 固定注册奖励 | 可配置首充多送比例 |
| 邀请人奖励 | 固定注册奖励 | 可配置首充返佣、窗口期高返、长期返佣 |
| 返佣比例 | 固定额度 | 按邀请人当前 AFFMan 等级决定 |
| 等级体系 | 无 | 按有效邀请人数和累计充值返佣额度自动升级 |
| 流水记录 | 无独立返佣流水 | 新增 `affiliate_rewards` 返佣流水表 |
| 用户统计 | 依赖用户表邀请字段 | 新增 `affiliate_user_stats` 统计表 |
| 幂等处理 | 依赖充值订单状态 | 返佣流水唯一约束防止重复发奖 |
| 管理视图 | 无返佣流水和等级统计 | 新增返佣流水、AFFMan 统计和等级配置界面 |

## 业务规则差异

### 注册奖励

- 保留原来的 `QuotaForInviter` 和 `QuotaForInvitee`。
- 新增 `affiliate_setting.registration_reward_enabled` 控制注册固定奖励。
- 默认值为关闭。
- 关闭时，注册只写入邀请关系，不发固定奖励。
- 开启时，沿用原来的固定奖励额度，并写入返佣流水。
- 注册固定奖励不参与 AFFMan 等级统计。
- 注册固定奖励不受 AFFMan 等级比例影响。

### 充值返佣

- 充值成功后才会进入返佣结算。
- 返佣结算必须在充值订单从待支付变为成功的同一个事务中执行。
- 邀请关系来自被邀请用户的 `inviter_id`。
- 如果没有邀请人、邀请人不存在、邀请人被禁用、邀请人等于被邀请人本人，则跳过返佣。
- 返佣基数只使用本次实际付费充值到账额度。
- 返佣基数不包含首充多送额度、邀请人返佣额度或其他赠送额度。
- 同一订单重复回调或重复补单不会重复发放返佣。

### 首充多送

- 只发给被邀请人。
- 只在被邀请人第一笔成功充值时触发。
- 比例来自邀请人当前 AFFMan 等级的 `invitee_first_topup_bonus_percent`。
- 奖励直接进入被邀请人的主余额。
- 不计入邀请人的累计返佣额度。

### 邀请人首充返佣

- 发给邀请人。
- 被邀请人的第一笔成功充值一定使用首充返佣比例。
- 如果配置了 `first_commission_window_days`，被邀请人注册后窗口期内的充值也使用首充返佣比例。
- 比例来自邀请人当前 AFFMan 等级的 `inviter_first_commission_percent`。
- 奖励可以进入邀请余额，也可以直接进入主余额，由 `affiliate_setting.settle_to_aff_quota` 控制。

### 邀请人长期返佣

- 超出首充或首充窗口后，如果当前等级开启长期返佣，则继续按长期比例返佣。
- 开关来自当前 AFFMan 等级的 `lifetime_commission_enabled`。
- 比例来自当前 AFFMan 等级的 `lifetime_commission_percent`。
- 长期返佣关闭时，窗口期外充值不再给邀请人返佣。

## AFFMan 等级差异

本仓库新增 AFFMan 等级体系。

等级配置保存在 `affiliate_setting.levels`，格式为 JSON 数组。每个等级包含：

- `key`：等级唯一标识。
- `name`：等级显示名称。
- `min_effective_invites`：升级所需有效邀请人数。
- `min_total_reward_quota`：升级所需累计充值返佣额度。
- `invitee_first_topup_bonus_percent`：被邀请人首充多送比例。
- `inviter_first_commission_percent`：邀请人首充返佣比例。
- `lifetime_commission_enabled`：是否开启长期返佣。
- `lifetime_commission_percent`：长期返佣比例。

等级规则：

1. 等级按门槛升序配置。
2. 升级需要同时满足有效邀请人数和累计充值返佣额度两个条件。
3. 等级自动升级，只升不降。
4. 当前订单使用结算前的邀请人等级。
5. 本次奖励入账后再刷新统计并判断是否升级。
6. 升级只影响后续订单。

有效邀请人数统计规则：

- 按不同的 `invitee_id` 去重统计。
- 只有被邀请人产生过成功充值返佣流水后，才算有效邀请。
- 注册固定奖励不算有效邀请。
- 被邀请人的首充多送不算邀请人的有效返佣。

累计充值返佣统计规则：

- 只统计邀请人作为 `beneficiary_id` 获得的充值返佣。
- 包含邀请人首充返佣和邀请人长期返佣。
- 不包含被邀请人首充多送。
- 不包含注册固定奖励。

## 后端详细差异

### 配置层

文件：`setting/operation_setting/affiliate_setting.go`

- 新增 `AffiliateSetting` 配置结构。
- 新增 `AffiliateLevel` 等级结构。
- 新增默认 AFFMan 等级。
- 新增等级解析、默认等级、按 key 获取等级、获取下一等级、按统计数据解析应升级等级等方法。
- 新增配置项：
  - `affiliate_setting.enabled`
  - `affiliate_setting.registration_reward_enabled`
  - `affiliate_setting.settle_to_aff_quota`
  - `affiliate_setting.min_reward_base_quota`
  - `affiliate_setting.first_commission_window_days`
  - `affiliate_setting.levels`

### 数据模型

文件：`model/affiliate.go`

- 新增 `AffiliateReward` 返佣流水模型。
- 新增 `AffiliateUserStat` 用户 AFFMan 统计模型。
- 新增返佣类型：
  - `registration_inviter`
  - `registration_invitee`
  - `invitee_first_topup_bonus`
  - `inviter_first_commission`
  - `inviter_lifetime_commission`
- 新增 `ApplyRegistrationAffiliateRewards`，负责注册固定奖励。
- 新增 `ApplyAffiliateRewardsTx`，负责充值返佣结算。
- 新增 `GetAffiliatePolicyForUser`，负责生成用户钱包页展示策略。
- 新增返佣流水和统计列表查询方法。
- 新增统计刷新和自动升级逻辑。
- 使用唯一索引防止重复结算。

文件：`model/main.go`

- 自动迁移 `AffiliateReward`。
- 自动迁移 `AffiliateUserStat`。

文件：`model/user.go`

- 注册后不再直接调用旧的固定邀请奖励逻辑。
- 改为调用 `ApplyRegistrationAffiliateRewards`。
- 注册固定奖励受 `affiliate_setting.registration_reward_enabled` 控制。
- 用户列表补充非数据库字段 `aff_level_key`，用于管理端展示 AFFMan 等级。

文件：`model/topup.go`

- 所有充值成功路径在订单成功事务内调用 `ApplyAffiliateRewardsTx`。
- 已接入路径包括：
  - Stripe 充值成功。
  - Epay 充值成功。
  - Creem 充值成功。
  - Waffo 充值成功。
  - Waffo Pancake 充值成功。
  - 管理员手动补单。
- Epay 充值回调抽到模型层 `RechargeEpay`，统一处理状态变更、入账、返佣和日志。

### 控制器和路由

文件：`controller/affiliate.go`

- 新增用户返佣流水接口处理。
- 新增用户 AFFMan 统计接口处理。
- 新增管理员返佣流水接口处理。
- 新增管理员 AFFMan 统计接口处理。
- 支持按关键词、奖励类型、等级、受益人、邀请人、被邀请人和订单号筛选返佣流水。

文件：`router/api-router.go`

- 新增用户接口：
  - `GET /api/user/self/affiliate/rewards`
  - `GET /api/user/self/affiliate/stats`
- 新增管理员接口：
  - `GET /api/affiliate/rewards`
  - `GET /api/affiliate/stats`

文件：`controller/topup.go`

- `GET /api/user/topup/info` 新增返回 `affiliate_policy`。
- 前端可据此展示当前 AFFMan 等级、当前比例、下一等级门槛和升级进度。

文件：`controller/option.go`

- 保存 `affiliate_setting.levels` 时新增校验：
  - 必须是合法 JSON 数组。
  - 等级 key 不能为空。
  - 等级 key 不能重复。
  - 等级名称不能为空。
  - 门槛和比例不能为负数。
  - 等级必须按门槛升序排列。

## 接口详细差异

### 用户接口

`GET /api/user/topup/info`

- 新增返回字段 `affiliate_policy`。
- 包含：
  - 返佣总开关。
  - 注册奖励开关。
  - 当前 AFFMan 等级。
  - 下一 AFFMan 等级。
  - 有效邀请人数。
  - 累计充值返佣额度。
  - 邀请人数进度。
  - 返佣额度进度。
  - 首充高返窗口天数。

`GET /api/user/self/affiliate/rewards`

- 查询当前用户自己的奖励流水。
- 支持分页参数 `p`、`page_size`。

`GET /api/user/self/affiliate/stats`

- 查询当前用户 AFFMan 统计和策略。

### 管理员接口

`GET /api/affiliate/rewards`

- 查询全站返佣流水。
- 支持分页参数 `p`、`page_size`。
- 支持筛选：
  - `keyword`
  - `reward_type`
  - `level_key`
  - `beneficiary_id`
  - `inviter_id`
  - `invitee_id`
  - `trade_no`

`GET /api/affiliate/stats`

- 查询全站 AFFMan 统计。
- 支持分页参数 `p`、`page_size`。
- 支持筛选：
  - `keyword`
  - `level_key`

## 默认前端详细差异

默认前端目录：`web/default`

### 钱包页

相关文件：

- `web/default/src/features/wallet/types.ts`
- `web/default/src/features/wallet/api.ts`
- `web/default/src/features/wallet/index.tsx`
- `web/default/src/features/wallet/components/affiliate-rewards-card.tsx`
- `web/default/src/features/wallet/components/dialogs/affiliate-rewards-dialog.tsx`

差异：

- 钱包邀请卡保留原来的邀请链接、待转入收益、累计收益、邀请数和转入余额入口。
- 新增 AFFMan 等级徽标。
- 新增充值返佣开启或关闭状态。
- 新增当前等级的首充返佣比例。
- 新增当前等级的长期返佣比例。
- 新增被邀请人首充多送比例。
- 新增下一等级有效邀请进度。
- 新增下一等级累计返佣进度。
- 新增奖励明细弹窗。
- 奖励明细展示：
  - 时间。
  - 奖励类型。
  - 订单。
  - 关联用户。
  - AFFMan 等级。
  - 返佣基数。
  - 返佣比例。
  - 奖励额度。
  - 状态。

### 管理端计费设置

相关文件：

- `web/default/src/features/system-settings/types.ts`
- `web/default/src/features/system-settings/api.ts`
- `web/default/src/features/system-settings/billing/index.tsx`
- `web/default/src/features/system-settings/billing/section-registry.tsx`
- `web/default/src/features/system-settings/billing/affiliate-rewards-section.tsx`
- `web/default/src/features/system-settings/billing/affiliate-rewards-log-section.tsx`
- `web/default/src/features/system-settings/billing/affiliate-stats-section.tsx`

差异：

- 计费设置新增“邀请返佣”配置分区。
- 支持配置充值返佣总开关。
- 支持配置注册奖励开关。
- 支持配置邀请人奖励进入邀请余额或主余额。
- 支持配置最低返佣充值额度。
- 支持配置首充高返窗口天数。
- 支持配置注册邀请人固定奖励。
- 支持配置注册被邀请人固定奖励。
- 新增 AFFMan 等级编辑器。
- 等级编辑器支持新增、删除和修改等级。
- 前端保存前会做基础校验。
- 新增管理员返佣流水表。
- 返佣流水表支持奖励类型筛选、等级筛选和关键词搜索。
- 新增管理员 AFFMan 统计表。
- 统计表展示用户、当前等级、有效邀请数、累计返佣、下一等级进度、等级更新时间和更新时间。
- 统计表支持用户搜索和等级筛选。

### 用户管理

相关文件：

- `web/default/src/features/users/types.ts`
- `web/default/src/features/users/components/users-columns.tsx`

差异：

- 用户类型补充 `aff_level_key`。
- 用户表邀请信息列新增 AFFMan 等级徽标。

### 多语言

相关文件：

- `web/default/src/i18n/locales/en.json`
- `web/default/src/i18n/locales/zh.json`
- `web/default/src/i18n/locales/fr.json`
- `web/default/src/i18n/locales/ja.json`
- `web/default/src/i18n/locales/ru.json`
- `web/default/src/i18n/locales/vi.json`

差异：

- 补充 AFF 充值返佣相关文案。
- 补充 AFFMan 等级和统计相关文案。
- 补充返佣流水、奖励明细、等级编辑器相关文案。
- 已通过同步脚本整理，报告中缺失、冗余、未翻译数量均为 0。

## 经典前端详细差异

经典前端目录：`web/classic`

### 钱包页

相关文件：

- `web/classic/src/components/topup/index.jsx`
- `web/classic/src/components/topup/InvitationCard.jsx`
- `web/classic/src/components/topup/modals/AffiliateRewardsModal.jsx`

差异：

- 充值信息读取 `affiliate_policy`。
- 邀请卡展示 AFFMan 等级。
- 邀请卡展示有效邀请升级进度。
- 邀请卡展示累计返佣升级进度。
- 新增奖励明细按钮。
- 新增奖励明细弹窗。
- 奖励明细弹窗使用 Semi UI 的 `Modal`、`Table`、`Tag`。

### 设置页

相关文件：

- `web/classic/src/pages/Setting/Operation/SettingsCreditLimit.jsx`

差异：

- 旧版额度设置页新增 AFF 充值返佣配置区。
- 支持充值返佣总开关。
- 支持注册奖励开关。
- 支持返佣进入邀请余额开关。
- 支持最低返佣充值额度。
- 支持首充高返窗口天数。
- `affiliate_setting.levels` 使用 JSON 文本维护。

### 用户表

相关文件：

- `web/classic/src/components/table/users/UsersColumnDefs.jsx`

差异：

- 邀请信息列新增 AFFMan 等级展示。

## 测试差异

相关文件：

- `model/affiliate_test.go`
- `model/task_cas_test.go`

新增测试覆盖：

1. 注册奖励默认关闭时，只绑定邀请关系，不发奖励。
2. 注册奖励开启后，固定奖励正常发放并写流水。
3. 注册固定奖励不影响 AFFMan 统计。
4. 首充成功后，按邀请人当前等级计算被邀请人首充多送。
5. 首充成功后，按邀请人当前等级计算邀请人首充返佣。
6. 当前订单触发升级后，本订单仍使用旧等级。
7. 升级后的下一笔订单使用新等级。
8. 有效邀请人数按产生过成功充值返佣的被邀请人去重统计。
9. 累计返佣只统计邀请人获得的充值返佣。
10. 重复结算同一订单不会重复发奖。

当前环境限制：

- 本机当前没有 Go 工具链，无法在本次改动时实际执行 `go test`。
- 已保留测试代码，具备 Go 环境后应执行后端测试。

## 同步原仓库时必须检查的文件

从原仓库同步后，优先检查以下文件是否发生冲突、移动或逻辑变更：

- `setting/operation_setting/affiliate_setting.go`
- `model/affiliate.go`
- `model/affiliate_test.go`
- `model/main.go`
- `model/user.go`
- `model/topup.go`
- `model/task_cas_test.go`
- `controller/affiliate.go`
- `controller/option.go`
- `controller/topup.go`
- `router/api-router.go`
- `web/default/src/features/wallet/*`
- `web/default/src/features/system-settings/billing/*`
- `web/default/src/features/system-settings/api.ts`
- `web/default/src/features/system-settings/types.ts`
- `web/default/src/features/users/*`
- `web/default/src/i18n/locales/*`
- `web/classic/src/components/topup/*`
- `web/classic/src/pages/Setting/Operation/SettingsCreditLimit.jsx`
- `web/classic/src/components/table/users/UsersColumnDefs.jsx`

## 同步后的最小验收清单

同步原仓库代码后，至少按下面顺序验证：

1. 注册奖励默认关闭时，注册只绑定邀请关系，不发固定奖励。
2. 打开注册奖励后，注册固定奖励正常发放并写入流水。
3. 注册固定奖励不增加 AFFMan 有效邀请人数和累计充值返佣。
4. 被邀请人首充成功后，能获得首充多送。
5. 邀请人在被邀请人首充成功后，能获得首充返佣。
6. 首充高返窗口内的充值使用首充返佣比例。
7. 首充高返窗口外，如果长期返佣开启，则使用长期返佣比例。
8. 首充高返窗口外，如果长期返佣关闭，则不发长期返佣。
9. 本次返佣达到下一等级门槛后，当前订单仍使用旧等级。
10. 邀请人升级后，下一笔订单使用新等级。
11. 重复回调或重复补单不会重复写返佣流水。
12. 用户钱包邀请卡能显示 AFFMan 等级和升级进度。
13. 用户奖励明细能正常分页加载。
14. 管理端返佣流水能按类型、等级、订单号和用户编号筛选。
15. 管理端 AFFMan 统计能显示下一等级进度。
16. 默认前端和经典前端页面在桌面和移动端不出现明显溢出。

## 保留原则

后续同步原仓库时，应保留以下本地设计：

- 注册奖励必须由 `affiliate_setting.registration_reward_enabled` 独立控制。
- 充值返佣必须只在充值成功后结算。
- 返佣基数必须只取本次实际付费充值到账额度。
- AFFMan 等级必须只升不降。
- 当前订单必须使用结算前等级。
- 有效邀请人数必须按成功充值返佣的被邀请人去重统计。
- 邀请人累计返佣必须排除注册固定奖励和被邀请人首充多送。
- 重复回调和重复补单必须保持幂等。
- 默认前端和经典前端都要保留用户侧奖励明细入口。
- 管理端必须保留返佣流水、AFFMan 统计和等级配置入口。
