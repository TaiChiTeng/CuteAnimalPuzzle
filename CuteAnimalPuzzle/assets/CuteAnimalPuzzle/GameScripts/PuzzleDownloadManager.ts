import { _decorator, Component, Node, assetManager, ImageAsset, Texture2D, SpriteFrame, director } from 'cc';
import { GameDataPuzzle } from './GameDataPuzzle';
const { ccclass, property } = _decorator;

// 声明微信API类型
declare const wx: any;

/**
 * 下载任务状态枚举
 */
export enum DownloadTaskStatus {
    PENDING = 'pending',        // 等待下载
    DOWNLOADING = 'downloading', // 正在下载
    PAUSED = 'paused',          // 已暂停
    COMPLETED = 'completed',    // 下载完成
    FAILED = 'failed',          // 下载失败
    CANCELLED = 'cancelled'     // 已取消
}

/**
 * 下载任务接口
 */
export interface DownloadTask {
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

/**
 * 下载进度回调接口
 */
export interface DownloadProgressCallback {
    (current: number, total: number, task?: DownloadTask): void;
}

/**
 * 下载完成回调接口
 */
export interface DownloadCompleteCallback {
    (task: DownloadTask, spriteFrame?: SpriteFrame): void;
}

/**
 * 下载错误回调接口
 */
export interface DownloadErrorCallback {
    (task: DownloadTask, error: string): void;
}

/**
 * 拼图下载管理器
 * 负责管理拼图图片的下载队列、状态跟踪、重试机制等
 */
@ccclass('PuzzleDownloadManager')
export class PuzzleDownloadManager extends Component {
    private static _instance: PuzzleDownloadManager | null = null;
    
    // 配置参数
    private readonly MAX_CONCURRENT_DOWNLOADS = 3;  // 最大并发下载数
    private readonly MAX_RETRY_COUNT = 1;           // 最大重试次数
    private readonly RETRY_DELAY_BASE = 150;       // 重试延迟基数(毫秒)
    private readonly DOWNLOAD_TIMEOUT = 6500;      // 下载超时时间(毫秒)
    private readonly CACHE_DIR = 'puzzle_cache';    // 缓存目录
    
    // 状态管理
    private _isInitialized: boolean = false;
    private _isPaused: boolean = false;
    private _isDestroyed: boolean = false;
    
    // 任务管理
    private _downloadQueue: DownloadTask[] = [];           // 下载队列
    private _activeDownloads: Map<string, DownloadTask> = new Map(); // 活跃下载任务
    private _completedTasks: Map<string, DownloadTask> = new Map();  // 已完成任务
    private _taskIdCounter: number = 0;                    // 任务ID计数器
    
    // 文件系统
    private _fileSystemManager: any = null;
    
    // 回调函数
    private _progressCallbacks: Map<string, DownloadProgressCallback[]> = new Map();
    private _completeCallbacks: Map<string, DownloadCompleteCallback[]> = new Map();
    private _errorCallbacks: Map<string, DownloadErrorCallback[]> = new Map();
    
    // 全局回调
    private _globalProgressCallback: DownloadProgressCallback | null = null;
    private _globalCompleteCallback: DownloadCompleteCallback | null = null;
    private _globalErrorCallback: DownloadErrorCallback | null = null;

    /**
     * 获取单例实例
     */
    public static get instance(): PuzzleDownloadManager | null {
        return PuzzleDownloadManager._instance;
    }

    /**
     * 创建单例实例
     */
    public static createInstance(): PuzzleDownloadManager {
        if (PuzzleDownloadManager._instance) {
            console.warn('[PuzzleDownloadManager] 实例已存在，返回现有实例');
            return PuzzleDownloadManager._instance;
        }
        
        // 创建新的节点和组件
        const node = new Node('PuzzleDownloadManager');
        const instance = node.addComponent(PuzzleDownloadManager);
        
        // 设置为持久节点（使用新的API）
        director.addPersistRootNode(node);
        
        return instance;
    }

    onLoad() {
        if (PuzzleDownloadManager._instance === null) {
            PuzzleDownloadManager._instance = this;
            this.initializeFileSystem();
        } else {
            console.warn('[PuzzleDownloadManager] 单例已存在，销毁重复实例');
            this.destroy();
        }
    }

    onDestroy() {
        this._isDestroyed = true;
        this.pauseAllDownloads();
        this.clearAllCallbacks();
        
        if (PuzzleDownloadManager._instance === this) {
            PuzzleDownloadManager._instance = null;
        }
    }

    /**
     * 初始化文件系统
     */
    private initializeFileSystem(): void {
        if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
            this._fileSystemManager = wx.getFileSystemManager();
            this.ensureCacheDirectory();
            this._isInitialized = true;
            console.log('[PuzzleDownloadManager] 文件系统初始化成功');
        } else {
            console.warn('[PuzzleDownloadManager] 微信API不可用，下载功能将被禁用');
            this._isInitialized = false;
        }
    }

    /**
     * 确保缓存目录存在
     */
    private ensureCacheDirectory(): void {
        if (!this._fileSystemManager) return;
        
        const cachePath = `${wx.env.USER_DATA_PATH}/${this.CACHE_DIR}`;
        try {
            this._fileSystemManager.accessSync(cachePath);
        } catch (error) {
            try {
                this._fileSystemManager.mkdirSync(cachePath, true);
                console.log('[PuzzleDownloadManager] 缓存目录创建成功');
            } catch (mkdirError) {
                console.error('[PuzzleDownloadManager] 创建缓存目录失败:', mkdirError);
            }
        }
    }

    /**
     * 添加下载任务
     * @param puzzleId 拼图ID
     * @param url 完整的下载URL
     * @param priority 优先级 (数字越小优先级越高)
     * @param groupId 拼图组ID (可选)
     * @returns 任务ID
     */
    public addDownloadTask(puzzleId: number, url: string, priority: number = 0, groupId?: number): string {
        if (!this._isInitialized) {
            console.error('[PuzzleDownloadManager] 管理器未初始化，无法添加下载任务');
            return '';
        }

        // 检查是否已存在相同的任务
        const existingTaskId = this.findExistingTask(puzzleId, url);
        if (existingTaskId) {
            console.log(`[PuzzleDownloadManager] 拼图 ${puzzleId} 的下载任务已存在: ${existingTaskId}`);
            return existingTaskId;
        }

        // 检查本地缓存
        const localPath = this.generateLocalPath(url);
        if (this.isFileExists(localPath)) {
            console.log(`[PuzzleDownloadManager] 拼图 ${puzzleId} 本地缓存已存在: ${localPath}`);
            // 创建已完成的任务记录
            const completedTask = this.createCompletedTask(puzzleId, url, localPath, groupId);
            this._completedTasks.set(completedTask.id, completedTask);
            return completedTask.id;
        }

        // 创建新的下载任务
        const taskId = this.generateTaskId();
        const task: DownloadTask = {
            id: taskId,
            puzzleId,
            url,
            localPath,
            status: DownloadTaskStatus.PENDING,
            progress: 0,
            retryCount: 0,
            priority,
            groupId,
            createdAt: Date.now()
        };

        // 添加到队列
        this._downloadQueue.push(task);
        this.sortDownloadQueue();

        console.log(`[PuzzleDownloadManager] 添加下载任务: ${taskId}, 拼图ID: ${puzzleId}, 优先级: ${priority}`);

        // 尝试开始下载
        this.processDownloadQueue();

        return taskId;
    }

    /**
     * 批量添加下载任务
     * @param tasks 任务配置数组，url应该是完整的下载URL
     * @returns 任务ID数组
     */
    public addBatchDownloadTasks(tasks: Array<{puzzleId: number, url: string, priority?: number, groupId?: number}>): string[] {
        const taskIds: string[] = [];
        
        for (const taskConfig of tasks) {
            const taskId = this.addDownloadTask(
                taskConfig.puzzleId, 
                taskConfig.url, 
                taskConfig.priority || 0, 
                taskConfig.groupId
            );
            if (taskId) {
                taskIds.push(taskId);
            }
        }
        
        return taskIds;
    }

    /**
     * 暂停所有下载
     */
    public pauseAllDownloads(): void {
        this._isPaused = true;
        
        // 暂停活跃的下载任务
        for (const [taskId, task] of this._activeDownloads) {
            if (task.downloadTask && task.downloadTask.abort) {
                task.downloadTask.abort();
            }
            task.status = DownloadTaskStatus.PAUSED;
            console.log(`[PuzzleDownloadManager] 暂停下载任务: ${taskId}`);
        }
        
        this._activeDownloads.clear();
        console.log('[PuzzleDownloadManager] 所有下载任务已暂停');
    }

    /**
     * 继续所有下载
     */
    public resumeAllDownloads(): void {
        this._isPaused = false;
        
        // 将暂停的任务重新加入队列
        for (const task of this._downloadQueue) {
            if (task.status === DownloadTaskStatus.PAUSED) {
                task.status = DownloadTaskStatus.PENDING;
            }
        }
        
        console.log('[PuzzleDownloadManager] 继续所有下载任务');
        this.processDownloadQueue();
    }

    /**
     * 取消指定任务
     * @param taskId 任务ID
     */
    public cancelTask(taskId: string): void {
        // 从队列中移除
        const queueIndex = this._downloadQueue.findIndex(task => task.id === taskId);
        if (queueIndex !== -1) {
            const task = this._downloadQueue[queueIndex];
            task.status = DownloadTaskStatus.CANCELLED;
            this._downloadQueue.splice(queueIndex, 1);
            console.log(`[PuzzleDownloadManager] 从队列中取消任务: ${taskId}`);
        }

        // 取消活跃下载
        const activeTask = this._activeDownloads.get(taskId);
        if (activeTask) {
            if (activeTask.downloadTask && activeTask.downloadTask.abort) {
                activeTask.downloadTask.abort();
            }
            activeTask.status = DownloadTaskStatus.CANCELLED;
            this._activeDownloads.delete(taskId);
            console.log(`[PuzzleDownloadManager] 取消活跃下载任务: ${taskId}`);
        }
    }

    /**
     * 取消指定组的所有任务（完全取消，不保留进度）
     * @param groupId 拼图组ID
     */
    public cancelGroupTasks(groupId: number): void {
        const tasksToCancel: string[] = [];
        
        // 收集需要取消的任务ID
        for (const task of this._downloadQueue) {
            if (task.groupId === groupId) {
                tasksToCancel.push(task.id);
            }
        }
        
        for (const [taskId, task] of this._activeDownloads) {
            if (task.groupId === groupId) {
                tasksToCancel.push(taskId);
            }
        }
        
        // 取消任务
        for (const taskId of tasksToCancel) {
            this.cancelTask(taskId);
        }
        
        console.log(`[PuzzleDownloadManager] 取消拼图组 ${groupId} 的 ${tasksToCancel.length} 个任务`);
    }

    /**
     * 暂停指定组的所有任务
     * @param groupId 拼图组ID
     */
    public pauseGroupDownloads(groupId: number): void {
        let pausedCount = 0;
        
        // 暂停队列中的任务
        for (const task of this._downloadQueue) {
            if (task.groupId === groupId && task.status === DownloadTaskStatus.PENDING) {
                task.status = DownloadTaskStatus.PAUSED;
                pausedCount++;
            }
        }
        
        // 暂停活跃下载
        for (const [taskId, task] of this._activeDownloads) {
            if (task.groupId === groupId) {
                if (task.downloadTask && task.downloadTask.abort) {
                    task.downloadTask.abort();
                }
                task.status = DownloadTaskStatus.PAUSED;
                this._activeDownloads.delete(taskId);
                // 将任务重新加入队列
                this._downloadQueue.push(task);
                pausedCount++;
            }
        }
        
        this.sortDownloadQueue();
        console.log(`[PuzzleDownloadManager] 暂停拼图组 ${groupId} 的 ${pausedCount} 个任务`);
    }

    /**
     * 继续指定组的所有任务
     * @param groupId 拼图组ID
     */
    public resumeGroupDownloads(groupId: number): void {
        let resumedCount = 0;
        
        // 将暂停的任务重新设置为待处理状态
        for (const task of this._downloadQueue) {
            if (task.groupId === groupId && task.status === DownloadTaskStatus.PAUSED) {
                task.status = DownloadTaskStatus.PENDING;
                resumedCount++;
            }
        }
        
        console.log(`[PuzzleDownloadManager] 继续拼图组 ${groupId} 的 ${resumedCount} 个任务`);
        
        // 重新处理下载队列
        this.processDownloadQueue();
    }

    /**
     * 获取任务状态
     * @param taskId 任务ID
     * @returns 任务对象或null
     */
    public getTaskStatus(taskId: string): DownloadTask | null {
        // 检查已完成任务
        const completedTask = this._completedTasks.get(taskId);
        if (completedTask) {
            return completedTask;
        }
        
        // 检查活跃下载
        const activeTask = this._activeDownloads.get(taskId);
        if (activeTask) {
            return activeTask;
        }
        
        // 检查队列中的任务
        const queueTask = this._downloadQueue.find(task => task.id === taskId);
        if (queueTask) {
            return queueTask;
        }
        
        return null;
    }

    /**
     * 获取指定组的下载统计
     * @param groupId 拼图组ID
     * @returns 下载统计信息
     */
    public getGroupDownloadStats(groupId: number): {total: number, completed: number, downloading: number, pending: number, failed: number} {
        const stats = {
            total: 0,
            completed: 0,
            downloading: 0,
            pending: 0,
            failed: 0
        };
        
        // 统计已完成任务
        for (const [_, task] of this._completedTasks) {
            if (task.groupId === groupId) {
                stats.total++;
                stats.completed++;
            }
        }
        
        // 统计活跃下载
        for (const [_, task] of this._activeDownloads) {
            if (task.groupId === groupId) {
                stats.total++;
                stats.downloading++;
            }
        }
        
        // 统计队列中的任务
        for (const task of this._downloadQueue) {
            if (task.groupId === groupId) {
                stats.total++;
                if (task.status === DownloadTaskStatus.PENDING) {
                    stats.pending++;
                } else if (task.status === DownloadTaskStatus.FAILED) {
                    stats.failed++;
                }
            }
        }
        
        return stats;
    }

    /**
     * 设置全局进度回调
     */
    public setGlobalProgressCallback(callback: DownloadProgressCallback | null): void {
        this._globalProgressCallback = callback;
    }

    /**
     * 设置全局完成回调
     */
    public setGlobalCompleteCallback(callback: DownloadCompleteCallback | null): void {
        this._globalCompleteCallback = callback;
    }

    /**
     * 设置全局错误回调
     */
    public setGlobalErrorCallback(callback: DownloadErrorCallback | null): void {
        this._globalErrorCallback = callback;
    }

    /**
     * 为指定任务添加进度回调
     */
    public addTaskProgressCallback(taskId: string, callback: DownloadProgressCallback): void {
        if (!this._progressCallbacks.has(taskId)) {
            this._progressCallbacks.set(taskId, []);
        }
        this._progressCallbacks.get(taskId)!.push(callback);
    }

    /**
     * 为指定任务添加完成回调
     */
    public addTaskCompleteCallback(taskId: string, callback: DownloadCompleteCallback): void {
        if (!this._completeCallbacks.has(taskId)) {
            this._completeCallbacks.set(taskId, []);
        }
        this._completeCallbacks.get(taskId)!.push(callback);
    }

    /**
     * 为指定任务添加错误回调
     */
    public addTaskErrorCallback(taskId: string, callback: DownloadErrorCallback): void {
        if (!this._errorCallbacks.has(taskId)) {
            this._errorCallbacks.set(taskId, []);
        }
        this._errorCallbacks.get(taskId)!.push(callback);
    }

    /**
     * 处理下载队列
     */
    private processDownloadQueue(): void {
        if (this._isPaused || this._isDestroyed) {
            return;
        }

        // 检查是否有可用的下载槽位
        const availableSlots = this.MAX_CONCURRENT_DOWNLOADS - this._activeDownloads.size;
        if (availableSlots <= 0) {
            return;
        }

        // 获取待下载的任务
        const pendingTasks = this._downloadQueue.filter(task => task.status === DownloadTaskStatus.PENDING);
        const tasksToStart = pendingTasks.slice(0, availableSlots);

        // 开始下载任务
        for (const task of tasksToStart) {
            this.startDownloadTask(task);
        }
    }

    /**
     * 开始下载任务
     */
    private async startDownloadTask(task: DownloadTask): Promise<void> {
        if (this._isPaused || this._isDestroyed) {
            return;
        }

        // 从队列中移除并添加到活跃下载
        const queueIndex = this._downloadQueue.findIndex(t => t.id === task.id);
        if (queueIndex !== -1) {
            this._downloadQueue.splice(queueIndex, 1);
        }
        
        task.status = DownloadTaskStatus.DOWNLOADING;
        task.startedAt = Date.now();
        this._activeDownloads.set(task.id, task);

        console.log(`[PuzzleDownloadManager] 开始下载任务: ${task.id}, 拼图ID: ${task.puzzleId}`);

        try {
            await this.executeDownload(task);
        } catch (error) {
            console.error(`[PuzzleDownloadManager] 下载任务执行失败: ${task.id}`, error);
            this.handleDownloadError(task, error.toString());
        }
    }

    /**
     * 执行下载
     */
    private executeDownload(task: DownloadTask): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this._fileSystemManager || typeof wx === 'undefined') {
                reject(new Error('微信API不可用'));
                return;
            }

            const downloadTask = wx.downloadFile({
                url: task.url,
                timeout: this.DOWNLOAD_TIMEOUT,
                success: (res: any) => {
                    if (res.statusCode === 200) {
                        // 保存文件到缓存目录
                        this._fileSystemManager.saveFile({
                            tempFilePath: res.tempFilePath,
                            filePath: task.localPath,
                            success: () => {
                                this.handleDownloadSuccess(task);
                                resolve();
                            },
                            fail: (error: any) => {
                                this.handleDownloadError(task, `保存文件失败: ${error.errMsg}`);
                                reject(error);
                            }
                        });
                    } else {
                        this.handleDownloadError(task, `HTTP错误: ${res.statusCode}`);
                        reject(new Error(`HTTP错误: ${res.statusCode}`));
                    }
                },
                fail: (error: any) => {
                    this.handleDownloadError(task, `下载失败: ${error.errMsg}`);
                    reject(error);
                }
            });

            // 保存下载任务引用
            task.downloadTask = downloadTask;

            // 监听下载进度
            if (downloadTask && downloadTask.onProgressUpdate) {
                downloadTask.onProgressUpdate((progress: any) => {
                    task.progress = progress.progress / 100;
                    this.notifyProgress(task);
                });
            }
        });
    }

    /**
     * 处理下载成功
     */
    private async handleDownloadSuccess(task: DownloadTask): Promise<void> {
        task.status = DownloadTaskStatus.COMPLETED;
        task.progress = 1;
        task.completedAt = Date.now();
        
        // 从活跃下载中移除
        this._activeDownloads.delete(task.id);
        
        // 添加到已完成任务
        this._completedTasks.set(task.id, task);
        
        console.log(`[PuzzleDownloadManager] 下载完成: ${task.id}, 拼图ID: ${task.puzzleId}`);
        
        // 加载为SpriteFrame
        try {
            const spriteFrame = await this.loadSpriteFrameFromPath(task.localPath);
            this.notifyComplete(task, spriteFrame);
        } catch (error) {
            console.error(`[PuzzleDownloadManager] 加载SpriteFrame失败: ${task.id}`, error);
            this.notifyComplete(task, undefined);
        }
        
        // 继续处理队列
        this.processDownloadQueue();
    }

    /**
     * 处理下载错误
     */
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
            
            console.log(`[PuzzleDownloadManager] 任务 ${task.id} 将在 ${delay}ms 后重试 (${task.retryCount}/${this.MAX_RETRY_COUNT})`);
            
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
            console.error(`[PuzzleDownloadManager] 任务 ${task.id} 下载失败，重试次数用尽: ${errorMessage}`);
            this.notifyError(task, errorMessage);
        }
        
        // 继续处理队列
        this.processDownloadQueue();
    }

    /**
     * 从本地路径加载SpriteFrame
     */
    private loadSpriteFrameFromPath(localPath: string): Promise<SpriteFrame> {
        return new Promise((resolve, reject) => {
            assetManager.loadRemote(localPath, { ext: '.png' }, (error, imageAsset: ImageAsset) => {
                if (error) {
                    reject(error);
                    return;
                }

                const texture = new Texture2D();
                texture.image = imageAsset;
                
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                
                resolve(spriteFrame);
            });
        });
    }

    /**
     * 通知进度更新
     */
    private notifyProgress(task: DownloadTask): void {
        // 通知任务特定回调
        const callbacks = this._progressCallbacks.get(task.id);
        if (callbacks) {
            for (const callback of callbacks) {
                try {
                    callback(Math.round(task.progress * 100), 100, task);
                } catch (error) {
                    console.error('[PuzzleDownloadManager] 进度回调执行错误:', error);
                }
            }
        }
        
        // 通知全局回调
        if (this._globalProgressCallback) {
            try {
                this._globalProgressCallback(Math.round(task.progress * 100), 100, task);
            } catch (error) {
                console.error('[PuzzleDownloadManager] 全局进度回调执行错误:', error);
            }
        }
    }

    /**
     * 通知下载完成
     */
    private notifyComplete(task: DownloadTask, spriteFrame?: SpriteFrame): void {
        // 通知任务特定回调
        const callbacks = this._completeCallbacks.get(task.id);
        if (callbacks) {
            for (const callback of callbacks) {
                try {
                    callback(task, spriteFrame);
                } catch (error) {
                    console.error('[PuzzleDownloadManager] 完成回调执行错误:', error);
                }
            }
        }
        
        // 通知全局回调
        if (this._globalCompleteCallback) {
            try {
                this._globalCompleteCallback(task, spriteFrame);
            } catch (error) {
                console.error('[PuzzleDownloadManager] 全局完成回调执行错误:', error);
            }
        }
        
        // 清理任务回调
        this.clearTaskCallbacks(task.id);
    }

    /**
     * 通知下载错误
     */
    private notifyError(task: DownloadTask, errorMessage: string): void {
        // 通知任务特定回调
        const callbacks = this._errorCallbacks.get(task.id);
        if (callbacks) {
            for (const callback of callbacks) {
                try {
                    callback(task, errorMessage);
                } catch (error) {
                    console.error('[PuzzleDownloadManager] 错误回调执行错误:', error);
                }
            }
        }
        
        // 通知全局回调
        if (this._globalErrorCallback) {
            try {
                this._globalErrorCallback(task, errorMessage);
            } catch (error) {
                console.error('[PuzzleDownloadManager] 全局错误回调执行错误:', error);
            }
        }
        
        // 清理任务回调
        this.clearTaskCallbacks(task.id);
    }

    /**
     * 清理指定任务的回调
     */
    private clearTaskCallbacks(taskId: string): void {
        this._progressCallbacks.delete(taskId);
        this._completeCallbacks.delete(taskId);
        this._errorCallbacks.delete(taskId);
    }

    /**
     * 清理所有回调
     */
    private clearAllCallbacks(): void {
        this._progressCallbacks.clear();
        this._completeCallbacks.clear();
        this._errorCallbacks.clear();
        this._globalProgressCallback = null;
        this._globalCompleteCallback = null;
        this._globalErrorCallback = null;
    }

    /**
     * 查找现有任务
     */
    private findExistingTask(puzzleId: number, url: string): string | null {
        // 检查已完成任务
        for (const [taskId, task] of this._completedTasks) {
            if (task.puzzleId === puzzleId && task.url === url) {
                return taskId;
            }
        }
        
        // 检查活跃下载
        for (const [taskId, task] of this._activeDownloads) {
            if (task.puzzleId === puzzleId && task.url === url) {
                return taskId;
            }
        }
        
        // 检查队列中的任务
        const queueTask = this._downloadQueue.find(task => task.puzzleId === puzzleId && task.url === url);
        if (queueTask) {
            return queueTask.id;
        }
        
        return null;
    }

    /**
     * 生成本地路径
     */
    private generateLocalPath(url: string): string {
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.error('[PuzzleDownloadManager] GameDataPuzzle实例不存在');
            return `${wx.env.USER_DATA_PATH}/${this.CACHE_DIR}/default.png`;
        }
        
        const fileName = gameData.getFileNameFromUrl(url);
        return `${wx.env.USER_DATA_PATH}/${this.CACHE_DIR}/${fileName}`;
    }

    /**
     * 检查文件是否存在
     */
    private isFileExists(filePath: string): boolean {
        if (!this._fileSystemManager) return false;
        
        try {
            this._fileSystemManager.accessSync(filePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 创建已完成的任务记录
     */
    private createCompletedTask(puzzleId: number, url: string, localPath: string, groupId?: number): DownloadTask {
        const taskId = this.generateTaskId();
        return {
            id: taskId,
            puzzleId,
            url,
            localPath,
            status: DownloadTaskStatus.COMPLETED,
            progress: 1,
            retryCount: 0,
            priority: 0,
            groupId,
            createdAt: Date.now(),
            completedAt: Date.now()
        };
    }

    /**
     * 生成任务ID
     */
    private generateTaskId(): string {
        return `task_${++this._taskIdCounter}_${Date.now()}`;
    }

    /**
     * 对下载队列排序（按优先级）
     */
    private sortDownloadQueue(): void {
        this._downloadQueue.sort((a, b) => {
            // 优先级越小越优先
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            // 优先级相同时，按创建时间排序
            return a.createdAt - b.createdAt;
        });
    }

    /**
     * 获取管理器状态信息
     */
    public getManagerStatus(): {
        isInitialized: boolean;
        isPaused: boolean;
        queueLength: number;
        activeDownloads: number;
        completedTasks: number;
    } {
        return {
            isInitialized: this._isInitialized,
            isPaused: this._isPaused,
            queueLength: this._downloadQueue.length,
            activeDownloads: this._activeDownloads.size,
            completedTasks: this._completedTasks.size
        };
    }

    /**
     * 清理已完成的任务记录（释放内存）
     */
    public clearCompletedTasks(): void {
        this._completedTasks.clear();
        console.log('[PuzzleDownloadManager] 已清理所有已完成任务记录');
    }
}