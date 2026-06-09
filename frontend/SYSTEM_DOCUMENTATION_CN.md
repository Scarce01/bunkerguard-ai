# BunkerGuard AI 系统文档 - 完整UI与功能说明

## 目录
1. [系统概述](#系统概述)
2. [整体架构](#整体架构)
3. [核心布局组件](#核心布局组件)
4. [页面详细说明](#页面详细说明)
5. [AI助手系统](#ai助手系统)
6. [设计系统与主题](#设计系统与主题)
7. [数据模型](#数据模型)
8. [交互功能](#交互功能)

---

## 系统概述

**BunkerGuard AI** 是一个专业的海事燃料监控与欺诈检测系统，用于实时监测船舶加油过程，检测欺诈行为，并为港口当局提供智能决策支持。

### 核心使命
- 实时监测船舶燃料加注（Bunkering）过程
- 检测数量差异、供应商欺诈、MFM（质量流量计）异常
- 提供AI驱动的决策建议
- 生成完整的证据链用于法律抗议

### 技术栈
- **前端**: React 18 + TypeScript + Vite
- **路由**: React Router v7
- **样式**: Tailwind CSS v4 + CSS Variables
- **图表**: Recharts
- **图标**: Lucide React
- **状态管理**: React Context API (主题系统)

---

## 整体架构

### 应用结构

```
BunkerGuard AI
├── AppLayout (根布局)
│   ├── Sidebar (左侧导航栏)
│   ├── TopBar (顶部栏)
│   └── Main Content (主内容区)
│       ├── Dashboard (仪表盘)
│       ├── Live Session (实时会话)
│       ├── Sessions (会话历史)
│       ├── Intelligence (情报中心)
│       ├── Evidence Center (证据中心)
│       └── Settings (设置)
└── FloatingAIAssistant (全局AI助手)
```

### 路由映射

| 路径 | 页面 | 描述 |
|------|------|------|
| `/` | DashboardPage | 任务控制中心 - 概览仪表盘 |
| `/live` | LiveSessionPage | 实时加油会话监控 |
| `/sessions` | SessionsPage | 历史会话列表与审计 |
| `/intelligence` | IntelligencePage | 供应商与舰队情报 |
| `/evidence` | EvidenceCenterPage | 证据链与区块链验证 |
| `/settings` | SettingsPage | 系统设置与配置 |

---

## 核心布局组件

### 1. Sidebar (侧边栏导航)
**位置**: 左侧固定，宽度 256px

**视觉设计**:
- 深色渐变背景: `#041020` → `#030D1A` → `#020A14`
- 右侧边框带淡蓝色光晕
- 半透明玻璃态效果

**组成部分**:

#### Logo区域
- 图标: Shield盾牌图标，蓝色发光
- 文本: "BunkerGuard AI"
- 副标题: "MARITIME INTELLIGENCE"（全大写，间距加宽）

#### 导航项 (6个主要导航)
1. **Dashboard** - 仪表盘图标 (LayoutDashboard)
2. **Live Session** - 活动图标 (Activity)
3. **Sessions** - 数据库图标 (Database)
4. **Intelligence** - 图表图标 (BarChart2)
5. **Evidence Center** - 盾牌图标 (Shield)
6. **Settings** - 设置图标 (Settings，自动推到底部)

**交互状态**:
- **未激活**: 灰蓝色 `#557A96`，透明背景
- **悬停**: 浅蓝色 `#8BB4D6`，半透明蓝色背景
- **激活**: 亮白色 `#E5F2FF`，蓝色渐变背景 + 左侧3px蓝色边框

#### 系统状态指示器
**位置**: 底部固定
- 绿色脉冲点 + "SYSTEM ONLINE"
- 显示: "All 12 sensors active · 0 faults"
- 深色卡片背景，内嵌阴影效果

---

### 2. TopBar (顶部栏)
**位置**: 顶部固定，高度 64px

**视觉设计**:
- 半透明深色背景 + 背景模糊 (backdrop-filter blur 32px)
- 底部淡蓝色光晕边框

**组成部分** (从左到右):

#### 1. 搜索栏
- 占据左侧主要空间（max-width: 512px）
- 圆角设计 (border-radius: 16px)
- 内嵌搜索图标 (Search)
- 占位符: "Search sessions, vessels, suppliers..."
- 聚焦时显示蓝色外发光

#### 2. LIVE实时指示器
- 绿色脉冲点 + "LIVE" 标签
- 成功色背景 `rgba(34, 197, 94, 0.08)` + 外发光
- 显示当前时间（24小时制，秒级更新）
- 显示当前日期 (格式: "27 May 2026")

#### 3. 通知按钮
- 铃铛图标 (Bell)
- 右上角红点徽章（表示有未读通知）
- 悬停时加深背景色

#### 4. 用户资料
- 左侧边框分隔
- 显示用户信息:
  - 职位: "BDN Officer"（燃料交付单官员）
  - 地点: "Port of Singapore"
- 圆角用户头像，蓝色发光边框

---

## 页面详细说明

### 1. Dashboard Page (仪表盘)
**路径**: `/`

**布局结构**: 左右双列布局
- **左列**: 主要运营概览（70%宽度）
- **右列**: 智能情报面板（380px固定宽度，sticky定位）

#### 页面头部
- 标题: "Mission Control" - 字体大、粗体、浅色
- 副标题: "Real-time maritime fraud intelligence overview"

---

#### 左列内容

##### 1.1 KPI指标卡片 (2×2网格)

**四个关键指标**:

1. **Active Sessions (活动会话)**
   - 颜色: 蓝色 `#2EA8FF`
   - 图标: Activity
   - 数值: 当前进行中的加油会话数量
   - 趋势: "+2" (绿色上升)

2. **Critical Alerts (关键警报)**
   - 颜色: 红色 `#FF5A5A` (原为muted红，已改回亮红)
   - 图标: AlertTriangle
   - 数值: 高风险会话数量
   - 趋势: "+14%" (红色上升)

3. **Supplier Flags (供应商标记)**
   - 颜色: 琥珀色 `#D0A15E`
   - 图标: TrendingDown
   - 数值: 被标记的可疑供应商数量
   - 趋势: "stable" (稳定)

4. **Loss Prevented (防止损失)**
   - 颜色: 绿色 `#00D47E`
   - 图标: TrendingUp
   - 数值: 总计防止的经济损失 (单位: K美元)
   - 趋势: "+18%" (绿色上升)

**视觉效果**:
- 卡片: 深蓝渐变背景，圆角14px
- 图标容器: 彩色半透明背景 + 细边框（已移除glow效果）
- 大号数字: JetBrains Mono等宽字体，42px

---

##### 1.2 Fleet Risk Map (舰队风险地图)
**高度**: 380px

**功能**: 实时显示港口内所有船舶位置与风险状态

**视觉元素**:

1. **背景与氛围**
   - 深色渐变背景模拟海域
   - 网格图案 (60×60px)
   - 大气脉冲发光层（已改为淡蓝色，不再是红色）
   - 雷达扫描动画（旋转光束，9秒一圈）

2. **船舶标记** (4艘船)
   - 数据:
     - S16: MV Pacific Harmony - **CRITICAL** (红色) - 位置 (44%, 52%)
     - S14: MV Quantum Star - **HIGH** (琥珀) - 位置 (28%, 38%)
     - 15: MV Atlantic Pride - **MODERATE** (蓝) - 位置 (63%, 35%)
     - S13: MV Southern Cross - **LOW** (绿) - 位置 (72%, 62%)
   
   - 视觉:
     - 核心圆点：颜色根据风险等级
     - CRITICAL级别带脉冲圆环（3秒呼吸动画）
     - 悬停放大至8px
     - 下方显示会话编号 `#16`

3. **驳船标记** (3艘)
   - 小型矩形，灰蓝色半透明
   - 名称: Barge Pearl, Barge Titan, Barge Nova

4. **连接线**
   - 船舶到驳船的实线/虚线
   - 颜色对应风险等级

5. **交互点击弹窗**
   - 显示船舶详细信息:
     - 会话编号 + 风险等级
     - 船舶名称
     - 风险评分 (78/100)
     - Mismatch百分比 (3.76%)
     - Shortage数量 (18.8 MT)
   - 底部"Open Session"按钮（蓝色，已修改为蓝色CTA）

6. **图例**
   - 右下角固定位置
   - 4个风险等级: CRIT, HIGH, MOD, LOW
   - 已更新为muted色板（已移除发光效果）

---

##### 1.3 Critical Events (关键事件流)
**功能**: 实时事件时间线

**头部**:
- 红色脉冲点 + "Critical Events" 标题

**事件卡片** (6个事件):
每个事件包含:
- **严重度标签**: CRITICAL / HIGH / MEDIUM（已移除emoji，改用彩色标签）
- **事件标题**: 如 "Quantity mismatch", "Supplier flagged"
- **详情**: 如 "Session #16", "MegaFuel"
- **时间戳**: 相对时间 "12m", "34m", "1h"
- **右箭头图标**: 表示可点击

**交互效果**:
- 默认: 深色半透明背景
- CRITICAL事件: 红色边框高亮
- 悬停: 蓝色背景 + 右移2px

**点击跳转**: 根据事件类型跳转到对应页面
- `/live` - 实时会话
- `/intelligence` - 情报中心
- `/evidence` - 证据中心

---

#### 右列内容 (Sticky面板)

##### 2.1 AI Verdict Command Panel (AI判决指令面板)
**视觉**: 红色警告主题（已改为muted红）

**内容结构**:

1. **判决标题区**
   - 盾牌图标 (红色发光)
   - 标签: "AI VERDICT"
   - 判决结果: "REFUSE TO SIGN BDN" (大字、红色、粗体)

2. **置信度指示器**
   - 蓝色进度条: 92% confidence
   - JetBrains Mono字体显示百分比

3. **信号列表**
   - 3个红点列表:
     - Quantity mismatch
     - MFM drift detected
     - Supplier historical pattern

4. **行动按钮区**
   - **主要CTA**: "Open Critical Session" 
     - 颜色: **蓝色** (已修改，原为红色)
     - 渐变背景 `rgba(46,168,255,0.18)` → `rgba(46,168,255,0.12)`
     - 悬停放大 + 增强发光
   
   - **次要按钮**: "View Evidence Chain"
     - 深色背景，淡蓝色文字
     - 悬停时变为蓝色高亮

---

##### 2.2 Top Risk Session (最高风险会话)
**功能**: 显示风险评分最高的当前会话

**内容**:

1. **头部**
   - 红色船舶图标
   - 标签: "TOP RISK SESSION"
   - 会话编号: "Session #16"

2. **船舶信息**
   - 船名: "MV Pacific Harmony"
   - 供应商: "MegaFuel Pte Ltd"

3. **风险评分卡**
   - 红色背景卡片
   - 超大号数字: **78**/100 (42px字体)
   - 标签: "CRITICAL" (红色徽章)

4. **关键指标** (3行)
   - Shortage: 18.8 MT (红色)
   - Deviation: 3.76% (红色)
   - Confidence: 92% (蓝色)

---

##### 2.3 Supplier Signals (供应商信号)
**功能**: 显示可疑供应商列表

**供应商卡片** (2个):

1. **MegaFuel**
   - 评分: **58** (红色，表示高风险)
   - 状态: "3/6 flagged"
   - 背景: 深色卡片
   - 悬停: 蓝色高亮 + 右箭头

2. **OceanFuel**
   - 评分: **72** (中性色，已改为灰蓝)
   - 状态: "Watchlist"

**交互**: 点击跳转到 `/intelligence` 页面

---

### 2. Live Session Page (实时会话监控)
**路径**: `/live`

**功能**: 实时监控当前加油会话，显示MFM遥测数据、检测异常、提供AI分析

**布局**: 左右分栏布局

---

#### 左侧主面板

##### 2.1 会话头部信息
- **会话ID**: #16
- **状态徽章**: "ALERT" / "BUNKERING" / "COMPLETED" (彩色pill)
- **时间戳**: 开始时间、持续时间

##### 2.2 关键指标卡片 (3列网格)

1. **Risk Score (风险评分)**
   - 超大数字: 78/100
   - 颜色: 红色
   - 进度条可视化

2. **Shortage (短缺量)**
   - 数值: 18.8 MT
   - 红色警告色

3. **Deviation (偏差)**
   - 百分比: 3.76%
   - 红色警告色

##### 2.3 实时遥测数据表 (Telemetry Grid)
**显示MFM质量流量计的实时数据**

**关键字段** (2列网格):
- BDN Qty (燃料交付单数量): 500.0 MT
- MFM Qty (流量计测量): 481.2 MT
- Mismatch (差异): -18.8 MT (红色)
- Flow Rate (流速): 47.3 m³/h
- Density (密度): 0.982 kg/L
- Temperature (温度): 23.4°C
- Pressure (压力): 2.8 bar
- Viscosity (粘度): 14.2 cSt

**视觉**:
- 每行深色半透明背景
- 标签浅蓝色，数值白色
- 异常值用红色高亮 (如Mismatch)

##### 2.4 Port Map View (港口地图视图)
**嵌入式组件，显示当前船舶在港口的位置**

**功能**: 与Dashboard地图相同，但聚焦当前会话船舶

---

#### 右侧面板

##### 2.5 Anomaly Detection (异常检测时间线)
**高度**: 可滚动区域

**功能**: 显示加油过程中检测到的所有异常事件

**异常卡片结构**:
- **时间戳**: T+47min（相对开始时间）
- **类型**: "Flow Rate Spike", "Density Drop", "Pressure Anomaly"
- **严重度**: Critical / High / Medium (彩色徽章)
- **描述**: 简短说明
- **置信度**: AI检测置信度百分比

**视觉**:
- 时间轴左侧垂直线连接所有事件
- Critical事件用红色边框高亮
- 时间戳用等宽字体

##### 2.6 AI Copilot Chat (AI副驾驶聊天)
**固定底部**: 聊天输入框

**功能**: 
- 用户可以询问AI关于当前会话的问题
- AI返回结构化分析（findings列表 + 建议）

**快速提示** (预设问题按钮):
- "Explain mismatch"
- "Supplier history"
- "Next actions"
- "Evidence chain"

**AI回复格式**:
- 项目符号列表
- ⚠ 警告符号
- ✓ 确认符号
- 推荐行动（红色或蓝色高亮）

---

### 3. Sessions Page (会话列表页)
**路径**: `/sessions`

**功能**: 历史会话审计、搜索、过滤

**布局**: 列表 + 详情侧边栏

---

#### 3.1 页面头部
- 小标签: "AUDIT · HISTORY · ANALYTICS"
- 大标题: "Bunkering Sessions"

#### 3.2 过滤器栏
**3个过滤器 (横向排列)**:

1. **搜索框**
   - 占据大部分宽度
   - 搜索图标左侧
   - 占位符: "Search by vessel, supplier, or session ID..."

2. **状态过滤下拉菜单**
   - 选项: All Status / Bunkering / Completed / Alert / Refused

3. **风险等级过滤下拉菜单**
   - 选项: All Risk Levels / Low / Moderate / High / Critical

#### 3.3 会话表格/列表
**每行显示**:
- **会话ID**: #16
- **船舶名称**: MV Pacific Harmony
- **供应商**: MegaFuel Pte Ltd
- **状态徽章**: 彩色pill (ALERT, BUNKERING等)
- **风险评分**: 78/100 (带颜色的大数字)
- **风险等级**: Critical (文字 + 颜色)
- **时间**: 2026-06-10 14:30
- **数量**: 500.0 MT
- **短缺**: -18.8 MT (红色)
- **箭头图标**: 点击查看详情

**交互**:
- 悬停: 蓝色高亮背景
- 点击行: 右侧打开详情面板
- 点击"Open Session"按钮: 跳转到会话详情页

#### 3.4 右侧详情面板 (Slide-in)
**触发**: 点击表格任意行

**内容**:
- 会话完整信息
- 所有遥测数据
- 异常列表
- 风险评分详情
- 行动按钮:
  - "Open Full Session" → `/sessions/:id`
  - "View Evidence" → `/evidence`
  - "Export Report" (下载功能)

---

### 4. Intelligence Page (情报中心)
**路径**: `/intelligence`

**功能**: 供应商情报分析、舰队警报、网络关系图

**布局**: 标签页切换

---

#### 4.1 标签导航
**2个主要标签**:
1. **Supplier Intelligence (供应商情报)**
2. **Fleet Intelligence (舰队情报)**

---

#### Tab 1: Supplier Intelligence

##### 4.1.1 Fraud Intelligence Network (欺诈情报网络图)
**高度**: 320px
**类型**: SVG交互式网络图

**节点**:
- **左侧**: 供应商节点 (3个)
  - MegaFuel (CRITICAL, 评分58)
  - OceanFuel (HIGH, 评分72)
  - SingFuel (LOW, 评分91)

- **右侧**: 船舶节点 (4个)
  - Pacific Harmony (Session #16)
  - Quantum Star (Session #14)
  - Atlantic Pride (Session #15)
  - Southern Cross (Session #13)

**边（连接线）**:
- 不同风险等级用不同颜色
- CRITICAL连接有动画脉冲球
- 悬停高亮整条路径

**视觉**:
- 网格背景
- 危险供应商处有红色大气光晕
- 动画: AI传播脉冲（3.5秒循环）

##### 4.1.2 Supplier Reputation Cards (供应商声誉卡片)
**网格布局**: 3列

**每个供应商卡片包含**:
1. **头部**
   - 公司名称
   - 评分数字（大号，颜色编码）
   - 风险等级徽章

2. **统计数据** (4行)
   - Total Sessions (总会话数): 如 "6 sessions (90 days)"
   - Flagged Count (标记数): 如 "3 flagged" (红色)
   - Success Rate (成功率): 如 "50%" (进度条)
   - Last Incident (最近事件): 如 "2 days ago"

3. **状态指示器**
   - "Active Watchlist" (橙色)
   - "Clear" (绿色)
   - "Investigation" (红色)

4. **趋势图表**
   - 小型折线图显示90天风险趋势
   - Recharts LineChart组件

**交互**:
- 悬停: 卡片上浮 + 阴影加深
- 点击: 展开详细报告（模态框或侧边栏）

##### 4.1.3 Anomaly Heatmap (异常热力图)
**类型**: 时间 × 供应商矩阵

**功能**: 显示每个供应商在不同时间段的异常频率

**视觉**:
- 格子颜色: 从绿色（无异常）到红色（高频异常）
- 工具提示显示具体数量

---

#### Tab 2: Fleet Intelligence

##### 4.2.1 Fleet-Wide Alerts (全舰队警报)
**布局**: 时间线列表

**警报类型**:
1. **Vessel Alerts**: 船舶相关警报
   - "MV Pacific Harmony - Critical shortage detected"
   - "MV Quantum Star - Supplier reputation alert"

2. **Supplier Alerts**: 供应商警报
   - "MegaFuel - Multiple vessels flagged"

3. **System Alerts**: 系统警报
   - "Blockchain sync delayed"
   - "MFM calibration due"

**每条警报**:
- 严重度颜色条（左侧边框）
- 图标
- 标题
- 时间戳
- 状态: "New" / "Acknowledged" / "Resolved"

##### 4.2.2 Fleet Risk Trend Chart (舰队风险趋势图)
**类型**: Recharts 折线图

**数据**:
- X轴: 时间（7天、30天、90天可切换）
- Y轴: 平均风险评分
- 多条线: 不同供应商的趋势
- 区域填充显示风险区间

**交互**:
- 工具提示显示具体数值
- 图例可点击切换显示/隐藏线条

---

### 5. Evidence Center Page (证据中心)
**路径**: `/evidence`

**功能**: 区块链验证、法律文档、证据链管理

---

#### 5.1 Blockchain Verification (区块链验证)
**显示内容**:

1. **区块信息卡**
   - Block Number: #4,892,341
   - Timestamp: 2026-06-10 14:45:32 UTC
   - Hash: 0xA3F8...B2C1 (可复制)
   - Previous Hash: 0x7B2E...9D4F
   - Merkle Root: 0x5C9A...3E8B

2. **验证状态**
   - 绿色勾选图标 + "VERIFIED ON CHAIN"
   - 显示确认数量: "142 confirmations"

3. **交易详情**
   - Transaction Hash (可点击跳转到区块链浏览器)
   - Gas Used
   - From/To addresses

#### 5.2 Document Evidence (文档证据)
**文档列表**:

1. **BDN (Bunker Delivery Note)** - 燃料交付单
   - 文件ID: BDN-2026-06-10-00016
   - 状态: "Unsigned" / "Signed" / "Disputed"
   - PDF预览
   - 下载按钮

2. **Letter of Protest (抗议信)**
   - 模板: 预填写的法律抗议信
   - 生成按钮: "Generate LOP"
   - 编辑器: 可修改内容

3. **MFM Logs (流量计日志)**
   - CSV格式
   - 时间序列数据
   - 下载/导出按钮

4. **Photographs (照片证据)**
   - 网格显示
   - 时间戳水印
   - 全屏查看

#### 5.3 Evidence Chain Timeline (证据链时间线)
**垂直时间线**:

**每个节点**:
- 时间戳
- 事件类型:
  - "BDN Received"
  - "MFM Recording Started"
  - "Anomaly Detected"
  - "Photos Captured"
  - "Blockchain Hash Submitted"
  - "LOP Generated"
- 相关文档链接
- 验证状态 (绿色勾选/红色警告)

**视觉**:
- 左侧垂直线连接所有节点
- 已验证节点: 绿色
- 待验证节点: 灰色
- 有问题节点: 红色

#### 5.4 Forensic Analysis (司法分析)
**功能**: AI辅助的证据强度分析

**显示**:
- 证据完整性评分: 95/100
- 法律可用性: "ADMISSIBLE" (绿色) / "QUESTIONABLE" (橙色)
- 缺失项清单
- 建议补充的证据

---

### 6. Settings Page (设置页面)
**路径**: `/settings`

**布局**: 左侧导航 + 右侧设置面板

---

#### 设置分类

##### 6.1 Appearance (外观)
**主题切换**:
- 选项: Dark Mode / Light Mode
- 切换按钮: 太阳/月亮图标
- 实时预览
- 使用Context API全局状态管理

**配色方案**:
- 当前: Maritime Professional (海事专业色板)
- 备选: High Contrast / Colorblind Safe

##### 6.2 Investigation Mode (调查模式)
**3种模式**:

1. **Conservative (保守)**
   - 图标: ShieldCheck
   - 描述: "Higher threshold, fewer false positives"
   - 适用: 低风险环境

2. **Balanced (平衡)**
   - 图标: Scale
   - 描述: "Recommended for most operations"
   - 默认模式

3. **Strict (严格)**
   - 图标: Lock
   - 描述: "Maximum sensitivity, catch all anomalies"
   - 适用: 高风险供应商

**视觉**:
- 3个大卡片横向排列
- 选中: 蓝色边框 + 蓝色图标
- 未选中: 灰色半透明

##### 6.3 Alerts & Notifications (警报与通知)
**可配置项**:
- Email Notifications (邮件通知)
  - Critical Alerts: ON/OFF
  - Daily Summary: ON/OFF
- Push Notifications (推送通知)
- Sound Alerts (声音警报)
- Alert Threshold (警报阈值滑块)
  - 风险评分触发值: 50-90

##### 6.4 Data & Privacy (数据与隐私)
- Auto-delete logs after: 90 days (下拉选择)
- Blockchain archival: ON/OFF
- Anonymous telemetry: ON/OFF
- Export all data (按钮)

##### 6.5 Integration (集成)
- MFM Device Connection (流量计设备连接)
  - Status: Connected / Disconnected
  - Device ID: MFM-SG-2024-042
- Blockchain Network (区块链网络)
  - Network: Ethereum Sepolia Testnet
  - Contract Address: 0x7B2E...
- API Keys (API密钥管理)
  - 列表显示已配置的密钥
  - 添加/删除功能

##### 6.6 Users & Roles (用户与角色)
**用户列表**:
- 显示所有BDN官员
- 角色: Admin / Officer / Observer
- 权限管理

---

## AI助手系统

### FloatingAIAssistant Component
**位置**: 全局固定，右下角

---

### 按钮状态 (折叠时)

#### 视觉设计 (已重新设计为Premium版本)

**尺寸**: 88×88px (已增大)

**层次结构**:
1. **最外层**: 浮动粒子（3个）
   - 3px小圆点
   - 沿圆形路径缓慢旋转
   - 淡入淡出动画

2. **外圈**: 声纳脉冲圈
   - 半透明蓝色渐变
   - 呼吸动画（5秒循环）
   - 缩放范围: 1.0 → 1.2

3. **雷达圈层** (3层旋转圆环)
   - **外圈**: 56px半径，虚线，20秒顺时针旋转
   - **中圈**: 48px半径，青绿色，28秒逆时针旋转
   - **内圈**: 42px半径，细虚线，16秒顺时针旋转

4. **主容器球体** (半3D玻璃态)
   - 背景: 深蓝渐变 `#122A44` → `#0B1D33` → `#081628`
   - 边框: 2px蓝色 `#4FAFD1` 60%透明度
   - 阴影: 多层叠加
     - 外发光: `0 0 40px rgba(79,175,209,0.25)`
     - 深阴影: `0 12px 48px rgba(0,0,0,0.7)`
     - 内高光: `inset 0 2px 4px rgba(255,255,255,0.15)` (顶部光反射)
     - 内阴影: `inset 0 -4px 8px rgba(0,0,0,0.4)` (底部阴影)
   - 背景模糊: `blur(32px)`

5. **顶部光反射**
   - 位置: 顶部8%，左右各留20%
   - 高度: 25%
   - 径向渐变白色，中心18%透明度

6. **内部发光**
   - 椭圆径向渐变
   - 蓝色22%透明度
   - 位置: 中心偏上

7. **底部阴影**
   - 位置: 底部5%
   - 黑色30%透明度径向渐变

8. **AI机器人头像** (中心图标)
   **设计**: 可爱但专业的AI机器人脸

   **组成**:
   - **头部外框**: 圆角矩形 (28×42px)
     - 描边: 2.5px蓝色
     - 填充: 半透明蓝色12%

   - **眼睛** (2个发光椭圆)
     - 尺寸: 6×7px椭圆
     - 颜色: `#4FAFD1` 蓝色
     - 带高光点 (2.5×3px白色椭圆，上偏移)
     - 呼吸发光动画（3.5秒）
     - 滤镜: 柔光模糊

   - **天线**
     - 顶部中心2px线条
     - 顶端3px圆形指示灯
     - 颜色: Critical模式为橙红 `#FF8A5A`，正常为青绿 `#3EC7A5`
     - 脉冲动画（2.5秒）

   - **额头装饰** (小波浪图案)
     - 贝塞尔曲线路径
     - 1.5px青绿色描边

   - **嘴部/扬声器格栅**
     - 圆角矩形框 (24×8px)
     - 内部5条垂直细线
     - 半透明效果

   - **侧面传感器** (2个小圆点)
     - 左右各一个2px圆
     - 青绿色，40%透明度

   - **四角导航标记**
     - L型线框，4个角
     - 1.2px蓝色描边
     - 30%透明度

9. **呼吸动画圆环**
   - 内缩8px的圆形边框
   - 1.5px蓝色描边
   - 呼吸缩放动画（5秒）
   - 透明度: 0.2 ↔ 0.35

10. **说话脉冲环**
    - 内缩12px
    - 青绿色边框
    - 三段式脉冲动画（3秒）

**颜色方案**:
- 主色: `#4FAFD1` (海事蓝)
- 强调色: `#3EC7A5` (青绿)
- Critical模式: `#FF8A5A` (暖橙红)

**悬停效果**:
- 缩放: 1.08 + 上移3px
- 阴影增强: 56px发光 + 16px深阴影
- 高光加强: 20%白色顶部反射

**工具提示**:
- 位置: 按钮上方
- 文本: "Investigation Assistant"
- 蓝色脉冲点 + 文字
- 淡入动画

---

### 面板状态 (展开时)

#### 尺寸与定位
- 宽度: 480px
- 最大高度: 90vh
- 位置: 右下角固定，距离24px

#### 结构组成

##### 1. 背景与装饰
- 深蓝渐变背景 + 32px模糊
- 顶部蓝色径向发光（140px高）
- 边框: 1px白色12%透明度
- 阴影: 超大深阴影 (72px + 28px)

##### 2. 头部 (Header)
**组成**:
- 蓝色脉冲点 (8px) + "Investigation Assistant" 标题
- 置信度指示器: 92% (蓝色进度条 + 百分比)
- 关闭按钮 (X图标)

**尺寸**: 高度约70px

##### 3. 状态与快速操作区
**高风险概率卡片**:
- 红色背景卡片
- 标题: "High Fraud Probability"
- 3个信号标签: "Shortage", "Supplier", "MFM Drift"

**快速操作按钮** (4个横向pill按钮):
1. Generate Protest (生成抗议信)
2. Explain Risk (解释风险)
3. Investigate (调查)
4. Compare Sessions (比较会话)

**视觉**:
- 蓝色渐变背景 + 边框
- 悬停: 增强发光 + 上移1px
- 图标 + 文字组合

##### 4. 对话区域 (主内容，可滚动)
**AI消息卡片**:

**头部行**:
- 蓝色脉冲点
- "Analysis" 标签
- 置信度百分比 (蓝色pill徽章)
- 时间戳 (等宽字体)

**消息卡片**:
- 深色渐变背景
- 顶部淡蓝色径向发光
- 边框 + 内嵌高光

**内容分区**:
1. **Session Analysis (会话分析)**
   - 小标题: 浅蓝色
   - Findings列表（多行大号文字，14.5px）
   - 行高: 1.6
   - 颜色: 浅灰 `#E0ECFA`

2. **Recommended Action (推荐行动)**
   - 分隔线
   - 小标题
   - 大号粗体文字（16.5px）
   - 颜色: 根据内容 (红色REFUSE / 蓝色其他)

**AI思考状态**:
- 3个蓝色脉冲点（依次延迟动画）
- 深色卡片背景
- 蓝色外发光

##### 5. 建议提示栏
**标题**: "SUGGESTIONS" (小号全大写)

**快速提示chip** (4个):
- 圆角pill形状 (18px radius)
- 蓝色半透明背景
- 右箭头图标 + 文字
- 悬停: 加深背景 + 上移 + 阴影

**提示文本**:
- "Explain mismatch"
- "Supplier history"
- "Next actions"
- "Evidence chain"

##### 6. 输入区域 (底部固定)
**输入框容器**:
- 深色渐变背景
- 1px白色15%边框
- 内嵌高光
- 聚焦时: 蓝色边框 + 增强发光

**组成**:
- 文本输入框:
  - 透明背景
  - 占位符: "Ask AI Maritime Assistant…"
  - 蓝色光标
  - 16px字体

- 发送按钮:
  - 尺寸: 42×42px
  - 圆角10px
  - 条件样式:
    - 有文字: 蓝色渐变 + 发光
    - 无文字: 透明灰色
  - 图标: Send箭头
  - 悬停: 增强发光 + 缩放1.05

---

### 交互流程

1. **用户点击按钮** → 面板从右下角滑入（300ms cubic-bezier）
2. **用户输入问题** → 显示思考状态（3个脉冲点）
3. **AI返回结果** → 渲染结构化消息卡片
4. **用户点击快速提示** → 自动填充问题并发送
5. **用户点击关闭** → 面板淡出，恢复按钮状态

---

### AI响应逻辑

**触发关键词匹配**:
- "mismatch" / "shortage" → 显示数量差异分析
- "supplier" / "megafuel" → 显示供应商历史
- "history" / "previous" → 显示历史对比
- "evidence" / "blockchain" → 显示证据链
- "action" / "next" → 显示推荐步骤
- 其他 → 默认综合分析

---

## 设计系统与主题

### 颜色系统

#### Dark Mode (深色模式 - 默认)

**背景色**:
- `--background`: `#06111F` (主背景)
- `--background-secondary`: `#041020` (次级背景)
- `--background-tertiary`: `#030D1A` (三级背景)

**前景色**:
- `--foreground`: `#EAF4FF` (主文字)
- `--foreground-secondary`: `#7FA5D3` (次级文字)
- `--foreground-muted`: `#4E7A9A` (弱化文字)

**功能色**:
- `--primary`: `#2EA8FF` (主要蓝色)
- `--critical`: `#FF5A5A` (关键警告红)
- `--warning`: `#E8A043` (警告橙)
- `--success`: `#00D47E` (成功绿)
- `--muted-critical`: `#C05A5A` (柔和红)
- `--muted-warning`: `#D0A15E` (柔和橙)
- `--muted-moderate`: `#6D89B3` (柔和蓝)
- `--muted-low`: `#2E8C7D` (柔和绿)

**边框与分隔**:
- `--border`: `rgba(255,255,255,0.08)`
- `--border-secondary`: `rgba(255,255,255,0.06)`

**发光效果** (已大幅减少):
- `--glow-critical`: `0 0 8px rgba(199,90,90,0.12)` (原为0.3，减少60%)
- `--glow-primary`: `0 0 8px rgba(46,168,255,0.08)` (原为0.2，减少60%)

---

#### Light Mode (浅色模式)

**背景色**:
- `--background`: `#F4F8FC` (浅灰蓝)
- `--background-secondary`: `#E8F1F8`
- `--card-background`: `#FFFFFF`

**前景色**:
- `--foreground`: `#102033` (深蓝黑)
- `--foreground-secondary`: `#4A6B88`
- `--foreground-muted`: `#7A96B8`

**功能色** (调整饱和度):
- `--primary`: `#0077B6`
- `--critical`: `#B94A4A`
- `--warning`: `#D08030`
- `--success`: `#00A85E`

---

### 字体系统

**主字体**: System UI (原生系统字体栈)
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

**等宽字体**: JetBrains Mono
- 用于: 数字、代码、时间戳、区块链哈希
- 例子: 风险评分、会话ID、MFM数据

**字体大小等级**:
- `text-xs`: 10px (标签、辅助文字)
- `text-sm`: 12px (正文、输入框)
- `text-base`: 14px (标准内容)
- `text-lg`: 16px (小标题)
- `text-xl`: 20px (大标题)
- `text-2xl`: 22px (页面标题)
- 数字特大: 28px-42px (KPI指标)

---

### 间距系统

**标准间距** (基于4px网格):
- 4px (gap-1)
- 8px (gap-2)
- 12px (gap-3)
- 16px (gap-4)
- 20px (gap-5)
- 24px (gap-6)
- 28px (gap-7)

**容器padding**:
- 页面容器: 24-28px
- 卡片: 16-20px
- 按钮: 8-16px

---

### 圆角系统

- 小元素 (按钮、标签): 5-9px
- 中等卡片: 12-16px
- 大型面板: 18-20px
- 输入框: 9-13px
- 全圆角 (头像、指示器): 50% / 9999px

---

### 阴影系统

**卡片阴影** (3层叠加):
```css
box-shadow: 
  0 8px 32px rgba(0,0,0,0.55),  /* 主阴影 */
  0 2px 8px rgba(0,0,0,0.38),   /* 近距离阴影 */
  inset 0 1px 0 rgba(255,255,255,0.06); /* 内嵌高光 */
```

**悬停阴影** (增强):
```css
box-shadow: 
  0 12px 40px rgba(0,0,0,0.7),
  0 4px 12px rgba(0,0,0,0.5),
  inset 0 1px 0 rgba(255,255,255,0.09);
```

**发光阴影** (已减少强度):
```css
box-shadow: 0 0 16px rgba(46,168,255,0.15); /* 原为0.3 */
```

---

### 动画系统

**全局动画**:

```css
@keyframes livePulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

@keyframes atmosphericPulse {
  0%, 100% { opacity: 0.09; }
  50% { opacity: 0.15; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes rotateRadar {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes breathe {
  0%, 100% { 
    opacity: 0.2; 
    transform: scale(1); 
  }
  50% { 
    opacity: 0.35; 
    transform: scale(1.08); 
  }
}

@keyframes speakingPulse {
  0%, 100% { opacity: 0.1; transform: scale(1); }
  33% { opacity: 0.3; transform: scale(1.15); }
  66% { opacity: 0.15; transform: scale(1.05); }
}

@keyframes floatingParticle {
  0% {
    transform: translate(-50%, -50%) rotate(0deg) translateX(30px) rotate(0deg);
    opacity: 0;
  }
  10% { opacity: 0.5; }
  50% { opacity: 0.7; }
  90% { opacity: 0.3; }
  100% {
    transform: translate(-50%, -50%) rotate(360deg) translateX(30px) rotate(-360deg);
    opacity: 0;
  }
}
```

**过渡效果**:
- 标准: `transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);`
- 快速: `150ms ease-out`
- 慢速: `350ms cubic-bezier(0.4, 0, 0.2, 1)`

---

### 玻璃态效果 (Glassmorphism)

```css
background: rgba(11, 29, 51, 0.95);
backdrop-filter: blur(24px);
-webkit-backdrop-filter: blur(24px);
border: 1px solid rgba(255, 255, 255, 0.1);
```

**应用场景**:
- TopBar
- AI助手面板
- 模态框
- 悬浮卡片

---

## 数据模型

### Session (会话)
```typescript
interface Session {
  id: string;                  // 会话ID，如 "16"
  vesselName: string;          // 船名
  vesselIMO: string;           // IMO编号
  supplierName: string;        // 供应商名称
  status: SessionStatus;       // 状态
  riskScore: {
    value: number;             // 0-100评分
    level: RiskLevel;          // CRITICAL/HIGH/MODERATE/LOW
  };
  startTime: string;           // ISO时间戳
  endTime?: string;
  deliveredQuantity: number;   // 交付量 (MT)
  measuredQuantity?: number;   // 测量量 (MT)
  shortage?: number;           // 短缺量 (MT)
  deviation?: number;          // 偏差百分比
  estimatedLoss?: number;      // 估计损失 (USD)
  bdnNumber?: string;          // BDN编号
  blockchainHash?: string;     // 区块链哈希
}
```

### SessionStatus
```typescript
type SessionStatus = 
  | 'BUNKERING'   // 进行中
  | 'COMPLETED'   // 已完成
  | 'ALERT'       // 警报状态
  | 'REFUSED';    // 已拒签
```

### RiskLevel
```typescript
type RiskLevel = 
  | 'LOW'         // 低风险 (0-39)
  | 'MODERATE'    // 中等风险 (40-59)
  | 'HIGH'        // 高风险 (60-79)
  | 'CRITICAL';   // 关键风险 (80-100)
```

### Anomaly (异常)
```typescript
interface Anomaly {
  id: string;
  sessionId: string;
  timestamp: string;           // 相对时间，如 "T+47min"
  type: AnomalyType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  confidence: number;          // 0-100
  affectedMetric?: string;     // 如 "Flow Rate", "Density"
}
```

### SupplierReputation (供应商声誉)
```typescript
interface SupplierReputation {
  id: string;
  name: string;
  reputationScore: number;     // 0-100
  riskLevel: RiskLevel;
  totalSessions: number;
  flaggedSessions: number;
  successRate: number;         // 0-100百分比
  lastIncident?: string;       // ISO时间戳
  status: 'CLEAR' | 'WATCHLIST' | 'INVESTIGATION' | 'SUSPENDED';
  trend: number[];             // 90天趋势数组
}
```

---

## 交互功能

### 导航交互

#### 侧边栏导航
- **点击**: 切换页面，路由跳转
- **激活态**: 左侧蓝色边框 + 蓝色背景渐变
- **悬停**: 半透明蓝色背景

#### 面包屑 (部分页面)
- Intelligence页子页面有面包屑导航
- 点击返回上级

---

### 搜索与过滤

#### 全局搜索 (TopBar)
- 实时搜索（无需按回车）
- 搜索范围: 会话、船舶、供应商
- 聚焦时显示建议下拉菜单（未实现）

#### 高级过滤 (Sessions页)
- 3个过滤器联动
- 实时过滤，无需提交
- 结果计数实时更新

---

### 数据可视化交互

#### Fleet Risk Map
- **悬停船舶**: 圆点放大
- **点击船舶**: 显示详情弹窗
- **点击弹窗外**: 关闭弹窗
- **弹窗内按钮**: 跳转到Live Session页

#### Network Graph (Intelligence页)
- **悬停节点**: 高亮所有相关连接
- **点击供应商节点**: 高亮该供应商所有船舶
- **动画**: 自动播放AI传播脉冲

#### Charts (Recharts)
- **悬停数据点**: 显示工具提示
- **点击图例**: 切换数据系列显示/隐藏
- **缩放**: 部分图表支持拖拽缩放（未实现）

---

### 表单交互

#### 输入框
- **聚焦**: 蓝色边框 + 外发光
- **失焦**: 恢复默认边框
- **错误态**: 红色边框（验证时）

#### 下拉菜单
- 原生select元素
- 自定义样式匹配深色主题

#### 开关 (Settings页)
- 即时生效
- 保存到localStorage

---

### 卡片与列表交互

#### 可点击卡片
- **默认**: 深色背景
- **悬停**: 
  - 背景加深/变亮
  - 上浮 `translateY(-2px)`
  - 阴影增强
  - 光标变为pointer
- **点击**: 跳转或展开详情

#### 会话列表行
- **悬停**: 蓝色背景高亮
- **点击**: 右侧展开详情面板
- **再次点击**: 关闭面板

---

### AI助手交互

#### 按钮交互
- **悬停**: 放大1.08 + 上移3px + 增强发光
- **点击**: 展开面板

#### 面板交互
- **打开**: 从右下角滑入 (300ms)
- **关闭**: 
  - 点击X按钮
  - 点击背景遮罩
  - 淡出消失
- **输入**: 
  - 输入文字时发送按钮激活
  - 按Enter发送
  - 点击发送按钮
- **快速提示**: 点击自动填充并发送
- **消息**: 
  - 自动滚动到底部
  - 思考状态脉冲动画
  - 消息卡片淡入

---

### 模态框与面板

#### 侧边详情面板 (Sessions页)
- 从右侧滑入
- 半透明背景遮罩
- ESC键关闭（未实现）

#### 证据查看器 (Evidence页)
- 文档PDF全屏查看
- 图片灯箱效果
- 左右箭头切换

---

### 复制功能

#### 区块链哈希
- 点击哈希旁的复制图标
- 复制到剪贴板
- Toast提示 "Copied!"

#### 会话ID
- 同上

---

### 导出功能

#### 会话报告导出
- 点击 "Export Report" 按钮
- 生成PDF
- 浏览器下载

#### 数据导出 (Settings页)
- "Export all data" 按钮
- 生成JSON文件
- 包含所有历史会话数据

---

### 实时更新

#### Live Session页
- MFM遥测数据每2秒更新
- 异常检测实时推送
- 地图位置实时刷新

#### Dashboard页
- KPI数字实时更新
- 舰队地图位置实时刷新
- 事件流自动追加新事件

#### TopBar时钟
- 每秒更新时间
- 无闪烁，平滑过渡

---

### 主题切换

#### 功能实现
- React Context API管理全局主题状态
- localStorage持久化主题选择
- 页面加载时读取保存的主题
- 切换时立即更新所有组件

#### 切换方式
1. Settings页面切换按钮
2. 点击后立即生效
3. 页面刷新后保持选择

#### CSS实现
- 根元素添加class: `light` 或 `dark`
- CSS变量根据class变化
- 所有组件使用CSS变量，自动适配

---

## 响应式设计

### 断点 (未完全实现)
- Desktop: > 1280px (主要目标设备)
- Tablet: 768px - 1279px (部分适配)
- Mobile: < 768px (未优化)

### 当前优化
- 主要针对1440px+ 桌面显示器
- 专业操作台环境
- 固定布局，不适合移动设备

---

## 性能优化

### 代码分割
- 路由级别代码分割（React Router lazy）
- 大型图表库按需加载

### 图片优化
- SVG图标（无需加载）
- Lazy loading（未完全实现）

### 状态管理
- 最小化Context使用，仅主题系统
- 本地状态优先
- 避免不必要的重渲染

### 动画优化
- CSS动画优先
- GPU加速 (transform, opacity)
- 减少layout thrashing

---

## 无障碍性 (Accessibility)

### 语义化HTML
- 使用正确的HTML5标签
- header, nav, main, article等

### 键盘导航
- 所有可交互元素可Tab访问
- 焦点可见 (focus-visible)
- Enter/Space激活按钮

### 屏幕阅读器
- ARIA标签（部分实现）
- alt文本（图表需改进）

### 颜色对比度
- 符合WCAG AA标准
- Light模式对比度更高

---

## 浏览器兼容性

### 支持浏览器
- Chrome 90+ (推荐)
- Firefox 88+
- Safari 14+
- Edge 90+

### 关键特性依赖
- CSS backdrop-filter (需要前缀)
- CSS Grid
- Flexbox
- CSS Variables
- ES2020+

---

## 未来扩展功能 (未实现)

1. **实时WebSocket连接**: 替代模拟数据
2. **多语言支持**: i18n国际化
3. **移动端适配**: 响应式优化
4. **离线模式**: PWA + Service Worker
5. **高级权限系统**: RBAC角色权限
6. **审计日志**: 所有操作记录
7. **自定义仪表盘**: 拖拽组件
8. **导出PDF报告**: 高级模板
9. **邮件通知**: SMTP集成
10. **第三方集成**: API对接

---

## 技术债务与改进点

1. **类型安全**: 部分any类型需要改进
2. **错误处理**: 需要全局错误边界
3. **测试覆盖**: 缺少单元测试和E2E测试
4. **代码复用**: 部分重复代码可提取
5. **性能监控**: 缺少性能埋点
6. **文档完善**: 组件文档和API文档

---

## 总结

BunkerGuard AI是一个功能完善的海事燃料监控系统，具备：
- ✅ 7个核心页面
- ✅ 实时数据监控
- ✅ AI辅助决策
- ✅ 区块链证据链
- ✅ 供应商情报分析
- ✅ 深色/浅色主题
- ✅ 专业海事设计语言
- ✅ 交互式数据可视化
- ✅ 全局AI助手系统

系统设计注重专业性、可读性和操作效率，为港口当局提供强大的欺诈检测工具。
