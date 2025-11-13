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
    if (this._isPaused || this._isDestroyed) {
        return;
    }

    // 检查是否有可用的下载槽位
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
private readonly MAX_RETRY_COUNT = 1;
private readonly RETRY_DELAY_BASE = 150;

private handleDownloadError(task: DownloadTask, errorMessage: string): void {
    task.error = errorMessage;
    
    // 从活跃下载中移除
    this._activeDownloads.delete(task.id);
    
    // 检查是否需要重试
    if (task.retryCount < this.MAX_RETRY_COUNT) {
        task.retryCount++;
        task.status = DownloadTaskStatus.PENDING;
        
        // 计算重试延迟
        const delay = this.RETRY_DELAY_BASE * Math.pow(2, task.retryCount - 1);
        
        console.log(`任务 ${task.id} 将在 ${delay}ms 后重试 (${task.retryCount}/${this.MAX_RETRY_COUNT})`);
        
        // 延迟后重新加入队列
        setTimeout(() => {
            if (!this._isDestroyed) {
                this._downloadQueue.push(task);
                this.sortDownloadQueue();
                this.processDownloadQueue();
            }
        }, delay);
    } else {
        // 重试次数用尽，标记为失败
        task.status = DownloadTaskStatus.FAILED;
        console.error(`任务 ${task.id} 下载失败，重试次数用尽: ${errorMessage}`);
        this.notifyError(task, errorMessage);
    }
    
    // 继续处理队列
    this.processDownloadQueue();
}
```

#### 持久化存储
```typescript
private readonly DOWNLOAD_RECORDS_KEY = 'CuteAnimalPuzzle_DownloadRecords';

private saveDownloadRecords(): void {
    try {
        const records = {
            completedTasks: Array.from(this._completedTasks.entries()),
            timestamp: Date.now()
        };
        const recordsStr = JSON.stringify(records);
        sys.localStorage.setItem(this.DOWNLOAD_RECORDS_KEY, recordsStr);
        console.log(`已保存 ${this._completedTasks.size} 个下载记录`);
    } catch (error) {
        console.error('保存下载记录失败:', error);
    }
}

private loadDownloadRecords(): void {
    try {
        const recordsStr = sys.localStorage.getItem(this.DOWNLOAD_RECORDS_KEY);
        if (recordsStr) {
            const records = JSON.parse(recordsStr);
            
            // 验证记录格式
            if (records.completedTasks && Array.isArray(records.completedTasks)) {
                this._completedTasks = new Map(records.completedTasks);
                
                // 验证缓存文件是否仍然存在
                this.validateCompletedTasks();
                
                console.log(`恢复了 ${this._completedTasks.size} 个下载记录`);
            }
        }
    } catch (error) {
        console.error('加载下载记录失败:', error);
        this._completedTasks.clear();
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

#### PuzzleAudio单例实现
```typescript
@ccclass('PuzzleAudio')
export class PuzzleAudio extends Component {
    private static _instance: PuzzleAudio = null;
    
    public static get instance(): PuzzleAudio {
        return PuzzleAudio._instance;
    }
    
    onLoad() {
        if (PuzzleAudio._instance === null) {
            PuzzleAudio._instance = this;
            // 初始化音频资源
            this.initAudioResources();
        } else {
            this.destroy();
        }
    }
    
    private initAudioResources(): void {
        // 初始化按钮点击音效、拼图放置音效、完成庆祝音效等
        this.buttonClickSound = this.audioClipButton;
        this.puzzlePlaceSound = this.audioClipPuzzlePlace;
        this.puzzleCompleteSound = this.audioClipComplete;
        this.backgroundMusic = this.audioClipBgm;
    }
    
    public playButtonClickSound(): void {
        if (this.getSoundEnabled()) {
            AudioMgr.inst.playOneShot(this.buttonClickSound);
        }
    }
    
    public onSoundStateChanged(enabled: boolean): void {
        // 处理音频状态变化
        if (!enabled) {
            AudioMgr.inst.stop();
        } else {
            this.playBackgroundMusic();
        }
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

## 已知技术问题

### 1. 图片下载问题
- 部分环境下图片下载失败
- 需要优化网络检测和错误处理
- 建议添加版本文件检测机制

### 2. 拼图切片黑线问题
- 拼图切片之间存在黑线
- 可能是遮罩或切片算法问题
- 需要检查切片生成逻辑

### 3. 拖拽体验优化
- 手机端拖拽需要Y轴自动偏移约150像素
- 当前拖拽体验不够流畅
- 需要优化触摸事件处理

### 4. 分享功能优化
- 当前分享使用屏幕截图
- 应改为直接使用图片URL
- 需要优化分享机制

### 5. 拼图进度保存
- 当前只保存完成状态
- 需要保存当前拼图的位置状态
- 实现更细粒度的进度管理

### 6. 下载管理优化
- 下载任务持久化可能存在数据丢失风险
- 需要优化文件完整性验证
- 下载队列管理可以更加高效

## 技术解决方案

### 1. 图片下载优化方案
```typescript
// 建议的版本检测机制
private async checkVersionAndDownload(): Promise<void> {
    try {
        const versionResponse = await fetch(this.VERSION_URL);
        const versionData = await versionResponse.json();
        
        if (versionData.version > this.currentVersion) {
            // 下载新版本资源
            await this.downloadNewResources(versionData.resources);
        }
    } catch (error) {
        console.error('版本检查失败:', error);
        // 使用离线模式
        this.enableOfflineMode();
    }
}
```

### 2. 拼图切片黑线修复
```typescript
// 建议的切片生成优化
private generatePuzzlePiecesOptimized(puzzleId: number, rows: number, cols: number): SpriteFrame[] {
    // 增加边缘重叠处理
    const overlap = 1; // 1像素重叠
    const pieceWidth = (texture.width + overlap * (cols - 1)) / cols;
    const pieceHeight = (texture.height + overlap * (rows - 1)) / rows;
    
    // 生成切片时考虑重叠区域
    // ...
}
```

### 3. 拖拽体验优化
```typescript
// 建议的拖拽优化
private optimizeDragForMobile(): void {
    if (this.isMobile()) {
        // 手机端Y轴自动偏移
        this.dragOffsetY = 150;
        
        // 优化触摸响应
        this.touchThreshold = 10;
    }
}
```

### 4. 分享功能优化
```typescript
// 建议的分享优化
private async shareWithDirectImage(): Promise<void> {
    try {
        const imageUrl = await this.getPuzzleImageUrl();
        wx.shareAppMessage({
            title: '我完成了一个可爱动物拼图！',
            imageUrl: imageUrl // 直接使用图片URL
        });
    } catch (error) {
        console.error('分享失败:', error);
        // 降级到屏幕截图
        this.shareWithScreenshot();
    }
}
```

### 5. 拼图进度保存
```typescript
// 建议的进度保存机制
interface PuzzleProgress {
    puzzleId: number;
    piecePositions: { [pieceIndex: number]: { x: number, y: number } };
    completedPieces: number[];
    timestamp: number;
}

private savePuzzleProgress(): void {
    const progress: PuzzleProgress = {
        puzzleId: this.currentPuzzleId,
        piecePositions: this.getPiecePositions(),
        completedPieces: this.getCompletedPieces(),
        timestamp: Date.now()
    };
    
    // 保存到本地存储
    sys.localStorage.setItem(`puzzle_progress_${this.currentPuzzleId}`, JSON.stringify(progress));
}