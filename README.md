# New API AFF 充值返佣改造分支

本分支用于维护 `new-api` 的 AFF 充值返佣和 AFFMan 等级改造。根目录 README 只记录本仓库、本分支和原仓库之间的关系，以及本地改造的核心差异；原项目完整介绍、部署方式和通用说明请以原仓库文档为准。

## 仓库关系

- 原仓库：`https://github.com/QuantumNous/new-api`
- 本仓库：`https://github.com/y08lin4/new-api`
- 功能分支：`feature/aff-recharge-affman`
- 详细差异文档：[`docs/affiliate-recharge-reward-diff.md`](./docs/affiliate-recharge-reward-diff.md)

## 本分支用途

原仓库的 AFF 逻辑主要是“邀请注册即奖励”。本分支把主流程改成“注册绑定邀请关系，充值成功后结算返佣”，并保留注册即奖励能力，但新增独立开关，默认关闭。

本分支适合继续验证以下业务：

- 被邀请人注册时只绑定邀请关系，不默认发固定奖励。
- 被邀请人充值成功后，按邀请人当前 AFFMan 等级结算首充多送、首充返佣和长期返佣。
- 邀请人根据有效邀请人数和累计充值返佣额度自动升级，等级只升不降。
- 后续从原仓库同步更新时，以详细差异文档为准检查需要保留的本地改动。

## 原仓库 AFF 行为

原仓库 `QuantumNous/new-api` 的 AFF 逻辑以注册事件为主：

1. 新用户注册时可以携带邀请码。
2. 后端根据邀请码找到邀请人，并写入新用户的 `inviter_id`。
3. 注册完成后，如果满足支付合规声明条件：
   - 被邀请人获得固定额度 `QuotaForInvitee`。
   - 邀请人获得固定额度 `QuotaForInviter`。
   - 邀请人的固定奖励进入 `aff_quota`，之后可以手动转入主余额。
4. 用户钱包页展示邀请链接、邀请人数、邀请收益和转入余额入口。
5. 管理端主要维护旧的固定注册邀请奖励额度。

原仓库没有充值成功后返佣、首充多送、长期返佣、AFFMan 等级、返佣流水、管理员返佣流水视图和 AFFMan 统计视图。

## 本分支核心差异

| 范围 | 原仓库 | 本分支 |
| --- | --- | --- |
| 注册行为 | 注册后发固定邀请奖励 | 注册时只绑定邀请关系，固定奖励由独立开关控制，默认关闭 |
| 返佣触发 | 注册事件 | 充值成功事件 |
| 被邀请人奖励 | 固定注册奖励 | 可按邀请人等级配置首充多送比例 |
| 邀请人奖励 | 固定注册奖励 | 可配置首充返佣、首充窗口期高返和长期返佣 |
| 返佣比例 | 固定额度 | 按邀请人当前 AFFMan 等级决定 |
| 等级体系 | 无 | 按有效邀请人数和累计充值返佣额度自动升级 |
| 流水记录 | 无独立返佣流水 | 新增 `affiliate_rewards` 返佣流水表 |
| 用户统计 | 依赖用户表邀请字段 | 新增 `affiliate_user_stats` 统计表 |
| 幂等处理 | 依赖充值订单状态 | 返佣流水唯一约束防止重复发奖 |
| 管理视图 | 无返佣流水和等级统计 | 新增返佣流水、AFFMan 统计和等级配置界面 |

## 已实现功能

### 后端

- 新增 `affiliate_setting` 配置结构：
  - `enabled`
  - `registration_reward_enabled`
  - `settle_to_aff_quota`
  - `min_reward_base_quota`
  - `first_commission_window_days`
  - `levels`
- `levels` 使用 JSON 数组保存 AFFMan 等级配置。
- 新增 `affiliate_rewards` 返佣流水表。
- 新增 `affiliate_user_stats` 用户 AFFMan 统计表。
- 注册固定奖励保留，但由 `registration_reward_enabled` 控制，默认关闭。
- 充值成功后统一进入返佣结算。
- 返佣基数只使用本次实际付费充值到账额度，不包含赠送额度和返佣额度。
- 被邀请人首充多送、邀请人首充返佣、邀请人长期返佣均使用邀请人当前 AFFMan 等级比例。
- 邀请人等级在本次返佣入账后刷新，升级只影响后续订单。
- 通过返佣流水唯一约束避免重复回调或重复补单造成重复发奖。

### 接口

- 扩展 `GET /api/user/topup/info`，新增 `affiliate_policy`。
- 新增用户接口：
  - `GET /api/user/self/affiliate/rewards`
  - `GET /api/user/self/affiliate/stats`
- 新增管理员接口：
  - `GET /api/affiliate/rewards`
  - `GET /api/affiliate/stats`
- 配置仍走现有 `/api/option/`，`affiliate_setting.levels` 作为 JSON 字符串保存。

### 默认前端

- 钱包邀请卡保留邀请链接、待转入、累计收益、邀请数和转入余额。
- 新增 AFFMan 等级徽标、当前等级比例、下一等级进度。
- 新增奖励明细入口，沿用现有表格和分页样式。
- 系统设置的计费区域新增邀请返佣配置、等级编辑器、返佣流水和 AFFMan 统计。
- 用户表邀请信息列补充 AFFMan 等级徽标。

### 经典前端

- 邀请卡保持 Semi UI 卡片风格。
- 新增 AFFMan 等级、升级进度和奖励明细按钮。
- 奖励明细使用 Semi UI 弹窗和表格展示。
- 设置页新增 AFF 充值返佣配置区。
- 用户表邀请信息列补充 AFFMan 等级展示。

### 多语言和测试

- 补充默认前端 `en`、`zh`、`fr`、`ja`、`ru`、`vi` 的 AFF 返佣相关文案。
- 新增后端返佣等级规则测试。
- 已补充同步差异文档，便于后续从原仓库拉取更新时对照处理。

## 关键业务规则

### 注册固定奖励

- 保留 `QuotaForInviter` 和 `QuotaForInvitee`。
- 默认不发放注册固定奖励。
- 开启 `affiliate_setting.registration_reward_enabled` 后才发放。
- 注册固定奖励写入返佣流水，但不参与 AFFMan 等级统计。
- 注册固定奖励不受 AFFMan 等级比例影响。

### 充值返佣

- 只在充值订单成功后结算。
- 邀请关系来自被邀请用户的 `inviter_id`。
- 没有邀请人、邀请人不存在、邀请人被禁用或邀请人为本人时跳过返佣。
- 同一订单重复回调或重复补单不会重复发奖。
- 本次订单使用结算前的邀请人等级。
- 本次奖励入账后再刷新邀请人统计并判断是否升级。

### AFFMan 等级

- 等级配置保存在 `affiliate_setting.levels`。
- 等级按门槛升序配置。
- 升级需要同时满足有效邀请人数和累计充值返佣额度。
- 有效邀请人数按产生过成功充值返佣流水的 `invitee_id` 去重统计。
- 累计充值返佣只统计邀请人作为 `beneficiary_id` 获得的充值返佣。
- 等级自动升级，只升不降。

## 主要改动范围

详细文件清单和差异说明见 [`docs/affiliate-recharge-reward-diff.md`](./docs/affiliate-recharge-reward-diff.md)。核心范围包括：

- `setting/operation_setting/affiliate_setting.go`
- `model/affiliate.go`
- `model/topup.go`
- `model/user.go`
- `controller/affiliate.go`
- `controller/topup.go`
- `controller/option.go`
- `router/api-router.go`
- `web/default/src/features/wallet`
- `web/default/src/features/system-settings`
- `web/default/src/features/users`
- `web/classic/src/components/topup`
- `web/classic/src/pages/Setting/Operation`
- `web/classic/src/components/table/users`
- `web/default/src/i18n/locales`
- `model/affiliate_test.go`

## 本地运行

后端和前端仍沿用原项目运行方式。常见流程如下：

```bash
git clone https://github.com/y08lin4/new-api.git
cd new-api
git checkout feature/aff-recharge-affman
```

使用 Docker Compose 运行时，仍按原项目配置数据库、缓存、端口和环境变量。

```bash
docker-compose up -d
```

前端或后端本地开发命令请参考原仓库文档。本分支未改变项目的基础启动方式，只新增 AFF 相关配置、接口、数据表和页面。

## 验证状态

本分支已完成以下验证：

- `git diff --check`：通过。
- `node scripts/sync-i18n.mjs`：通过，所有语言缺失、冗余、未翻译数量为 0。
- 后端返佣等级规则测试文件已补充。

当前本地环境限制：

- `npm run typecheck` 未完成，因为本地未安装 `tsc`。
- `npm run build` 未完成，因为本地未安装 `rsbuild`。
- `go test` 和 `gofmt` 未完成，因为本地未安装 Go。

## 后续同步上游

从 `QuantumNous/new-api` 同步更新时，请优先检查以下部分是否发生冲突或行为变化：

- 用户注册流程和 `inviter_id` 写入逻辑。
- 充值订单成功处理路径。
- 支付回调幂等逻辑。
- 用户余额和邀请余额字段。
- `/api/option/` 配置读写逻辑。
- 默认前端钱包页、计费设置页和用户表。
- 经典前端钱包页、设置页和用户表。
- 多语言键名和同步脚本。

同步后请重新对照 [`docs/affiliate-recharge-reward-diff.md`](./docs/affiliate-recharge-reward-diff.md)，确认本地 AFF 充值返佣和 AFFMan 等级逻辑仍然完整。

## 许可说明

本项目基于原仓库 `QuantumNous/new-api` 继续修改，许可协议沿用原项目。使用、分发和二次开发时，请遵守原项目许可证和相关法律法规。
