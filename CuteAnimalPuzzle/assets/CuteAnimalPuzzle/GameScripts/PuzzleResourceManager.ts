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
     * 生成拼图切片 - 使用文档中的精确坐标数据
     * 拼图切片的本质是：每个切片都要为相邻切片的"凸起"预留空间，同时自己的"凸起"要延伸到相邻切片的区域
     * 基于《第2版.md》文档中的精确坐标数据，不使用算法推导
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
        
        console.log(`[PuzzleResourceManager] 生成拼图切片: ${puzzleId}, 规格: ${rows}x${cols}`);
        
        const pieces: SpriteFrame[] = [];
        const texture = originalSpriteFrame.texture;
        
        if (!texture) {
            console.error('[PuzzleResourceManager] 拼图纹理为空');
            return [];
        }
        
        // 获取原始图片的尺寸
        const originalRect = originalSpriteFrame.rect;
        const textureWidth = originalRect.width;
        const textureHeight = originalRect.height;
        console.log(`[PuzzleResourceManager] 原始图片尺寸: ${textureWidth}x${textureHeight}`);
        
        // 基于文档的精确数据：以384x384为基准，计算缩放比例
        const scale = textureWidth / 384;
        
        // 基础参数（基于384x384图片的标准值）
        const baseMaskSize = 178;
        const baseDecorationRadius = 25;
        
        // 文档中的精确坐标数据（基于384x384图片）
        const baseCoordinatesData: { [key: number]: number[] } = {
            3: [0, 103, 231],  // 3x3难度的精确坐标
            4: [0, 77, 154, 231],  // 4x4难度（推算）
            5: [0, 62, 124, 186, 248]  // 5x5难度（推算）
        };
        
        const difficulty = Math.max(rows, cols);
        const baseCoordinates = baseCoordinatesData[difficulty];
        
        if (!baseCoordinates) {
            console.error(`[PuzzleResourceManager] 不支持的难度: ${difficulty}x${difficulty}`);
            return [];
        }
        
        // 应用缩放到所有参数
        const maskSize = Math.round(baseMaskSize * scale);
        const decorationRadius = Math.round(baseDecorationRadius * scale);
        
        // 缩放坐标数组
        const coordinates = baseCoordinates.map(coord => Math.round(coord * scale));
        
        console.log(`[PuzzleResourceManager] 难度: ${difficulty}x${difficulty}, 缩放比例: ${scale.toFixed(3)}`);
        console.log(`[PuzzleResourceManager] maskSize: ${maskSize}, decorationRadius: ${decorationRadius}`);
        console.log(`[PuzzleResourceManager] 基础坐标: [${baseCoordinates.join(', ')}]`);
        console.log(`[PuzzleResourceManager] 缩放后坐标: [${coordinates.join(', ')}]`);
        
        // 计算尺寸数组（边缘切片和中间切片的尺寸不同）
        const edgeSize = maskSize - decorationRadius;  // 边缘切片尺寸 = 178 - 25 = 153
        const centerSize = maskSize;                   // 中间切片尺寸 = 178
        
        console.log(`[PuzzleResourceManager] 边缘切片尺寸: ${edgeSize}, 中间切片尺寸: ${centerSize}`);
        
        // 生成每个切片
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // 判断切片类型
                const isTopEdge = row === 0;
                const isBottomEdge = row === rows - 1;
                const isLeftEdge = col === 0;
                const isRightEdge = col === cols - 1;
                const isCorner = (isTopEdge || isBottomEdge) && (isLeftEdge || isRightEdge);
                const isEdge = isTopEdge || isBottomEdge || isLeftEdge || isRightEdge;
                
                // 使用坐标数组获取精确位置
                const rectX = coordinates[col];
                const rectY = coordinates[row];
                
                // 根据切片类型计算尺寸
                let rectWidth: number, rectHeight: number;
                
                if (isCorner) {
                    // 角落切片：两个方向都是边缘尺寸
                    rectWidth = edgeSize;
                    rectHeight = edgeSize;
                } else if (isEdge) {
                    if (isTopEdge || isBottomEdge) {
                        // 上下边缘：宽度为中间尺寸，高度为边缘尺寸
                        rectWidth = centerSize;
                        rectHeight = edgeSize;
                    } else {
                        // 左右边缘：宽度为边缘尺寸，高度为中间尺寸
                        rectWidth = edgeSize;
                        rectHeight = centerSize;
                    }
                } else {
                    // 中间切片：两个方向都是中间尺寸
                    rectWidth = centerSize;
                    rectHeight = centerSize;
                }
                
                console.log(`[PuzzleResourceManager] 切片[${row},${col}] 类型: ${isCorner ? '角落' : isEdge ? '边缘' : '中间'}`);
                console.log(`[PuzzleResourceManager] rect: (${rectX},${rectY}) ${rectWidth}x${rectHeight}`);
                
                // 创建SpriteFrame
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                spriteFrame.rect = new Rect(rectX, rectY, rectWidth, rectHeight);
                spriteFrame.offset = new Vec2(0, 0);
                spriteFrame.originalSize = new Size(rectWidth, rectHeight);
                
                pieces.push(spriteFrame);
            }
        }
        
        // 缓存生成的切片
        puzzleCache.set(cacheKey, pieces);
        
        console.log(`[PuzzleResourceManager] 成功生成 ${pieces.length} 个拼图切片`);
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