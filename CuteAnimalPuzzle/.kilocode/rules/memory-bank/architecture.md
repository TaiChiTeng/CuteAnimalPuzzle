# CuteAnimalPuzzle 系统架构

## 整体架构设计

### 架构层次图
```
┌─────────────────────────────────────────────────────────────┐
│                        表现层 (UI Layer)                     │
├─────────────────────────────────────────────────────────────┤
│  UIMainMenu  │ UISelectPuzzleGroup │ UISolvePuzzle │ etc.   │
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

**关键数据结构**:
```typescript
interface SaveData {
    soundEnabled: boolean;
    currentDifficulty: PuzzleDifficulty;
    puzzleStatuses: { [puzzleId: number]: PuzzleStatus };
    completedPuzzles: number[];
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

**切片生成算法**:
```typescript
generatePuzzlePieces(puzzleId: number, rows: number, cols: number): SpriteFrame[]
```

#### PuzzleDownloadManager - 下载管理器
- **设计模式**: 单例模式
- **职责**: 管理异步下载队列、状态跟踪、重试机制
- **核心功能**:
  - 并发下载控制 (最大3个)
  - 优先级队列管理
  - 自动重试机制
  - 进度回调支持

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
- **职责**: 游戏特定音效管理
- **核心功能**:
  - 按钮点击音效
  - 拼图放置音效
  - 完成庆祝音效
  - 背景音乐循环

### 4. 界面控制层 (UI Layer)

#### UIManager - 界面管理器
- **设计模式**: 组件模式
- **职责**: 统一管理所有UI界面的显示逻辑
- **核心功能**:
  - 界面切换控制
  - 声音按钮状态同步
  - UI生命周期管理

**界面切换方法**:
```typescript
showMainMenuOnly(): void
showSelectPuzzleGroupOnly(): void
showSolvePuzzleOnly(): void
```

### 5. 游戏逻辑层 (Game Logic Layer)

#### PuzzlePiece - 拼图切片组件
- **设计模式**: 组件模式
- **职责**: 单个拼图切片的行为控制
- **核心功能**:
  - 切片位置管理
  - 拖拽交互处理
  - 遮罩效果应用
  - 碰撞检测

#### UISolvePuzzle - 拼图游戏界面
- **职责**: 游戏主逻辑控制
- **核心功能**:
  - 拖拽交互管理
  - 完成判定逻辑
  - 提示系统
  - 进度保存

### 6. 平台集成层 (Platform Layer)

#### wxManager - 微信功能管理器
- **职责**: 微信小游戏平台功能集成
- **核心功能**:
  - 分享功能
  - 平台API封装
  - 权限管理

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

## 设计模式应用

### 单例模式
**应用场景**: 全局管理器类
- GameDataPuzzle
- PuzzleResourceManager
- AudioMgr
- PuzzleDownloadManager

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

## 关键技术决策

### 1. 资源管理策略
- **动态加载**: 按需下载拼图资源
- **本地缓存**: 微信文件系统缓存
- **内存优化**: LRU缓存算法

### 2. 状态管理
- **集中式状态**: GameDataPuzzle统一管理
- **持久化**: localStorage + 微信文件系统
- **状态同步**: UI状态与数据状态实时同步

### 3. 性能优化
- **异步处理**: 所有资源加载异步进行
- **并发控制**: 限制同时下载数量
- **内存管理**: 及时释放不需要的资源

## 扩展性设计

### 新增拼图组
```typescript
// 只需在GameDataPuzzle中添加新的组配置
const newGroupConfig = {
    groupId: 4,
    puzzleIds: [40, 41, 42, 43, 44],
    theme: "海洋动物"
};
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
│   │   └── UI*.ts             # UI组件
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