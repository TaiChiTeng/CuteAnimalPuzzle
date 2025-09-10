import { _decorator, Component, SpriteFrame, Texture2D, ImageAsset, Size, Vec2, Rect, assetManager } from 'cc';
import { GameDataPuzzle, PuzzleStatus } from './GameDataPuzzle';
const { ccclass, property } = _decorator;

/**
 * 拼图资源管理器
 * 负责管理拼图切片生成和缓存
 */
@ccclass('PuzzleResourceManager')
export class PuzzleResourceManager extends Component {
    private static _instance: PuzzleResourceManager = null;
    
    // 拼图切片缓存 Map<puzzleId, Map<cacheKey, SpriteFrame[]>>
    private pieceCache: Map<number, Map<string, SpriteFrame[]>> = new Map();
    
    // 动态加载的图片缓存 Map<puzzleId, SpriteFrame>
    private dynamicImageCache: Map<number, SpriteFrame> = new Map();
    
    // 正在加载的图片Promise缓存 Map<puzzleId, Promise<SpriteFrame>>
    private loadingPromises: Map<number, Promise<SpriteFrame>> = new Map();
    
    public static get instance(): PuzzleResourceManager {
        return PuzzleResourceManager._instance;
    }
    
    onLoad() {
        if (PuzzleResourceManager._instance === null) {
            PuzzleResourceManager._instance = this;
        } else {
            this.destroy();
        }
    }
    
    start() {
        // 初始化缓存
        console.log('PuzzleResourceManager 初始化完成');
    }
    
    /**
     * 获取拼图的完整SpriteFrame
     */
    public getPuzzleSpriteFrame(puzzleId: number): SpriteFrame | null {
        const gameData = GameDataPuzzle.instance;
        if (!gameData) return null;
        
        // 首先尝试从配置的SpriteFrame获取
        const configuredSpriteFrame = gameData.getPuzzleSpriteFrame(puzzleId);
        if (configuredSpriteFrame) {
            return configuredSpriteFrame;
        }
        
        // 如果没有配置SpriteFrame，尝试从动态加载缓存获取
        const cachedSpriteFrame = this.dynamicImageCache.get(puzzleId);
        if (cachedSpriteFrame) {
            return cachedSpriteFrame;
        }
        
        // 如果都没有，返回null（需要异步加载）
        return null;
    }
    
    /**
     * 异步加载拼图图片
     */
    public async loadPuzzleImageAsync(puzzleId: number): Promise<SpriteFrame | null> {
        const gameData = GameDataPuzzle.instance;
        if (!gameData) return null;
        
        // 首先检查是否已有配置的SpriteFrame
        const configuredSpriteFrame = gameData.getPuzzleSpriteFrame(puzzleId);
        if (configuredSpriteFrame) {
            return configuredSpriteFrame;
        }
        
        // 检查缓存
        const cachedSpriteFrame = this.dynamicImageCache.get(puzzleId);
        if (cachedSpriteFrame) {
            return cachedSpriteFrame;
        }
        
        // 检查是否正在加载
        const loadingPromise = this.loadingPromises.get(puzzleId);
        if (loadingPromise) {
            return await loadingPromise;
        }
        
        // 获取URL
        const urls = gameData.getPuzzleURL(puzzleId);
        if (!urls || urls.length === 0) {
            return null;
        }
        
        // 创建加载Promise
        const promise = this.loadImageFromURL(puzzleId, urls[0]);
        this.loadingPromises.set(puzzleId, promise);
        
        try {
            const spriteFrame = await promise;
            this.loadingPromises.delete(puzzleId);
            return spriteFrame;
        } catch (error) {
            console.error(`Failed to load image for puzzle ${puzzleId}:`, error);
            this.loadingPromises.delete(puzzleId);
            return null;
        }
    }
    
    /**
     * 从URL加载图片
     */
    private async loadImageFromURL(puzzleId: number, url: string): Promise<SpriteFrame> {
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            throw new Error('GameDataPuzzle instance not found');
        }
        
        try {
            // 使用GameDataPuzzle的新下载和缓存功能
            const spriteFrame = await gameData.loadImageFromURL(puzzleId, url);
            
            if (spriteFrame) {
                // 缓存到PuzzleResourceManager的本地缓存
                this.dynamicImageCache.set(puzzleId, spriteFrame);
                return spriteFrame;
            } else {
                throw new Error(`Failed to load image for puzzle ${puzzleId}`);
            }
        } catch (error) {
            console.error(`[PuzzleResourceManager] 加载图片失败 puzzleId: ${puzzleId}, url: ${url}`, error);
            throw error;
        }
    }
    
    /**
     * 生成拼图切片
     */
    public generatePuzzlePieces(puzzleId: number, rows: number, cols: number): SpriteFrame[] {
        // 检查缓存
        const cacheKey = `${rows}x${cols}`;
        if (!this.pieceCache.has(puzzleId)) {
            this.pieceCache.set(puzzleId, new Map());
        }
        
        const puzzleCache = this.pieceCache.get(puzzleId);
        if (puzzleCache.has(cacheKey)) {
            return puzzleCache.get(cacheKey);
        }
        
        // 从GameDataPuzzle获取原始SpriteFrame
        const originalSpriteFrame = this.getPuzzleSpriteFrame(puzzleId);
        if (!originalSpriteFrame) {
            console.error(`找不到拼图资源: ${puzzleId}`);
            return [];
        }
        
        console.log(`生成拼图切片: ${puzzleId}, 规格: ${rows}x${cols}`);
        
        const pieces: SpriteFrame[] = [];
        const texture = originalSpriteFrame.texture;
        
        if (!texture) {
            console.error('拼图纹理为空');
            return [];
        }
        
        // 获取原始图片的尺寸
        const originalRect = originalSpriteFrame.rect;
        const pieceWidth = originalRect.width / cols;
        const pieceHeight = originalRect.height / rows;
        
        // 生成每个切片
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = originalRect.x + col * pieceWidth;
                const y = originalRect.y + row * pieceHeight;
                
                // 创建切片的矩形区域
                const pieceRect = new Rect(x, y, pieceWidth, pieceHeight);
                
                // 创建新的SpriteFrame
                const pieceSpriteFrame = new SpriteFrame();
                pieceSpriteFrame.texture = texture;
                pieceSpriteFrame.rect = pieceRect;
                
                pieces.push(pieceSpriteFrame);
            }
        }
        
        // 缓存生成的切片
        puzzleCache.set(cacheKey, pieces);
        
        console.log(`成功生成 ${pieces.length} 个拼图切片`);
        return pieces;
    }
    
    /**
     * 获取拼图切片
     */
    public getPuzzlePiece(puzzleId: number, rows: number, cols: number, pieceIndex: number): SpriteFrame | null {
        const pieces = this.generatePuzzlePieces(puzzleId, rows, cols);
        
        if (pieceIndex >= 0 && pieceIndex < pieces.length) {
            return pieces[pieceIndex];
        }
        
        console.error(`拼图切片索引超出范围: ${pieceIndex}, 总数: ${pieces.length}`);
        return null;
    }
    
    /**
     * 获取可用的拼图ID列表
     */
    public getAvailablePuzzleIds(): number[] {
        const gameData = GameDataPuzzle.instance;
        return gameData ? gameData.getAvailablePuzzleIds() : [];
    }
    
    /**
     * 获取拼图显示名称
     */
    public getPuzzleName(puzzleId: number): string {
        return `拼图 ${puzzleId}`;
    }
    
    /**
     * 预加载拼图切片（可选的性能优化）
     */
    public preloadPuzzlePieces(puzzleId: number, rows: number, cols: number): void {
        // 异步生成切片，避免阻塞主线程
        this.scheduleOnce(() => {
            this.generatePuzzlePieces(puzzleId, rows, cols);
        }, 0);
    }
    
    /**
     * 清理拼图切片缓存
     */
    public clearPieceCache(puzzleId?: number): void {
        if (puzzleId !== undefined) {
            this.pieceCache.delete(puzzleId);
        } else {
            // 清理所有缓存
            this.pieceCache.clear();
        }
    }
    
    /**
     * 清理缓存
     */
    public clearCache(): void {
        this.pieceCache.clear();
        this.dynamicImageCache.clear();
        this.loadingPromises.clear();
    }
    
    /**
     * 获取资源统计信息
     */
    public getResourceStats(): { totalPuzzles: number, cachedPieces: number } {
        let cachedCount = 0;
        for (const cache of this.pieceCache.values()) {
            cachedCount += cache.size;
        }
        
        const gameData = GameDataPuzzle.instance;
        return {
            totalPuzzles: gameData ? gameData.getTotalPuzzleCount() : 0,
            cachedPieces: cachedCount
        };
    }
    
    update(deltaTime: number) {
        
    }
}