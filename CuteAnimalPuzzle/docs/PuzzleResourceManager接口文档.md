# PuzzleResourceManager 接口文档

## 概述

`PuzzleResourceManager` 是可爱动物拼图游戏的核心资源管理类，负责拼图切片的生成、缓存和管理。该类采用单例模式，确保全局唯一性和资源的统一管理。

## 类结构

### 单例模式
```typescript
class PuzzleResourceManager {
    private static _instance: PuzzleResourceManager | null = null;
    
    public static getInstance(): PuzzleResourceManager {
        if (!PuzzleResourceManager._instance) {
            PuzzleResourceManager._instance = new PuzzleResourceManager();
        }
        return PuzzleResourceManager._instance;
    }
}
```

### 缓存属性
```typescript
private puzzlePiecesCache: Map<string, SpriteFrame[]> = new Map();
```

用于缓存已生成的拼图切片，避免重复计算，提高性能。

## 核心方法

### generatePuzzlePieces

**功能**: 根据原始纹理和难度生成拼图切片数组

**签名**:
```typescript
public generatePuzzlePieces(originalTexture: Texture2D, difficulty: number): SpriteFrame[]
```

**参数**:
- `originalTexture: Texture2D` - 原始拼图纹理
- `difficulty: number` - 拼图难度 (3, 4, 5)

**返回值**:
- `SpriteFrame[]` - 拼图切片数组，按行列顺序排列

**算法特点**:
1. **基于精确坐标数据**: 使用《第2版.md》文档中验证过的精确坐标，而非算法推导
2. **数据驱动**: 预定义各难度的基础坐标数据，通过缩放适配不同尺寸
3. **缓存机制**: 相同规格的切片只生成一次，后续直接从缓存获取
4. **类型安全**: 完整的TypeScript类型注解和错误处理

**核心算法逻辑**:

#### 1. 缓存检查
```typescript
const cacheKey = `${originalTexture.name}_${difficulty}_${textureWidth}x${textureHeight}`;
if (this.puzzlePiecesCache.has(cacheKey)) {
    return this.puzzlePiecesCache.get(cacheKey)!;
}
```

#### 2. 基础参数计算
```typescript
// 基于384x384基准图片的标准参数
const baseMaskSize = 178;
const baseDecorationRadius = 25;

// 精确坐标数据（基于文档验证）
const baseCoordinatesData = {
    3: [0, 103, 231],              // 3x3难度
    4: [0, 77, 154, 231],          // 4x4难度  
    5: [0, 62, 124, 186, 248]      // 5x5难度
};

// 缩放比例计算
const scale = textureWidth / 384;
const maskSize = Math.round(baseMaskSize * scale);
const decorationRadius = Math.round(baseDecorationRadius * scale);
```

#### 3. 坐标数组生成
```typescript
const baseCoordinates = baseCoordinatesData[difficulty];
const coordinates = baseCoordinates.map(coord => Math.round(coord * scale));
```

**关键改进**: 直接使用文档中的精确坐标数据，避免算法推导可能产生的错误。

#### 4. 切片类型判断
每个切片根据其在网格中的位置被分类为：
- **角落切片**: 四个角落位置 (0,0), (0,n-1), (n-1,0), (n-1,n-1)
- **边缘切片**: 位于边缘但非角落的切片
- **中间切片**: 完全被其他切片包围的切片

#### 5. 尺寸计算
```typescript
const edgeSize = maskSize - decorationRadius;  // 边缘切片尺寸
const centerSize = maskSize;                   // 中间切片尺寸

// 根据切片类型分配尺寸
if (isCorner) {
    rectWidth = edgeSize;   // 153 (384基准)
    rectHeight = edgeSize;  // 153
} else if (isEdge) {
    // 边缘切片一个维度为centerSize，另一个为edgeSize
    if (isTopEdge || isBottomEdge) {
        rectWidth = centerSize;   // 178
        rectHeight = edgeSize;    // 153
    } else {
        rectWidth = edgeSize;     // 153
        rectHeight = centerSize;  // 178
    }
} else {
    rectWidth = centerSize;   // 178
    rectHeight = centerSize;  // 178
}
```

**设计理念**: 拼图切片的本质是每个切片都要为相邻切片的"凸起"预留空间，同时自己的"凸起"要延伸到相邻切片的区域。

#### 6. SpriteFrame创建
```typescript
const spriteFrame = new SpriteFrame();
spriteFrame.texture = originalTexture;
spriteFrame.rect = new Rect(x, y, rectWidth, rectHeight);
```

### 支持的图片规格

#### 游戏实际使用 (660x660)
- **3x3难度**: 坐标 [0, 177, 397], 切片尺寸 263×263 (边缘) / 306×306 (中间)
- **4x4难度**: 坐标 [0, 132, 265, 397], 切片尺寸 263×263 (边缘) / 306×306 (中间)  
- **5x5难度**: 坐标 [0, 107, 213, 320, 426], 切片尺寸 263×263 (边缘) / 306×306 (中间)

#### 完整原图 (1024x1024)
- **3x3难度**: 坐标 [0, 275, 616], 切片尺寸 408×408 (边缘) / 475×475 (中间)
- **4x4难度**: 坐标 [0, 205, 411, 616], 切片尺寸 408×408 (边缘) / 475×475 (中间)
- **5x5难度**: 坐标 [0, 165, 331, 496, 661], 切片尺寸 408×408 (边缘) / 475×475 (中间)

#### 文档基准 (384x384)
- **3x3难度**: 坐标 [0, 103, 231], 切片尺寸 153×153 (边缘) / 178×178 (中间)
- **4x4难度**: 坐标 [0, 77, 154, 231], 切片尺寸 153×153 (边缘) / 178×178 (中间)
- **5x5难度**: 坐标 [0, 62, 124, 186, 248], 切片尺寸 153×153 (边缘) / 178×178 (中间)

## 依赖关系

### 引擎依赖
```typescript
import { SpriteFrame, Texture2D, Rect } from 'cc';
```

### 内部依赖
- 无外部模块依赖
- 完全基于Cocos Creator引擎API

## 错误处理

### 输入验证
```typescript
if (!originalTexture) {
    console.error('[PuzzleResourceManager] 原始纹理不能为空');
    return [];
}

if (![3, 4, 5].includes(difficulty)) {
    console.error(`[PuzzleResourceManager] 不支持的难度: ${difficulty}`);
    return [];
}
```

### 异常情况
- **纹理为空**: 返回空数组并记录错误日志
- **不支持的难度**: 返回空数组并记录错误日志
- **纹理尺寸异常**: 自动适配缩放比例

## 性能特性

### 内存管理
- **缓存策略**: 使用Map缓存已生成的切片，避免重复计算
- **内存占用**: 每个SpriteFrame约占用基础纹理内存的1/n²
- **垃圾回收**: 支持手动清理缓存

### 计算复杂度
- **时间复杂度**: O(n²) 其中n为难度级别
- **空间复杂度**: O(n²) 用于存储切片数组
- **缓存命中**: O(1) 缓存命中时的查找时间

### 优化策略
1. **预定义坐标**: 避免运行时计算，提高效率
2. **缓存机制**: 相同规格切片只生成一次
3. **类型安全**: TypeScript编译时优化
4. **日志控制**: 详细日志便于调试，生产环境可关闭

## 使用示例

### 基本用法
```typescript
const resourceManager = PuzzleResourceManager.getInstance();
const pieces = resourceManager.generatePuzzlePieces(texture, 3);
```

### 完整示例
```typescript
// 获取单例实例
const resourceManager = PuzzleResourceManager.getInstance();

// 生成3x3难度的拼图切片
const pieces = resourceManager.generatePuzzlePieces(originalTexture, 3);

// 验证结果
if (pieces.length === 9) {
    console.log('拼图切片生成成功');
    pieces.forEach((piece, index) => {
        console.log(`切片${index}: ${piece.rect.width}x${piece.rect.height}`);
    });
}
```

## 版本兼容性

- **引擎版本**: Cocos Creator 3.8.6+
- **TypeScript**: ESNext
- **平台支持**: 微信小游戏、Web、原生平台
- **向后兼容**: 支持旧版本纹理格式

## 注意事项

1. **坐标精确性**: 基于《第2版.md》文档验证的精确坐标，确保拼图形状正确
2. **缓存管理**: 长时间运行时注意内存使用，必要时清理缓存
3. **纹理格式**: 建议使用压缩纹理格式以节省内存
4. **难度限制**: 目前仅支持3x3、4x4、5x5三种难度
5. **线程安全**: 单例模式在主线程中使用，避免多线程访问

## 扩展性

### 添加新难度
```typescript
// 在baseCoordinatesData中添加新难度的坐标数据
const baseCoordinatesData = {
    3: [0, 103, 231],
    4: [0, 77, 154, 231], 
    5: [0, 62, 124, 186, 248],
    6: [0, 52, 104, 156, 208, 260]  // 新增6x6难度
};
```

### 自定义切片形状
可通过修改`maskSize`和`decorationRadius`参数调整切片形状，但需要相应更新坐标数据。

## 调试支持

### 日志输出
```typescript
console.log(`[PuzzleResourceManager] 生成${difficulty}x${difficulty}拼图切片`);
console.log(`[PuzzleResourceManager] 缩放比例: ${scale.toFixed(3)}`);
console.log(`[PuzzleResourceManager] 坐标数组: [${coordinates.join(', ')}]`);
```

### 验证工具
建议在开发环境中启用详细日志，生产环境中关闭以提高性能。

## 类信息

- **类名**: `PuzzleResourceManager`
- **继承**: `Component`
- **装饰器**: `@ccclass('PuzzleResourceManager')`
- **设计模式**: 单例模式
- **文件路径**: `assets/CuteAnimalPuzzle/GameScripts/PuzzleResourceManager.ts`

## 静态属性

### instance
```typescript
public static get instance(): PuzzleResourceManager
```
获取PuzzleResourceManager的单例实例。

**返回值**: `PuzzleResourceManager` - 单例实例

## 私有属性

### pieceCache
```typescript
private pieceCache: Map<number, Map<string, SpriteFrame[]>>
```
拼图切片缓存，使用双层Map结构：
- 外层Key: puzzleId (拼图ID)
- 内层Key: cacheKey (格式: "行数x列数", 如 "3x3")
- Value: SpriteFrame数组

### dynamicImageCache
```typescript
private dynamicImageCache: Map<number, SpriteFrame>
```
动态加载的图片缓存：
- Key: puzzleId (拼图ID)
- Value: 完整的SpriteFrame

### loadingPromises
```typescript
private loadingPromises: Map<number, Promise<SpriteFrame>>
```
正在加载的图片Promise缓存，防止重复加载：
- Key: puzzleId (拼图ID)
- Value: 加载Promise

## 公共方法

### getPuzzleSpriteFrame
```typescript
public getPuzzleSpriteFrame(puzzleId: number): SpriteFrame | null
```
获取拼图的完整SpriteFrame。

**参数**:
- `puzzleId: number` - 拼图ID

**返回值**: `SpriteFrame | null` - 拼图的SpriteFrame，如果不存在返回null

**逻辑**:
1. 首先尝试从GameDataPuzzle的配置获取
2. 如果没有配置，尝试从动态加载缓存获取
3. 如果都没有，返回null（需要异步加载）

### loadPuzzleImageAsync
```typescript
public async loadPuzzleImageAsync(puzzleId: number): Promise<SpriteFrame | null>
```
异步加载拼图图片。

**参数**:
- `puzzleId: number` - 拼图ID

**返回值**: `Promise<SpriteFrame | null>` - 加载的SpriteFrame Promise

**特性**:
- 支持缓存检查，避免重复加载
- 支持并发控制，相同ID的加载请求会共享Promise
- 自动错误处理和清理

### generatePuzzlePieces
```typescript
public generatePuzzlePieces(puzzleId: number, rows: number, cols: number): SpriteFrame[]
```
生成拼图切片，使用基于文档的精确算法。

**参数**:
- `puzzleId: number` - 拼图ID
- `rows: number` - 行数
- `cols: number` - 列数

**返回值**: `SpriteFrame[]` - 拼图切片数组

**算法特点**:
- 基于《第2版.md》文档的精确计算逻辑
- 以384x384为基准图片，支持任意尺寸缩放
- 支持3x3、4x4、5x5等不同难度
- 区分角落、边缘、中间切片的不同尺寸
- 使用缓存机制提高性能

**切片类型**:
- **角落切片**: 四个角落，尺寸为 `edgeSize x edgeSize`
- **边缘切片**: 边缘非角落，上下边缘为 `centerSize x edgeSize`，左右边缘为 `edgeSize x centerSize`
- **中间切片**: 完全被包围，尺寸为 `centerSize x centerSize`

### getPuzzleName
```typescript
public getPuzzleName(puzzleId: number): string
```
获取拼图显示名称。

**参数**:
- `puzzleId: number` - 拼图ID

**返回值**: `string` - 拼图名称

### preloadPuzzlePieces
```typescript
public preloadPuzzlePieces(puzzleId: number, rows: number, cols: number): void
```
预加载拼图切片，用于性能优化。

**参数**:
- `puzzleId: number` - 拼图ID
- `rows: number` - 行数
- `cols: number` - 列数

**特性**:
- 异步执行，不阻塞主线程
- 使用 `scheduleOnce` 延迟执行

### clearPieceCache
```typescript
public clearPieceCache(puzzleId?: number): void
```
清理拼图切片缓存。

**参数**:
- `puzzleId?: number` - 可选，指定要清理的拼图ID。如果不提供，清理所有缓存

### clearCache
```typescript
public clearCache(): void
```
清理所有缓存，包括切片缓存、动态图片缓存和加载Promise缓存。

### getResourceStats
```typescript
public getResourceStats(): { totalPuzzles: number, cachedPieces: number }
```
获取资源统计信息。

**返回值**: 
```typescript
{
    totalPuzzles: number,    // 总拼图数量
    cachedPieces: number     // 已缓存的切片规格数量
}
```

## 私有方法

### loadImageFromURL
```typescript
private async loadImageFromURL(puzzleId: number, url: string): Promise<SpriteFrame>
```
从URL加载图片的内部实现。

**参数**:
- `puzzleId: number` - 拼图ID
- `url: string` - 图片URL

**返回值**: `Promise<SpriteFrame>` - 加载的SpriteFrame Promise

## 生命周期方法

### onLoad
```typescript
onLoad(): void
```
组件加载时调用，初始化单例实例。

### start
```typescript
start(): void
```
组件启动时调用，输出初始化完成日志。

### update
```typescript
update(deltaTime: number): void
```
每帧更新，当前为空实现。

## 使用示例

### 基本使用
```typescript
// 获取管理器实例
const manager = PuzzleResourceManager.instance;

// 生成3x3拼图切片
const pieces = manager.generatePuzzlePieces(1, 3, 3);

// 异步加载拼图图片
const spriteFrame = await manager.loadPuzzleImageAsync(1);

// 预加载切片
manager.preloadPuzzlePieces(1, 4, 4);

// 获取统计信息
const stats = manager.getResourceStats();
console.log(`总拼图数: ${stats.totalPuzzles}, 缓存切片: ${stats.cachedPieces}`);
```

### 缓存管理
```typescript
// 清理特定拼图的缓存
manager.clearPieceCache(1);

// 清理所有缓存
manager.clearCache();
```

## 依赖关系

### 导入模块
```typescript
import { _decorator, Component, SpriteFrame, Texture2D, ImageAsset, Size, Vec2, Rect, assetManager } from 'cc';
import { GameDataPuzzle, PuzzleStatus } from './GameDataPuzzle';
```

### 依赖组件
- **GameDataPuzzle**: 拼图数据管理器，提供拼图配置和URL信息

## 性能特性

### 缓存策略
- **多层缓存**: 切片缓存、图片缓存、Promise缓存
- **智能缓存**: 相同规格的切片只计算一次
- **内存管理**: 提供缓存清理接口

### 性能优化
- **异步加载**: 不阻塞主线程
- **并发控制**: 防止重复加载
- **预加载支持**: 提前生成切片

### 适用场景
- **微信小游戏**: 针对小游戏平台优化
- **多难度支持**: 3x3到10x10理论无上限
- **多尺寸图片**: 自动缩放适配

## 注意事项

1. **单例模式**: 确保全局只有一个实例
2. **内存管理**: 及时清理不需要的缓存
3. **错误处理**: 所有异步操作都包含错误处理
4. **类型安全**: 使用TypeScript严格类型检查
5. **日志输出**: 详细的调试日志便于问题排查

## 版本信息

- **引擎版本**: Cocos Creator 3.8.6
- **TypeScript**: ESNext
- **目标平台**: 微信小游戏