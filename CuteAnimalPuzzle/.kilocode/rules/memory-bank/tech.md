# CuteAnimalPuzzle 技术文档

## 技术栈概览

### 核心技术
- **游戏引擎**: Cocos Creator 3.8.6
- **编程语言**: TypeScript (ESNext)
- **目标平台**: 微信小游戏
- **架构模式**: 单例模式 + 组件模式 + 模块化架构

### 开发环境
- **操作系统**: Windows 10
- **开发工具**: Cocos Creator 3.8.6
- **版本控制**: Git
- **TypeScript配置**: strict 模式关闭

## 技术架构详解

### 1. 引擎配置
```json
// package.json
{
  "name": "CuteAnimalPuzzle",
  "uuid": "f41842b9-8769-4555-a009-d7b910817469",
  "creator": {
    "version": "3.8.6"
  }
}

// tsconfig.json
{
  "compilerOptions": {
    "strict": false
  }
}
```

### 2. 项目结构
```
assets/
├── CuteAnimalPuzzle/          # 主资源包
│   ├── GameScripts/          # 游戏逻辑脚本
│   ├── GameScenes/           # 游戏场景
│   ├── GameSounds/           # 音频资源
│   ├── PuzzlePrefabs/        # 拼图预制体
│   ├── PuzzleSprites/        # 拼图图片
│   └── UITextures/          # UI纹理
├── Scripts/                  # 通用脚本
└── Loading.scene             # 启动场景
```

### 3. Bundle分包策略
- **主包**: Loading场景和核心脚本
- **CuteAnimalPuzzle包**: 游戏主要资源和场景
- **动态加载**: 拼图图片按需下载

## 核心系统实现

### 1. 数据管理系统 (GameDataPuzzle)

#### 单例模式实现
```typescript
export class GameDataPuzzle extends Component {
    private static _instance: GameDataPuzzle = null;
    
    public static get instance(): GameDataPuzzle {
        return GameDataPuzzle._instance;
    }
    
    onLoad() {
        if (GameDataPuzzle._instance === null) {
            GameDataPuzzle._instance = this;
        } else {
            this.destroy();
        }
    }
}
```

#### 数据持久化
```typescript
interface SaveData {
    soundEnabled: boolean;
    puzzleStatus: { [puzzleId: string]: PuzzleStatus };
    currentDifficulty: PuzzleDifficulty;
    selectedPuzzleId: string;
}

private saveData(): void {
    const saveDataStr = JSON.stringify(this._saveData);
    sys.localStorage.setItem(this.SAVE_KEY, saveDataStr);
}
```

### 2. 资源管理系统

#### 动态图片加载
```typescript
public async loadImageFromURL(puzzleId: number, url: string): Promise<SpriteFrame | null> {
    const fullUrl = this.URL_PREFIX + this.PUZZLE_DIR + this.PUZZLE_PREFIX + url + this.PUZZLE_SUFFIX;
    
    return new Promise((resolve) => {
        wx.downloadFile({
            url: fullUrl,
            success: (res) => {
                if (res.statusCode === 200) {
                    this.loadImageFromLocalPath(res.tempFilePath, puzzleId)
                        .then(() => resolve(this.getPuzzleSpriteFrame(puzzleId)));
                }
            }
        });
    });
}
```

#### 拼图切片生成算法
```typescript
public generatePuzzlePieces(puzzleId: number, rows: number, cols: number): SpriteFrame[] {
    const originalSpriteFrame = this.getPuzzleSpriteFrame(puzzleId);
    const texture = originalSpriteFrame.texture;
    
    // 基于精确参数表格的计算体系
    const difficulty = Math.max(rows, cols);
    const maskSquareSide = Math.round(PuzzleRealLength / difficulty);
    const maskSemiCircleRadius = Math.ceil(maskSquareSide / maskRefSquareSide * maskRefSemiCircleRadius);
    
    // 生成切片逻辑...
    return pieces;
}
```

### 3. 下载管理系统 (PuzzleDownloadManager)

#### 并发控制
```typescript
private readonly MAX_CONCURRENT_DOWNLOADS = 3;

private processDownloadQueue(): void {
    const availableSlots = this.MAX_CONCURRENT_DOWNLOADS - this._activeDownloads.size;
    if (availableSlots <= 0) return;
    
    const pendingTasks = this._downloadQueue.filter(task => task.status === DownloadTaskStatus.PENDING);
    const tasksToStart = pendingTasks.slice(0, availableSlots);
    
    for (const task of tasksToStart) {
        this.startDownloadTask(task);
    }
}
```

#### 重试机制
```typescript
private handleDownloadError(task: DownloadTask, errorMessage: string): void {
    if (task.retryCount < this.MAX_RETRY_COUNT) {
        task.retryCount++;
        task.status = DownloadTaskStatus.PENDING;
        
        const delay = this.RETRY_DELAY_BASE * Math.pow(2, task.retryCount - 1);
        setTimeout(() => {
            this._downloadQueue.push(task);
            this.processDownloadQueue();
        }, delay);
    }
}
```

### 4. 音频管理系统

#### AudioMgr单例实现
```typescript
export class AudioMgr {
    private static _inst: AudioMgr;
    
    public static get inst(): AudioMgr {
        if (this._inst == null) {
            this._inst = new AudioMgr();
        }
        return this._inst;
    }
    
    constructor() {
        const audioMgr = new Node();
        audioMgr.name = '__audioMgr__';
        director.getScene().addChild(audioMgr);
        director.addPersistRootNode(audioMgr);
        this._audioSource = audioMgr.addComponent(AudioSource);
    }
}
```

### 5. UI管理系统

#### 界面切换控制
```typescript
public showMainMenuOnly(): void {
    this.UIMainMenu.active = true;
    this.UISelectPuzzleGroup.active = false;
    this.UISelectDifAndPuzzle.active = false;
    this.UISolvePuzzle.active = false;
    this.UIFinishPuzzle.active = false;
    
    if (this.uiMainMenu) {
        this.uiMainMenu.onShow();
    }
    
    this.updateAllSoundButtonStates();
}
```

## 微信小游戏集成

### 1. 平台检测
```typescript
function isWeChatMiniGame(): boolean {
    return typeof wx !== 'undefined' && wx.getSystemInfoSync;
}
```

### 2. 文件系统使用
```typescript
private initFileSystem(): void {
    if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
        this.fileSystemManager = wx.getFileSystemManager();
        this.ensureCacheDirectory();
    }
}
```

### 3. 分享功能
```typescript
public onShareButtonClick() {
    if (typeof wx === 'undefined') return;
    
    wx.shareAppMessage({
        title: this.shareConfig.title,
        imageUrl: this.shareConfig.imageUrl,
        query: this.shareConfig.query,
        success: () => console.log("分享成功"),
        fail: (err) => console.error("分享失败:", err)
    });
}
```

## 性能优化策略

### 1. 内存管理
- **对象池**: 频繁创建的对象使用对象池
- **资源释放**: 及时释放不需要的资源
- **缓存控制**: LRU算法控制缓存大小

### 2. 加载优化
- **异步加载**: 所有资源采用异步加载
- **分包加载**: 按需加载减少初始包体积
- **并发控制**: 限制同时下载数量

### 3. 渲染优化
- **纹理压缩**: 合理的纹理格式和压缩
- **批处理**: 减少DrawCall数量
- **遮罩优化**: 高效的拼图遮罩实现

## 错误处理机制

### 1. 异步操作错误处理
```typescript
public async loadImageFromURL(puzzleId: number, url: string): Promise<SpriteFrame | null> {
    try {
        const result = await this.downloadAndCacheImage(url);
        return result;
    } catch (error) {
        console.error(`加载拼图 ${puzzleId} 失败:`, error);
        return null;
    }
}
```

### 2. 参数验证
```typescript
public setPuzzleStatus(puzzleId: number, status: PuzzleStatus): void {
    if (puzzleId < 0) {
        console.error('拼图ID不能为负数');
        return;
    }
    
    if (!Object.values(PuzzleStatus).includes(status)) {
        console.error('无效的拼图状态值');
        return;
    }
    
    this._saveData.puzzleStatuses[puzzleId] = status;
    this.saveData();
}
```

## 调试和监控

### 1. 日志系统
```typescript
console.log(`[GameDataPuzzle] 拼图 ${puzzleId} 下载完成`);
console.error(`[PuzzleDownloadManager] 下载失败: ${error}`);
```

### 2. 性能监控
```typescript
public getResourceStats(): { totalPuzzles: number, cachedPieces: number } {
    let cachedCount = 0;
    for (const cache of this.pieceCache.values()) {
        cachedCount += cache.size;
    }
    
    return {
        totalPuzzles: gameData ? gameData.getTotalPuzzleCount() : 0,
        cachedPieces: cachedCount
    };
}
```

## 部署配置

### 1. 构建配置
- **目标平台**: 微信小游戏
- **压缩选项**: 启用代码压缩和资源压缩
- **分包策略**: 核心逻辑主包，资源文件分包

### 2. 域名配置
```
微信小游戏后台需要配置的域名：
- downloadFile合法域名: https://cdn.jsdelivr.net
```

### 3. 权限配置
```
隐私权限设置：
- scope.writePhotosAlbum: 保存图片到相册
- scope.userInfo: 用户信息（可选）
```

## 扩展性设计

### 1. 新增拼图组
```typescript
// 在GameDataPuzzle中配置
puzzleGroupID: number[] = [1, 1, 1, 2, 2, 2, 3, 3, 3, 3];
```

### 2. 新增难度等级
```typescript
enum PuzzleDifficulty {
    EASY = 9,
    MEDIUM = 16,
    HARD = 25,
    EXPERT = 36  // 新增难度
}
```

### 3. 新增UI界面
```typescript
@ccclass('UINewFeature')
export class UINewFeature extends Component {
    onShow(): void { }
    onHide(): void { }
}
```

## 技术债务和改进点

### 1. 当前限制
- TypeScript strict模式关闭
- 部分硬编码配置
- 错误处理可以更完善

### 2. 改进建议
- 启用TypeScript严格模式
- 配置文件外部化
- 增加单元测试
- 优化内存使用

### 3. 未来技术升级
- 升级到最新版本的Cocos Creator
- 引入状态管理库
- 添加自动化测试
- 实现热更新机制