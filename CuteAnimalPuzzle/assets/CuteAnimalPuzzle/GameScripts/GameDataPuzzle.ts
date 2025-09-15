import { _decorator, Component, sys, SpriteFrame, Enum, assetManager, ImageAsset, Texture2D, CCInteger, CCString } from 'cc';
const { ccclass, property } = _decorator;

// 声明微信API类型
declare const wx: any;

// 拼图状态枚举
export enum PuzzleStatus {
    UNAVAILABLE = 0,  // 未开放
    LOCKED = 1,       // 未解锁
    UNLOCKED = 2,     // 已解锁未完成
    COMPLETED = 3     // 已完成
}

// 拼图难度枚举
export enum PuzzleDifficulty {
    EASY = 9,     // 9张拼图
    MEDIUM = 16,  // 16张拼图
    HARD = 25     // 25张拼图
}

// 存档数据接口
interface SaveData {
    soundEnabled: boolean;                    // 游戏是否开启了声音
    puzzleStatus: { [puzzleId: string]: PuzzleStatus }; // 拼图状态映射
    currentDifficulty: PuzzleDifficulty;     // 当前选择的难度
    selectedPuzzleId: string;                // 当前选择的拼图ID
}

@ccclass('GameDataPuzzle')
export class GameDataPuzzle extends Component {
    private static _instance: GameDataPuzzle = null;
    private _saveData: SaveData = null;
    private readonly SAVE_KEY = 'CuteAnimalPuzzle_SaveData';

    private readonly WAIT_TIME: number = 0.3; // 等待时间（秒）
    private readonly CACHE_DIR = 'puzzle_cache'; // 缓存目录
    private readonly MAX_RETRY_COUNT = 3; // 最大重试次数
    private fileSystemManager: any = null; // 文件系统管理器
    private downloadingUrls: Set<string> = new Set(); // 正在下载的URL集合
    
    // 下载的URL前缀
    private readonly URL_PREFIX = 'https://cdn.jsdelivr.net/gh/TaiChiTeng/CuteAnimalPuzzle@master/';
    // 拼图图片目录
    private readonly PUZZLE_DIR = 'texPuzzles/';
    // 拼图图片文件名前缀
    private readonly PUZZLE_PREFIX = 'texPuzzle_';
    // 拼图图片文件名后缀
    private readonly PUZZLE_SUFFIX = '.png';
    
    // 拼图配置数据结构
    @property({ type: [SpriteFrame], displayName: "拼图图片列表" })
    public puzzleSpriteFrames: SpriteFrame[] = [];
    
    @property({ type: [Enum(PuzzleStatus)], displayName: "拼图初始状态" })
    public puzzleInitialStatus: PuzzleStatus[] = [];
    
    @property({ type: [CCInteger], displayName: "拼图组ID" })
    public puzzleGroupID: number[] = [];
    
    @property({ type: [CCString], displayName: "拼图URL" })
    public puzzleURL: string[] = [];

    public static get instance(): GameDataPuzzle {
        return GameDataPuzzle._instance;
    }

    onLoad() {
        if (GameDataPuzzle._instance === null) {
            GameDataPuzzle._instance = this;
            this.initFileSystem();
            this.loadSaveData();
        } else {
            this.destroy();
        }
    }

    start() {
        // 初始化默认数据
        this.initDefaultData();
    }

    /**
     * 初始化文件系统
     */
    private initFileSystem(): void {
        if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
            this.fileSystemManager = wx.getFileSystemManager();
            console.log('[GameDataPuzzle] 微信文件系统管理器初始化成功');
            
            // 确保缓存目录存在
            this.ensureCacheDirectory();
        } else {
            console.warn('[GameDataPuzzle] 微信API不可用，将使用默认图片加载方式');
        }
    }

    /**
     * 确保缓存目录存在
     */
    private ensureCacheDirectory(): void {
        if (!this.fileSystemManager) return;
        
        const cachePath = `${wx.env.USER_DATA_PATH}/${this.CACHE_DIR}`;
        try {
            this.fileSystemManager.accessSync(cachePath);
            console.log('[GameDataPuzzle] 缓存目录已存在');
        } catch (error) {
            try {
                this.fileSystemManager.mkdirSync(cachePath, true);
                console.log('[GameDataPuzzle] 缓存目录创建成功');
            } catch (mkdirError) {
                console.error('[GameDataPuzzle] 创建缓存目录失败:', mkdirError);
            }
        }
    }

    /**
     * 初始化默认数据
     */
    private initDefaultData(): void {
        console.log('[GameDataPuzzle] puzzleInitialStatus数据:', this.puzzleInitialStatus);
        if (!this._saveData) {
            this._saveData = {
                soundEnabled: true,
                puzzleStatus: {},
                currentDifficulty: PuzzleDifficulty.EASY,
                selectedPuzzleId: ''
            };
            
            // 初始化拼图状态，使用配置的初始状态数组
            const totalPuzzles = this.puzzleSpriteFrames.length;
            for (let i = 1; i <= totalPuzzles; i++) {
                const puzzleId = i.toString();
                const arrayIndex = i - 1; // 数组索引从0开始
                if (arrayIndex < this.puzzleInitialStatus.length) {
                    this._saveData.puzzleStatus[puzzleId] = this.puzzleInitialStatus[arrayIndex];
                } else {
                    // 如果没有配置初始状态，默认第一个解锁，其他锁定
                    this._saveData.puzzleStatus[puzzleId] = i === 1 ? PuzzleStatus.UNLOCKED : PuzzleStatus.LOCKED;
                }
            }
            
            this.saveData();
        }
    }

    /**
     * 加载存档数据
     */
    private loadSaveData(): void {
        console.log('[GameDataPuzzle] 开始加载存档数据');
        try {
            const saveDataStr = sys.localStorage.getItem(this.SAVE_KEY);
            if (saveDataStr) {
                this._saveData = JSON.parse(saveDataStr);
                console.log('[GameDataPuzzle] 存档数据加载成功:', this._saveData);
            } else {
                console.log('[GameDataPuzzle] 未找到存档数据，将使用默认数据');
            }
        } catch (error) {
            console.error('[GameDataPuzzle] 加载存档数据失败:', error);
            this._saveData = null;
        }
    }

    /**
     * 保存存档数据
     */
    public saveData(): void {
        console.log('[GameDataPuzzle] 开始保存存档数据:', this._saveData);
        try {
            const saveDataStr = JSON.stringify(this._saveData);
            sys.localStorage.setItem(this.SAVE_KEY, saveDataStr);
            console.log('[GameDataPuzzle] 存档数据保存成功');
        } catch (error) {
            console.error('[GameDataPuzzle] 保存存档数据失败:', error);
        }
    }

    // ========== 声音设置相关 ==========
    
    /**
     * 获取声音开启状态
     */
    public getSoundEnabled(): boolean {
        return this._saveData?.soundEnabled ?? true;
    }

    /**
     * 设置声音开启状态
     */
    public setSoundEnabled(enabled: boolean): void {
        if (this._saveData) {
            this._saveData.soundEnabled = enabled;
            this.saveData();
        }
    }

    // ========== 拼图状态相关 ==========
    
    /**
     * 获取拼图状态
     */
    public getPuzzleStatus(puzzleId: number): PuzzleStatus {
        const key = puzzleId.toString();
        return this._saveData?.puzzleStatus[key] ?? this.getInitialPuzzleStatus(puzzleId);
    }

    /**
     * 设置拼图状态
     */
    public setPuzzleStatus(puzzleId: number, status: PuzzleStatus): void {
        if (this._saveData) {
            const key = puzzleId.toString();
            this._saveData.puzzleStatus[key] = status;
            this.saveData();
        }
    }

    /**
     * 设置图片加载成功后的拼图状态
     * 根据需求文档：检查存档，如果是UNAVAILABLE则设置为UNLOCKED；否则使用存档状态或初始状态
     */
    public setPuzzleStatusAfterImageLoad(puzzleId: number): void {
        if (!this._saveData) return;
        
        const currentStatus = this.getPuzzleStatus(puzzleId);
        
        // 如果当前状态是UNAVAILABLE，则设置为UNLOCKED并更新存档
        if (currentStatus === PuzzleStatus.UNAVAILABLE) {
            this.setPuzzleStatus(puzzleId, PuzzleStatus.UNLOCKED);
            console.log(`[GameDataPuzzle] 拼图${puzzleId}从UNAVAILABLE更新为UNLOCKED`);
        } else {
            // 否则保持存档中的状态，如果没有存档则使用初始状态
            const index = puzzleId - 1;
            if (index >= 0 && index < this.puzzleInitialStatus.length) {
                const initialStatus = this.puzzleInitialStatus[index];
                // 如果存档中没有该拼图的记录，使用初始状态
                const key = puzzleId.toString();
                if (!(key in this._saveData.puzzleStatus)) {
                    this.setPuzzleStatus(puzzleId, initialStatus);
                    console.log(`[GameDataPuzzle] 拼图${puzzleId}设置为初始状态: ${PuzzleStatus[initialStatus]}`);
                } else {
                    console.log(`[GameDataPuzzle] 拼图${puzzleId}保持存档状态: ${PuzzleStatus[currentStatus]}`);
                }
            }
        }
    }

    /**
     * 完成拼图，解锁下一个拼图
     * 根据需求文档：只解锁同组里边第一个LOCKED的拼图
     */
    public completePuzzle(puzzleId: number): void {
        console.log('[GameDataPuzzle] 完成拼图:', puzzleId);
        if (this._saveData) {
            // 设置当前拼图为已完成
            this.setPuzzleStatus(puzzleId, PuzzleStatus.COMPLETED);
            console.log('[GameDataPuzzle] 拼图', puzzleId, '状态已设置为完成');
            
            // 获取当前拼图的组ID
            const currentGroupId = this.getPuzzleGroupId(puzzleId);
            
            // 获取同组的所有拼图ID
            const sameGroupPuzzleIds = this.getPuzzleIdsByGroup(currentGroupId);
            
            // 在同组中找到ID最小的锁定拼图并解锁
            let foundLockedPuzzle = false;
            for (const id of sameGroupPuzzleIds.sort((a, b) => a - b)) {
                if (this.getPuzzleStatus(id) === PuzzleStatus.LOCKED) {
                    this.setPuzzleStatus(id, PuzzleStatus.UNLOCKED);
                    console.log(`[GameDataPuzzle] 解锁同组(${currentGroupId})内ID最小的锁定拼图:`, id);
                    foundLockedPuzzle = true;
                    break;
                }
            }
            
            if (!foundLockedPuzzle) {
                console.log(`[GameDataPuzzle] 在组${currentGroupId}中没有找到锁定的拼图，该组可能已完成所有拼图！`);
            }
        } else {
            console.error('[GameDataPuzzle] 存档数据未初始化，无法完成拼图');
        }
    }

    /**
     * 获取可用的拼图ID列表
     */
    public getAvailablePuzzleIds(): number[] {
        return Array.from({ length: this.getTotalPuzzleCount() }, (_, i) => i + 1);
    }
    
    /**
     * 获取拼图总数
     */
    public getTotalPuzzleCount(): number {
        return this.puzzleSpriteFrames.length;
    }
    
    /**
     * 获取拼图的SpriteFrame
     */
    public getPuzzleSpriteFrame(puzzleId: number): SpriteFrame | null {
        const index = puzzleId - 1; // 转换为数组索引
        return this.puzzleSpriteFrames[index] || null;
    }
    
    /**
     * 获取拼图的初始状态
     */
    private getInitialPuzzleStatus(puzzleId: number): PuzzleStatus {
        const index = puzzleId - 1; // 转换为数组索引
        return this.puzzleInitialStatus[index] || PuzzleStatus.LOCKED;
    }
    
    /**
     * 获取拼图的组ID
     */
    public getPuzzleGroupId(puzzleId: number): number {
        const index = puzzleId - 1; // 转换为数组索引
        return this.puzzleGroupID[index] || 0; // 默认为第0组
    }
    
    /**
     * 获取拼图的URL
     */
    public getPuzzleURL(puzzleId: number): string {
        const index = puzzleId - 1; // 转换为数组索引
        return this.puzzleURL[index] || '';
    }
    
    /**
     * 获取所有拼图组的数量
     */
    public getPuzzleGroupCount(): number {
        const groupIds = new Set<number>();
        for (let i = 1; i <= this.getTotalPuzzleCount(); i++) {
            groupIds.add(this.getPuzzleGroupId(i));
        }
        return groupIds.size;
    }
    
    /**
     * 获取指定组的拼图ID列表
     */
    public getPuzzleIdsByGroup(groupId: number): number[] {
        const puzzleIds: number[] = [];
        for (let i = 1; i <= this.getTotalPuzzleCount(); i++) {
            if (this.getPuzzleGroupId(i) === groupId) {
                puzzleIds.push(i);
            }
        }
        return puzzleIds;
    }
    
    /**
     * 获取所有组ID列表
     */
    public getAllGroupIds(): number[] {
        const groupIds = new Set<number>();
        for (let i = 1; i <= this.getTotalPuzzleCount(); i++) {
            groupIds.add(this.getPuzzleGroupId(i));
        }
        return Array.from(groupIds).sort((a, b) => a - b);
    }

    // ========== 难度设置相关 ==========
    
    /**
     * 获取当前难度
     */
    public getCurrentDifficulty(): PuzzleDifficulty {
        return this._saveData?.currentDifficulty ?? PuzzleDifficulty.EASY;
    }

    /**
     * 设置当前难度
     */
    public setCurrentDifficulty(difficulty: PuzzleDifficulty): void {
        if (this._saveData) {
            this._saveData.currentDifficulty = difficulty;
            this.saveData();
        }
    }

    // ========== 选择拼图相关 ==========
    
    /**
     * 获取当前选择的拼图ID
     */
    public getSelectedPuzzleId(): number {
        return parseInt(this._saveData?.selectedPuzzleId) || 1;
    }

    /**
     * 设置当前选择的拼图ID
     */
    public setSelectedPuzzleId(puzzleId: number): void {
        if (this._saveData) {
            this._saveData.selectedPuzzleId = puzzleId.toString();
            this.saveData();
        }
    }

    /**
     * 获取拼图的网格尺寸（根据难度）
     */
    public getPuzzleGridSize(difficulty?: PuzzleDifficulty): { rows: number, cols: number } {
        const diff = difficulty ?? this.getCurrentDifficulty();
        switch (diff) {
            case PuzzleDifficulty.EASY:
                return { rows: 3, cols: 3 };
            case PuzzleDifficulty.MEDIUM:
                return { rows: 4, cols: 4 };
            case PuzzleDifficulty.HARD:
                return { rows: 5, cols: 5 };
            default:
                return { rows: 3, cols: 3 };
        }
    }

    /**
     * 初始化拼图数据（用于UIMainMenu的加载流程）
     */
    public async initializePuzzleData(): Promise<void> {
        console.log('[GameDataPuzzle] 开始初始化拼图数据');
        
        // 确保存档数据已初始化
        if (!this._saveData) {
            this.initDefaultData();
        }
        
        // 检查并处理动态图片URL
        await this.processDynamicPuzzleImages();
        
        console.log('[GameDataPuzzle] 拼图数据初始化完成');
    }
    
    /**
     * 处理动态拼图图片
     */
    private async processDynamicPuzzleImages(): Promise<void> {
        const totalPuzzles = this.getTotalPuzzleCount();
        
        for (let puzzleId = 1; puzzleId <= totalPuzzles; puzzleId++) {
            const index = puzzleId - 1;
            
            // 检查是否有预设的SpriteFrame
            const hasSpriteFrame = this.puzzleSpriteFrames[index] && this.puzzleSpriteFrames[index];
            const hasURL = this.puzzleURL[index] && this.puzzleURL[index].trim() !== '';
            
            if (!hasSpriteFrame && hasURL) {
                // 没有预设SpriteFrame但有URL，需要动态加载
                console.log(`[GameDataPuzzle] 拼图 ${puzzleId} 需要动态加载: ${this.puzzleURL[index]}`);
                
                try {
                    const spriteFrame = await this.loadImageFromURL(puzzleId, this.puzzleURL[index]);
                    if (spriteFrame) {
                        console.log(`[GameDataPuzzle] 拼图 ${puzzleId} 动态加载成功`);
                        // 状态已在loadImageFromURL中通过setPuzzleStatusAfterImageLoad设置
                    } else {
                        console.warn(`[GameDataPuzzle] 拼图 ${puzzleId} 动态加载失败`);
                        this.setPuzzleStatus(puzzleId, PuzzleStatus.UNAVAILABLE);
                    }
                } catch (error) {
                    console.warn(`[GameDataPuzzle] 拼图 ${puzzleId} 动态加载异常:`, error);
                    this.setPuzzleStatus(puzzleId, PuzzleStatus.UNAVAILABLE);
                }
            } else if (!hasSpriteFrame && !hasURL) {
                // 根据需求文档：没有SpriteFrame且没有URL，强行设置为UNAVAILABLE
                console.warn(`[GameDataPuzzle] 拼图 ${puzzleId} 既没有预设图片也没有URL，设置为UNAVAILABLE`);
                this.setPuzzleStatus(puzzleId, PuzzleStatus.UNAVAILABLE);
            } else if (hasSpriteFrame) {
                // 有预设的SpriteFrame，根据需求文档设置状态
                this.setPuzzleStatusAfterImageLoad(puzzleId);
                console.log(`[GameDataPuzzle] 拼图 ${puzzleId} 使用预设图片`);
                
                // 为预设SpriteFrame创建缓存文件（异步执行，不阻塞初始化）
                this.cacheSpriteFrameAsImage(puzzleId, this.puzzleSpriteFrames[index]).catch(error => {
                    console.warn(`[GameDataPuzzle] 预设拼图 ${puzzleId} 缓存创建失败:`, error);
                });
            }
        }
    }

    /**
     * 从URL加载图片并创建SpriteFrame
     */
    public async loadImageFromURL(puzzleId: number, url: string): Promise<SpriteFrame | null> {
        // 检查是否已有缓存
        const cachedPath = await this.getCachedImagePath(url);
        if (cachedPath) {
            console.log(`[GameDataPuzzle] 使用缓存图片: ${cachedPath}`);
            const success = await this.loadImageFromLocalPath(cachedPath, puzzleId);
            
            // 使用缓存图片成功后，根据需求文档设置拼图状态
            if (success) {
                this.setPuzzleStatusAfterImageLoad(puzzleId);
            }
            
            return success ? this.getPuzzleSpriteFrame(puzzleId) : null;
        }

        // 下载并缓存图片
        const downloadedPath = await this.downloadAndCacheImage(url, puzzleId);
        if (downloadedPath) {
            const success = await this.loadImageFromLocalPath(downloadedPath, puzzleId);
            return success ? this.getPuzzleSpriteFrame(puzzleId) : null;
        }

        console.error(`[GameDataPuzzle] 图片加载失败: ${url}`);
        return null;
    }

    /**
     * 获取缓存图片路径
     */
    private async getCachedImagePath(url: string): Promise<string | null> {
        if (!this.fileSystemManager) return null;

        const fileName = this.getFileNameFromUrl(url);
        const cachePath = `${wx.env.USER_DATA_PATH}/${this.CACHE_DIR}/${fileName}`;

        try {
            this.fileSystemManager.accessSync(cachePath);
            return cachePath;
        } catch (error) {
            return null;
        }
    }

    /**
     * 为预设SpriteFrame创建缓存文件
     */
    private async cacheSpriteFrameAsImage(puzzleId: number, spriteFrame: SpriteFrame): Promise<string | null> {
        if (!this.fileSystemManager) {
            console.warn('[GameDataPuzzle] 文件系统管理器未初始化');
            return null;
        }

        try {
            // 生成缓存文件名
            const fileName = `preset_puzzle_${puzzleId}.png`;
            const cachePath = `${wx.env.USER_DATA_PATH}/${this.CACHE_DIR}/${fileName}`;

            // 检查缓存文件是否已存在
            try {
                const stats = this.fileSystemManager.statSync(cachePath);
                if (stats.isFile()) {
                    console.log(`[GameDataPuzzle] 预设拼图 ${puzzleId} 缓存文件已存在: ${cachePath}`);
                    return cachePath;
                }
            } catch (e) {
                // 文件不存在，继续创建
            }

            // 获取纹理数据
            const texture = spriteFrame.texture as Texture2D;
            if (!texture) {
                console.warn(`[GameDataPuzzle] 预设拼图 ${puzzleId} 无法获取纹理`);
                return null;
            }

            // 获取图像数据
            const imageAsset = texture.image as ImageAsset;
            if (!imageAsset) {
                console.warn(`[GameDataPuzzle] 预设拼图 ${puzzleId} 无法获取图像资源`);
                return null;
            }

            // 获取原始数据
            const nativeAsset = imageAsset.nativeAsset;
            if (!nativeAsset) {
                console.warn(`[GameDataPuzzle] 预设拼图 ${puzzleId} 无法获取原始资源`);
                return null;
            }

            // 创建Canvas来转换图片
            const canvas = wx.createCanvas();
            const ctx = canvas.getContext('2d');
            
            // 设置canvas尺寸
            canvas.width = imageAsset.width;
            canvas.height = imageAsset.height;
            
            // 绘制图片到canvas
            ctx.drawImage(nativeAsset, 0, 0);
            
            // 转换为base64
            const base64Data = canvas.toDataURL('image/png');
            
            // 移除base64前缀
            const imageData = base64Data.replace(/^data:image\/png;base64,/, '');
            
            // 保存到文件
            this.fileSystemManager.writeFileSync(cachePath, imageData, 'base64');
            
            console.log(`[GameDataPuzzle] 预设拼图 ${puzzleId} 缓存创建成功: ${cachePath}`);
            return cachePath;
            
        } catch (error) {
            console.error(`[GameDataPuzzle] 预设拼图 ${puzzleId} 缓存创建失败:`, error);
            return null;
        }
    }

    /**
     * 获取拼图的缓存图片路径（公共方法，供其他组件使用）
     * @param puzzleId 拼图ID
     * @returns 缓存图片路径，如果没有缓存则返回null
     */
    public async getPuzzleCachedImagePath(puzzleId: number): Promise<string | null> {
        const url = this.getPuzzleURL(puzzleId);
        if (!url || url.trim() === '') {
            // 检查是否有预设SpriteFrame
            const spriteFrame = this.getPuzzleSpriteFrame(puzzleId);
            if (spriteFrame) {
                // 为预设SpriteFrame创建缓存
                return await this.cacheSpriteFrameAsImage(puzzleId, spriteFrame);
            }
            return null;
        }
        return await this.getCachedImagePath(url);
    }

    /**
     * 下载并缓存图片
     */
    private async downloadAndCacheImage(url: string, puzzleId?: number, retryCount: number = 0): Promise<string | null> {
        if (!this.fileSystemManager || typeof wx === 'undefined') {
            console.warn('[GameDataPuzzle] 微信API不可用，无法下载图片');
            return null;
        }

        // 构建完整的URL用于下载管理
        const fullUrl = this.URL_PREFIX + this.PUZZLE_DIR + this.PUZZLE_PREFIX + url + this.PUZZLE_SUFFIX;

        // 防止重复下载
        if (this.downloadingUrls.has(fullUrl)) {
            console.log(`[GameDataPuzzle] 图片正在下载中: ${fullUrl}`);
            // 等待下载完成
            await new Promise(resolve => setTimeout(resolve, 1000));
            return await this.getCachedImagePath(url);
        }

        this.downloadingUrls.add(fullUrl);

        try {
            const fileName = this.getFileNameFromUrl(url);
            const cachePath = `${wx.env.USER_DATA_PATH}/${this.CACHE_DIR}/${fileName}`;

            console.log(`[GameDataPuzzle] 开始下载图片: ${fullUrl}`);

            return new Promise((resolve) => {
                const downloadTask = wx.downloadFile({
                    url: fullUrl,
                    success: (res: any) => {
                        if (res.statusCode === 200) {
                            // 保存到持久化存储
                            this.fileSystemManager.saveFile({
                                tempFilePath: res.tempFilePath,
                                filePath: cachePath,
                                success: () => {
                                    console.log(`[GameDataPuzzle] 图片缓存成功: ${cachePath}`);
                                    
                                    // 根据需求文档设置拼图状态
                                    if (puzzleId !== undefined) {
                                        this.setPuzzleStatusAfterImageLoad(puzzleId);
                                    }
                                    
                                    this.downloadingUrls.delete(fullUrl);
                                    resolve(cachePath);
                                },
                                fail: (error: any) => {
                                    console.error('[GameDataPuzzle] 图片缓存失败:', error);
                                    this.downloadingUrls.delete(fullUrl);
                                    resolve(null);
                                }
                            });
                        } else {
                            console.error(`[GameDataPuzzle] 下载失败，状态码: ${res.statusCode}`);
                            this.downloadingUrls.delete(fullUrl);
                            resolve(null);
                        }
                    },
                    fail: (error: any) => {
                        console.error('[GameDataPuzzle] 下载失败:', error);
                        this.downloadingUrls.delete(fullUrl);
                        
                        // 重试机制
                        if (retryCount < this.MAX_RETRY_COUNT) {
                            console.log(`[GameDataPuzzle] 重试下载 (${retryCount + 1}/${this.MAX_RETRY_COUNT}): ${url}`);
                            setTimeout(async () => {
                                const result = await this.downloadAndCacheImage(url, puzzleId, retryCount + 1);
                                resolve(result);
                            }, 1000 * (retryCount + 1)); // 递增延迟
                        } else {
                            resolve(null);
                        }
                    }
                });

                // 监听下载进度
                if (downloadTask && downloadTask.onProgressUpdate) {
                    downloadTask.onProgressUpdate((progress: any) => {
                        console.log(`[GameDataPuzzle] 下载进度: ${progress.progress}% (${progress.totalBytesWritten}/${progress.totalBytesExpectedToWrite})`);
                    });
                }
            });
        } catch (error) {
            console.error('[GameDataPuzzle] 下载异常:', error);
            this.downloadingUrls.delete(fullUrl);
            return null;
        }
    }

    /**
     * 从本地路径加载图片
     */
    private async loadImageFromLocalPath(localPath: string, puzzleId: number): Promise<boolean> {
        return new Promise((resolve) => {
            assetManager.loadRemote(localPath, { ext: '.png' }, (error, imageAsset: ImageAsset) => {
                if (error) {
                    console.error(`[GameDataPuzzle] 加载本地图片失败: ${localPath}`, error);
                    resolve(false);
                    return;
                }

                const texture = new Texture2D();
                texture.image = imageAsset;
                
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                
                // 保存到拼图数据中
                const index = puzzleId - 1;
                if (index >= 0 && index < this.puzzleSpriteFrames.length) {
                    this.puzzleSpriteFrames[index] = spriteFrame;
                    console.log(`[GameDataPuzzle] 拼图 ${puzzleId} SpriteFrame创建成功`);
                    resolve(true);
                } else {
                    console.error(`[GameDataPuzzle] 拼图ID超出范围: ${puzzleId}`);
                    resolve(false);
                }
            });
        });
    }

    /**
     * 从URL提取文件名
     */
    private getFileNameFromUrl(url: string): string {
        // 微信小游戏环境不支持URL对象，使用字符串解析
        try {
            // 移除查询参数和锚点
            const cleanUrl = url.split('?')[0].split('#')[0];
            // 获取路径部分
            const pathPart = cleanUrl.split('://')[1] || cleanUrl;
            // 获取文件名
            let fileName = pathPart.split('/').pop() || 'image';
            
            // 确保有文件扩展名
            if (!fileName.includes('.')) {
                fileName += '.png';
            }
            
            // 添加URL哈希以避免文件名冲突
            const hash = this.simpleHash(url);
            const parts = fileName.split('.');
            const ext = parts.pop();
            const name = parts.join('.');
            
            return `${name}_${hash}.${ext}`;
        } catch (error) {
            console.warn('[GameDataPuzzle] URL解析失败，使用默认文件名:', error);
            const hash = this.simpleHash(url);
            return `image_${hash}.png`;
        }
    }

    /**
     * 简单哈希函数
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * 清理缓存
     */
    public async clearImageCache(): Promise<void> {
        if (!this.fileSystemManager) {
            console.warn('[GameDataPuzzle] 文件系统管理器不可用，无法清理缓存');
            return;
        }

        const cachePath = `${wx.env.USER_DATA_PATH}/${this.CACHE_DIR}`;
        try {
            const files = this.fileSystemManager.readdirSync(cachePath);
            for (const file of files) {
                const filePath = `${cachePath}/${file}`;
                try {
                    this.fileSystemManager.unlinkSync(filePath);
                    console.log(`[GameDataPuzzle] 删除缓存文件: ${file}`);
                } catch (error) {
                    console.warn(`[GameDataPuzzle] 删除缓存文件失败: ${file}`, error);
                }
            }
            console.log('[GameDataPuzzle] 缓存清理完成');
        } catch (error) {
            console.error('[GameDataPuzzle] 清理缓存失败:', error);
        }
    }

    /**
     * 获取缓存大小
     */
    public getCacheSize(): number {
        if (!this.fileSystemManager) return 0;

        const cachePath = `${wx.env.USER_DATA_PATH}/${this.CACHE_DIR}`;
        let totalSize = 0;
        
        try {
            const files = this.fileSystemManager.readdirSync(cachePath);
            for (const file of files) {
                const filePath = `${cachePath}/${file}`;
                try {
                    const stats = this.fileSystemManager.statSync(filePath);
                    totalSize += stats.size;
                } catch (error) {
                    console.warn(`[GameDataPuzzle] 获取文件大小失败: ${file}`, error);
                }
            }
        } catch (error) {
            console.warn('[GameDataPuzzle] 获取缓存大小失败:', error);
        }
        
        return totalSize;
    }

    /**
     * 预加载指定拼图组的图片
     */
    public async preloadGroupImages(groupId: number, onProgress?: (current: number, total: number) => void): Promise<void> {
        const puzzleIds = this.getPuzzleIdsByGroup(groupId);
        let loadedCount = 0;
        
        console.log(`[GameDataPuzzle] 开始预加载拼图组 ${groupId} 的图片，共 ${puzzleIds.length} 张`);
        
        for (const puzzleId of puzzleIds) {
            const url = this.getPuzzleURL(puzzleId);
            if (url && url.trim() !== '') {
                try {
                    await this.loadImageFromURL(puzzleId, url);
                    loadedCount++;
                    
                    if (onProgress) {
                        onProgress(loadedCount, puzzleIds.length);
                    }
                    
                    console.log(`[GameDataPuzzle] 预加载进度: ${loadedCount}/${puzzleIds.length}`);
                } catch (error) {
                    console.warn(`[GameDataPuzzle] 预加载拼图 ${puzzleId} 失败:`, error);
                }
            }
        }
        
        console.log(`[GameDataPuzzle] 拼图组 ${groupId} 预加载完成`);
    }

    update(deltaTime: number) {
        
    }
}


