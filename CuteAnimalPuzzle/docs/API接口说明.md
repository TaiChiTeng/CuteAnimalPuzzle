# CuteAnimalPuzzle API 接口说明文档

## 项目概述

CuteAnimalPuzzle 是一个基于 Cocos Creator 3.8.6 开发的可爱动物拼图游戏，支持微信小游戏平台。项目采用 TypeScript 开发，具有完整的模块化架构。

## 核心模块架构

### 1. 游戏数据管理模块 (GameDataPuzzle)

**文件路径**: `assets/CuteAnimalPuzzle/GameScripts/GameDataPuzzle.ts`

#### 主要功能
- 游戏存档数据管理
- 拼图状态管理
- 动态图片下载与缓存
- 微信小游戏文件系统集成

#### 核心接口

##### 单例获取
```typescript
static get instance(): GameDataPuzzle
```

##### 存档数据管理
```typescript
// 获取/设置声音开启状态
getSoundEnabled(): boolean
setSoundEnabled(enabled: boolean): void

// 保存存档数据
saveData(): void
```

##### 拼图状态管理
```typescript
// 获取/设置拼图状态
getPuzzleStatus(puzzleId: number): PuzzleStatus
setPuzzleStatus(puzzleId: number, status: PuzzleStatus): void

// 完成拼图
completePuzzle(puzzleId: number): void

// 获取拼图总数
getTotalPuzzleCount(): number

// 获取可用拼图ID列表
getAvailablePuzzleIds(): number[]
```

##### 拼图组管理
```typescript
// 获取拼图组数量
getPuzzleGroupCount(): number

// 根据组ID获取拼图ID列表
getPuzzleIdsByGroup(groupId: number): number[]

// 获取所有组ID
getAllGroupIds(): number[]

// 检查组下载状态
checkGroupDownloadStatus(groupId: number): { 
    isFullyDownloaded: boolean, 
    downloadedCount: number, 
    totalCount: number 
}
```

##### 难度管理
```typescript
// 获取/设置当前难度
getCurrentDifficulty(): PuzzleDifficulty
setCurrentDifficulty(difficulty: PuzzleDifficulty): void

// 获取拼图网格尺寸
getPuzzleGridSize(difficulty?: PuzzleDifficulty): { rows: number, cols: number }
```

##### 资源管理
```typescript
// 获取拼图SpriteFrame
getPuzzleSpriteFrame(puzzleId: number): SpriteFrame | null

// 从URL加载图片
loadImageFromURL(puzzleId: number, url: string): Promise<SpriteFrame | null>

// 初始化拼图组数据
initializePuzzleGroupData(groupId: number, onProgress?: (current: number, total: number) => void): Promise<void>

// 预加载组图片
preloadGroupImages(groupId: number, onProgress?: (current: number, total: number) => void): Promise<void>
```

##### 遮罩管理（静态方法）
```typescript
// 获取遮罩SpriteFrame
static getMaskSpriteFrame(difficulty: PuzzleDifficulty, pieceIndex: number): SpriteFrame | null

// 获取遮罩数组长度
static getMaskArrayLength(difficulty: PuzzleDifficulty): number
```

#### 枚举定义

```typescript
// 拼图状态枚举
export enum PuzzleStatus {
    UNAVAILABLE = 0,  // 未开放
    LOCKED = 1,       // 未解锁
    UNLOCKED = 2,     // 已解锁未完成
    COMPLETED = 3     // 已完成
}

// 拼图难度枚举
export enum PuzzleDifficulty {
    EASY = 9,     // 9张拼图切片
    MEDIUM = 16,  // 16张拼图切片
    HARD = 25     // 25张拼图切片
}
```

### 2. UI管理模块 (UIManager)

**文件路径**: `assets/CuteAnimalPuzzle/GameScripts/UIManager.ts`

#### 主要功能
- 统一管理所有UI界面的显示/隐藏
- 声音按钮状态同步
- 界面切换逻辑

#### 核心接口

##### 界面切换
```typescript
// 显示主菜单界面
showMainMenuOnly(): void

// 显示拼图组选择界面
showSelectPuzzleGroupOnly(): void

// 显示难度选择和拼图列表界面
showSelectDifAndPuzzleOnly(groupIndex?: number): void

// 显示解决拼图界面
showSolvePuzzleOnly(): void

// 显示完成拼图界面
showFinishPuzzleOnly(): void
```

##### 声音控制
```typescript
// 切换声音状态
toggleSound(): void

// 更新所有界面的声音按钮状态
private updateAllSoundButtonStates(): void
```

### 3. 拼图资源管理模块 (PuzzleResourceManager)

**文件路径**: `assets/CuteAnimalPuzzle/GameScripts/PuzzleResourceManager.ts`

#### 主要功能
- 拼图切片生成与缓存
- 动态图片加载管理
- 资源优化与内存管理

#### 核心接口

##### 单例获取
```typescript
static get instance(): PuzzleResourceManager
```

##### 图片资源管理
```typescript
// 获取拼图SpriteFrame
getPuzzleSpriteFrame(puzzleId: number): SpriteFrame | null

// 异步加载拼图图片
loadPuzzleImageAsync(puzzleId: number): Promise<SpriteFrame | null>
```

##### 拼图切片生成
```typescript
// 生成拼图切片
generatePuzzlePieces(puzzleId: number, rows: number, cols: number): SpriteFrame[]

// 获取单个拼图切片
getPuzzlePiece(puzzleId: number, rows: number, cols: number, pieceIndex: number): SpriteFrame | null

// 预加载拼图切片
preloadPuzzlePieces(puzzleId: number, rows: number, cols: number): void
```

##### 缓存管理
```typescript
// 清理切片缓存
clearPieceCache(puzzleId?: number): void

// 清理所有缓存
clearCache(): void

// 获取资源统计
getResourceStats(): { totalPuzzles: number, cachedPieces: number }
```

### 4. 拼图切片模块 (PuzzlePiece)

**文件路径**: `assets/CuteAnimalPuzzle/GameScripts/PuzzlePiece.ts`

#### 主要功能
- 单个拼图切片的逻辑控制
- 位置检测与移动
- 遮罩设置

#### 核心接口

##### 切片信息设置
```typescript
// 设置拼图切片信息
setPieceInfo(index: number, correctRow: number, correctCol: number): void

// 设置拼图切片的遮罩
setMask(maskSpriteFrame: SpriteFrame): void
```

##### 位置与移动
```typescript
// 移动到指定位置
moveToPosition(parent: Node, localPos: Vec3): void

// 检查是否在指定区域内
isInArea(areaNode: Node): boolean

// 获取与目标位置的距离
getDistanceToPosition(targetWorldPos: Vec3): number
```

##### 遮罩管理
```typescript
// 获取遮罩节点
getMaskNode(): Node | null

// 获取遮罩组件
getMaskComponent(): Mask | null

// 获取正确位置的索引
getCorrectIndex(gridCols: number): number
```

### 5. 音频管理模块 (AudioMgr)

**文件路径**: `assets/CuteAnimalPuzzle/GameScripts/AudioMgr.ts`

#### 主要功能
- 全局音频播放管理
- 背景音乐与音效控制
- 跨场景音频持久化

#### 核心接口

##### 单例获取
```typescript
static get inst(): AudioMgr
```

##### 音频播放
```typescript
// 播放短音频（音效）
playOneShot(sound: AudioClip | string, volume: number = 1.0): void

// 播放长音频（背景音乐）
play(sound: AudioClip | string, volume: number = 1.0): void
```

##### 音频控制
```typescript
// 设置音量
setVolume(volume: number = 1.0): void

// 停止播放
stop(): void

// 暂停播放
pause(): void

// 恢复播放
resume(): void
```

### 6. UI界面模块

#### UIMainMenu - 主菜单界面
**文件路径**: `assets/CuteAnimalPuzzle/GameScripts/UIMainMenu.ts`

```typescript
// 界面显示回调
onShow(): void

// 设置UIManager引用
setUIManager(uiManager: UIManager): void
```

#### UISelectPuzzleGroup - 拼图组选择界面
**文件路径**: `assets/CuteAnimalPuzzle/GameScripts/UISelectPuzzleGroup.ts`

```typescript
// 界面显示回调
onShow(): void

// 获取可用组数量
getAvailableGroupCount(): number
```

#### UISelectDifAndPuzzle - 难度选择和拼图列表界面
**文件路径**: `assets/CuteAnimalPuzzle/GameScripts/UISelectDifAndPuzzle.ts`

```typescript
// 界面显示回调（带组索引参数）
onShow(groupIndex: number = 0): void

// 设置当前组索引
setCurrentGroupIndex(groupIndex: number): void

// 获取当前组索引
getCurrentGroupIndex(): number
```

#### UISolvePuzzle - 解决拼图界面
**文件路径**: `assets/CuteAnimalPuzzle/GameScripts/UISolvePuzzle.ts`

```typescript
// 界面显示回调
onShow(): void

// 初始化拼图游戏
initializePuzzleGame(puzzleId: number, difficulty: PuzzleDifficulty): void
```

#### UIFinishPuzzle - 完成拼图界面
**文件路径**: `assets/CuteAnimalPuzzle/GameScripts/UIFinishPuzzle.ts`

```typescript
// 界面显示回调
onShow(): void

// 设置完成的拼图
setCompletedPuzzle(puzzleId: number): void
```

### 7. 微信小游戏集成模块

#### wxManager - 微信功能管理
**文件路径**: `assets/Scripts/wxManager.ts`

```typescript
// 按钮点击触发的分享方法
onShareButtonClick(): void
```

#### Loading - 加载界面
**文件路径**: `assets/Scripts/Loading.ts`

```typescript
// 组件属性
@property(ProgressBar) loadingProgress: ProgressBar
@property loadTime: number
```

## 使用示例

### 1. 获取游戏数据并设置拼图状态

```typescript
const gameData = GameDataPuzzle.instance;
if (gameData) {
    // 获取拼图状态
    const status = gameData.getPuzzleStatus(1);
    
    // 完成拼图
    gameData.completePuzzle(1);
    
    // 设置难度
    gameData.setCurrentDifficulty(PuzzleDifficulty.MEDIUM);
}
```

### 2. 切换UI界面

```typescript
const uiManager = this.getComponent(UIManager);
if (uiManager) {
    // 显示拼图组选择界面
    uiManager.showSelectPuzzleGroupOnly();
    
    // 显示解决拼图界面
    uiManager.showSolvePuzzleOnly();
}
```

### 3. 生成拼图切片

```typescript
const resourceManager = PuzzleResourceManager.instance;
if (resourceManager) {
    // 生成3x3拼图切片
    const pieces = resourceManager.generatePuzzlePieces(1, 3, 3);
    
    // 获取单个切片
    const piece = resourceManager.getPuzzlePiece(1, 3, 3, 0);
}
```

### 4. 播放音频

```typescript
// 播放背景音乐
AudioMgr.inst.play("audio/bgm", 0.5);

// 播放音效
AudioMgr.inst.playOneShot("audio/click", 1.0);
```

## 注意事项

1. **单例模式**: GameDataPuzzle、PuzzleResourceManager、AudioMgr 都采用单例模式，使用前需检查实例是否存在
2. **异步操作**: 图片加载和拼图组初始化都是异步操作，需要使用 Promise 或 async/await
3. **内存管理**: 定期清理缓存以避免内存泄漏
4. **微信平台**: 部分功能依赖微信小游戏API，需要进行平台检测
5. **错误处理**: 所有接口调用都应该包含适当的错误处理逻辑

## 版本信息

- **Cocos Creator**: 3.8.6
- **TypeScript**: ESNext
- **目标平台**: 微信小游戏
- **文档版本**: 1.0.0