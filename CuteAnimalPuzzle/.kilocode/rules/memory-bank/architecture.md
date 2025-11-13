# CuteAnimalPuzzle 系统架构

## 整体架构设计

### 架构层次图
```
┌─────────────────────────────────────────────────────────────┐
│                        表现层 (UI Layer)                     │
├─────────────────────────────────────────────────────────────┤
│  UIMainMenu  │ UISelectPuzzleGroup │ UISelectDifAndPuzzle │
│  UISolvePuzzle │ UIFinishPuzzle │ UISelectPuzzle(废弃)     │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      控制层 (Control Layer)                  │
├─────────────────────────────────────────────────────────────┤
│                        UIManager                            │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      业务逻辑层 (Logic Layer)                │
├─────────────────────────────────────────────────────────────┤
│  GameDataPuzzle  │ PuzzleResourceManager │ AudioMgr │ etc.  │
│  PuzzleDownloadManager │ PuzzlePiece │ PuzzleAudio          │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据层 (Data Layer)                     │
├─────────────────────────────────────────────────────────────┤
│    本地存储    │    微信文件系统    │    资源缓存    │        │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      平台层 (Platform Layer)                 │
├─────────────────────────────────────────────────────────────┤
│              微信小游戏 API │ Cocos Creator 引擎              │
└─────────────────────────────────────────────────────────────┘
```

## 核心模块详解

### 1. 数据管理层 (Data Layer)

#### GameDataPuzzle - 游戏数据管理器
- **设计模式**: 单例模式
- **职责**: 统一管理游戏存档、拼图状态、难度设置
- **核心功能**:
  - 拼图状态管理 (未开放/锁定/解锁/完成)
  - 难度等级控制 (简单/中等/困难)
  - 本地存档持久化
  - 动态图片下载和缓存
  - 微信文件系统集成
  - 拼图组管理
  - 下载管理器集成

**关键数据结构**:
```typescript
interface SaveData {
    soundEnabled: boolean;
    puzzleStatus: { [puzzleId: string]: PuzzleStatus };
    currentDifficulty: PuzzleDifficulty;
    selectedPuzzleId: string;
}

enum PuzzleStatus {
    UNAVAILABLE = 0,  // 未开放
    LOCKED = 1,       // 未解锁
    UNLOCKED = 2,     // 已解锁未完成
    COMPLETED = 3     // 已完成
}

enum PuzzleDifficulty {
    EASY = 9,     // 9张拼图切片
    MEDIUM = 16,  // 16张拼图切片
    HARD = 25     // 25张拼图切片
}
```

### 2. 资源管理层 (Resource Layer)

#### PuzzleResourceManager - 拼图资源管理器
- **设计模式**: 单例模式
- **职责**: 管理拼图图片资源的加载、切片生成、缓存优化
- **核心功能**:
  - 动态图片加载
  - 拼图切片生成算法
  - 智能缓存管理
  - 内存优化策略
  - 异步资源加载

**切片生成算法**:
```typescript
public generatePuzzlePieces(puzzleId: number, rows: number, cols: number): SpriteFrame[]
```

#### PuzzleDownloadManager - 下载管理器
- **设计模式**: 单例模式
- **职责**: 管理异步下载队列、状态跟踪、重试机制
- **核心功能**:
  - 并发下载控制 (最大3个)
  - 优先级队列管理
  - 自动重试机制 (指数退避算法)
  - 进度回调支持
  - 任务状态管理
  - 批量下载支持
  - 持久化存储和恢复
  - 文件完整性验证
  - 组级别下载控制

**下载任务状态**:
```typescript
enum DownloadTaskStatus {
    PENDING = 'pending',        // 等待下载
    DOWNLOADING = 'downloading', // 正在下载
    PAUSED = 'paused',          // 已暂停
    COMPLETED = 'completed',    // 下载完成
    FAILED = 'failed',          // 下载失败
    CANCELLED = 'cancelled'     // 已取消
}
```

**下载任务接口**:
```typescript
interface DownloadTask {
    id: string;                 // 任务唯一标识
    puzzleId: number;          // 拼图ID
    url: string;               // 下载URL
    localPath: string;         // 本地缓存路径
    status: DownloadTaskStatus; // 任务状态
    progress: number;          // 下载进度 (0-1)
    retryCount: number;        // 重试次数
    priority: number;          // 优先级 (数字越小优先级越高)
    groupId?: number;          // 拼图组ID (可选)
    createdAt: number;         // 创建时间戳
    startedAt?: number;        // 开始下载时间戳
    completedAt?: number;      // 完成时间戳
    error?: string;            // 错误信息
    downloadTask?: any;        // 微信下载任务对象
}
```

### 3. 音频管理层 (Audio Layer)

#### AudioMgr - 音频管理器
- **设计模式**: 单例模式
- **职责**: 全局音频播放控制
- **核心功能**:
  - 背景音乐播放
  - 音效管理
  - 音量控制
  - 跨场景音频持久化

#### PuzzleAudio - 拼图音频系统
- **设计模式**: 单例模式
- **职责**: 游戏特定音效管理
- **核心功能**:
  - 按钮点击音效
  - 拼图放置音效
  - 完成庆祝音效
  - 背景音乐循环
  - 音频状态同步
  - 音量控制
  - 音频资源管理

### 4. 界面控制层 (UI Layer)

#### UIManager - 界面管理器
- **设计模式**: 组件模式
- **职责**: 统一管理所有UI界面的显示逻辑
- **核心功能**:
  - 界面切换控制
  - 声音按钮状态同步
  - UI生命周期管理
  - 声音状态管理

**界面切换方法**:
```typescript
showMainMenuOnly(): void
showSelectPuzzleGroupOnly(): void
showSelectDifAndPuzzleOnly(groupIndex: number): void
showSolvePuzzleOnly(): void
showFinishPuzzleOnly(): void
```

#### UI组件系统
- **UIMainMenu**: 主菜单界面
- **UISelectPuzzleGroup**: 拼图组选择界面
- **UISelectDifAndPuzzle**: 难度和拼图选择界面
- **UISolvePuzzle**: 拼图游戏界面
- **UIFinishPuzzle**: 完成界面
- **UISelectPuzzle**: 已废弃的拼图选择界面（保留作为参考）

### 5. 游戏逻辑层 (Game Logic Layer)

#### PuzzlePiece - 拼图切片组件
- **设计模式**: 组件模式
- **职责**: 单个拼图切片的行为控制
- **核心功能**:
  - 切片位置管理
  - 拖拽交互处理
  - 遮罩效果应用
  - 碰撞检测
  - 位置验证

#### UISolvePuzzle - 拼图游戏界面
- **职责**: 游戏主逻辑控制
- **核心功能**:
  - 拖拽交互管理
  - 完成判定逻辑
  - 提示系统
  - 进度保存
  - 拼图切片管理
  - 容错处理

### 6. 平台集成层 (Platform Layer)

#### wxManager - 微信功能管理器
- **职责**: 微信小游戏平台功能集成
- **核心功能**:
  - 分享功能
  - 平台API封装
  - 权限管理
  - 微信文件系统

#### Loading - 加载管理器
- **职责**: 游戏启动和资源加载管理
- **核心功能**:
  - 启动画面显示
  - 加载进度展示
  - Bundle资源加载
  - 场景切换

## 数据流设计

### 游戏启动流程
```
游戏启动
    │
    ▼
Loading场景加载
    │
    ├─ 显示加载进度条
    ├─ 加载CuteAnimalPuzzle Bundle
    ├─ 初始化微信分享菜单
    │
    ▼
切换到Main场景
    │
    ▼
UIManager初始化
    │
    ├─ 显示主菜单界面
    ├─ 初始化GameDataPuzzle
    ├─ 加载存档数据
    ├─ 初始化下载管理器
    │
    ▼
游戏就绪
```

### 拼图游戏流程
```
选择拼图组
    │
    ▼
选择难度和具体拼图
    │
    ├─ 检查拼图状态
    ├─ 下载拼图图片(如需要)
    ├─ 显示下载进度
    │
    ▼
进入拼图游戏
    │
    ├─ 生成拼图切片
    ├─ 应用遮罩效果
    ├─ 初始化游戏逻辑
    │
    ▼
游戏进行中
    │
    ├─ 处理拖拽交互
    ├─ 检测拼图完成
    │
    ▼
拼图完成
    │
    ├─ 更新拼图状态
    ├─ 保存进度
    ├─ 显示完成界面
    │
    ▼
返回选择界面
```

### 下载管理流程
```
检测拼图图片需求
    │
    ▼
检查本地缓存
    │
    ├─ 存在缓存 → 验证文件完整性
    │   ├─ 验证通过 → 直接加载
    │   └─ 验证失败 → 删除文件，重新下载
    └─ 无缓存 → 创建下载任务
            │
            ▼
加入下载队列
    │
    ├─ 检查并发限制 (最大3个)
    ├─ 按优先级排序
    ├─ 检查是否已存在相同任务
    │
    ▼
执行下载任务
    │
    ├─ 成功 → 保存到缓存
    │   ├─ 验证文件大小 (1KB-10MB)
    │   ├─ 保存下载记录到持久化存储
    │   └─ 通知UI更新
    └─ 失败 → 重试机制
        ├─ 指数退避算法 (150ms * 2^(重试次数-1))
        ├─ 最大重试1次
        └─ 超时设置 (6500ms)
            │
            ▼
通知更新UI
```

### 下载状态持久化流程
```
应用启动
    │
    ▼
加载下载记录
    │
    ├─ 从localStorage读取
    ├─ 验证文件存在性
    ├─ 清理无效记录
    │
    ▼
恢复下载状态
    │
    ├─ 已完成任务保留记录
    ├─ 进行中任务重新加入队列
    └─ 失败任务重置为待处理
        │
        ▼
继续处理下载队列
```

## 设计模式应用

### 单例模式
**应用场景**: 全局管理器类
- GameDataPuzzle
- PuzzleResourceManager
- AudioMgr
- PuzzleDownloadManager
- PuzzleAudio

**优势**:
- 确保全局唯一实例
- 便于状态管理
- 减少内存占用

### 组件模式
**应用场景**: UI界面和游戏对象
- UIManager
- PuzzlePiece
- 所有UI组件

**优势**:
- 符合Cocos Creator设计理念
- 便于可视化编辑
- 支持生命周期管理

### 观察者模式
**应用场景**: 事件通知系统
- 下载进度回调
- 音频状态变化
- UI状态同步
- 任务完成通知

### 工厂模式
**应用场景**: 资源创建
- 拼图切片生成
- 下载任务创建
- SpriteFrame创建

## 关键技术决策

### 1. 资源管理策略
- **动态加载**: 按需下载拼图资源
- **本地缓存**: 微信文件系统缓存
- **内存优化**: LRU缓存算法
- **并发控制**: 限制同时下载数量
- **文件验证**: 下载后验证文件完整性
- **持久化存储**: 下载记录本地存储和恢复

### 2. 状态管理
- **集中式状态**: GameDataPuzzle统一管理
- **持久化**: localStorage + 微信文件系统
- **状态同步**: UI状态与数据状态实时同步
- **状态恢复**: 应用重启后恢复下载状态
- **任务状态管理**: 完整的下载任务生命周期管理

### 3. 性能优化
- **异步处理**: 所有资源加载异步进行
- **并发控制**: 限制同时下载数量
- **内存管理**: 及时释放不需要的资源
- **缓存策略**: 智能缓存管理
- **批量操作**: 支持批量下载任务
- **优先级队列**: 按优先级处理下载任务

### 4. 错误处理
- **重试机制**: 下载失败自动重试 (指数退避算法)
- **降级策略**: 网络异常时使用本地资源
- **状态恢复**: 异常后恢复到稳定状态
- **用户反馈**: 清晰的错误提示
- **超时处理**: 下载超时自动取消
- **文件验证**: 下载后验证文件大小和完整性

## 扩展性设计

### 新增拼图组
```typescript
// 只需在GameDataPuzzle中添加新的组配置
puzzleGroupID: number[] = [1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
```

### 新增难度等级
```typescript
// 在PuzzleDifficulty枚举中添加新难度
enum PuzzleDifficulty {
    EASY = 9,
    MEDIUM = 16,
    HARD = 25,
    EXPERT = 36  // 新增专家级难度
}
```

### 新增UI界面
```typescript
// 继承Component类，实现标准接口
@ccclass('UINewFeature')
export class UINewFeature extends Component {
    onShow(): void { }
    onHide(): void { }
}
```

## 文件结构
```
assets/
├── CuteAnimalPuzzle/
│   ├── GameScripts/              # 游戏核心逻辑
│   │   ├── GameDataPuzzle.ts    # 数据管理
│   │   ├── UIManager.ts         # 界面管理
│   │   ├── PuzzleResourceManager.ts # 资源管理
│   │   ├── AudioMgr.ts         # 音频管理
│   │   ├── PuzzleDownloadManager.ts # 下载管理
│   │   ├── PuzzlePiece.ts      # 拼图切片
│   │   ├── PuzzleAudio.ts      # 拼图音频
│   │   ├── UIMainMenu.ts       # 主菜单
│   │   ├── UISelectPuzzleGroup.ts # 拼图组选择
│   │   ├── UISelectDifAndPuzzle.ts # 难度和拼图选择
│   │   ├── UISolvePuzzle.ts    # 拼图游戏
│   │   ├── UIFinishPuzzle.ts   # 完成界面
│   │   └── UISelectPuzzle.ts   # 已废弃的拼图选择
│   ├── GameScenes/             # 游戏场景
│   ├── GameSounds/             # 音频资源
│   ├── PuzzlePrefabs/          # 拼图预制体
│   ├── PuzzleSprites/          # 拼图图片
│   └── UITextures/            # UI纹理
├── Scripts/                   # 通用脚本
│   ├── Loading.ts              # 加载管理
│   ├── wxManager.ts           # 微信管理
│   └── wx.d.ts               # 微信类型定义
└── Loading.scene              # 启动场景
```

## 已知架构问题

### 1. 资源管理
- 图片下载失败处理机制需要优化
- 拼图切片之间的黑线问题
- 缓存策略需要进一步优化
- 下载任务持久化可能存在数据丢失风险

### 2. 用户体验
- 手机端拖拽体验需要Y轴偏移优化
- 拼图进度保存机制不完善
- 离线模式支持不足
- 下载进度反馈可以更加直观

### 3. 性能优化
- 内存使用可以进一步优化
- 大量拼图时的加载性能
- 动画和过渡效果优化
- 下载队列管理可以更加高效

### 4. 扩展性
- 云存档功能缺失
- 多语言支持架构缺失
- 社交功能集成不完整
- 下载管理器可以支持更多平台