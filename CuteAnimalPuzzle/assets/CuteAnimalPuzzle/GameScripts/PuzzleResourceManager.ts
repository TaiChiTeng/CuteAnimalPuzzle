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
        
        console.log(`[PuzzleResourceManager] 生成拼图切片: ${puzzleId}, 规格: ${rows}x${cols}`);
        
        const pieces: SpriteFrame[] = [];
        const texture = originalSpriteFrame.texture;
        
        if (!texture) {
            console.error('[PuzzleResourceManager] 拼图纹理为空');
            return [];
        }
        
        // 获取原始图片的尺寸
        const originalRect = originalSpriteFrame.rect;
        const originalImageSize = Math.max(originalRect.width, originalRect.height); // 假设是正方形图片
        console.log(`[PuzzleResourceManager] 原始图片尺寸: ${originalRect.width}x${originalRect.height}, 使用尺寸: ${originalImageSize}`);
        
        // 根据难度和原图尺寸计算Mask尺寸和装饰半径
        const { maskSize, decorationRadius } = this.calculateMaskSizeAndRadius(rows, cols, originalImageSize);
        console.log(`[PuzzleResourceManager] Mask尺寸: ${maskSize}, 装饰半径: ${decorationRadius}`);
        
        // 计算切片间隔（相邻重叠decorationRadius，所以间隔 = maskSize - 2*decorationRadius）
        const pieceInterval = maskSize - 2 * decorationRadius;
        console.log(`[PuzzleResourceManager] 切片间隔: ${pieceInterval}`);
        
        // 计算扩展后的图片尺寸（原图 + 2*装饰半径）
        const expandedWidth = originalRect.width + 2 * decorationRadius;
        const expandedHeight = originalRect.height + 2 * decorationRadius;
        console.log(`[PuzzleResourceManager] 扩展后图片尺寸: ${expandedWidth}x${expandedHeight}`);
        
        // 生成每个切片
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // 判断切片位置
                const isTopEdge = (row === 0);
                const isBottomEdge = (row === rows - 1);
                const isLeftEdge = (col === 0);
                const isRightEdge = (col === cols - 1);
                
                // 计算切片在扩展图片中的起始位置
                // 扩展图片的原点在(decorationRadius, decorationRadius)
                // 每个切片按间隔排列
                const startX = decorationRadius + col * pieceInterval;
                const startY = decorationRadius + row * pieceInterval;
                
                // 计算实际纹理区域
                // 所有切片都是maskSize大小，但需要映射到原始纹理坐标
                let textureX = originalRect.x + startX - decorationRadius;
                let textureY = originalRect.y + startY - decorationRadius;
                let textureWidth = maskSize;
                let textureHeight = maskSize;
                
                // 边缘切片需要特殊处理，确保不超出原始图片边界
                if (isLeftEdge) {
                    textureX = originalRect.x;
                    textureWidth = Math.min(maskSize, originalRect.width);
                }
                if (isRightEdge) {
                    const maxX = originalRect.x + originalRect.width;
                    textureX = Math.max(originalRect.x, maxX - maskSize);
                    textureWidth = maxX - textureX;
                }
                if (isTopEdge) {
                    textureY = originalRect.y;
                    textureHeight = Math.min(maskSize, originalRect.height);
                }
                if (isBottomEdge) {
                    const maxY = originalRect.y + originalRect.height;
                    textureY = Math.max(originalRect.y, maxY - maskSize);
                    textureHeight = maxY - textureY;
                }
                
                // 确保纹理区域不超出原始图片边界
                textureX = Math.max(textureX, originalRect.x);
                textureY = Math.max(textureY, originalRect.y);
                textureX = Math.min(textureX, originalRect.x + originalRect.width - 1);
                textureY = Math.min(textureY, originalRect.y + originalRect.height - 1);
                textureWidth = Math.min(textureWidth, originalRect.x + originalRect.width - textureX);
                textureHeight = Math.min(textureHeight, originalRect.y + originalRect.height - textureY);
                
                // 创建切片的矩形区域
                const pieceRect = new Rect(textureX, textureY, textureWidth, textureHeight);
                
                // 创建新的SpriteFrame
                const pieceSpriteFrame = new SpriteFrame();
                pieceSpriteFrame.texture = texture;
                pieceSpriteFrame.rect = pieceRect;
                
                // 设置正确的originalSize和offset
                pieceSpriteFrame.originalSize = new Size(textureWidth, textureHeight);
                pieceSpriteFrame.offset = new Vec2(0, 0);
                pieceSpriteFrame.rotated = false;
                
                pieces.push(pieceSpriteFrame);
                
                // 输出调试信息
                const positionType = isTopEdge && isLeftEdge ? "左上角" :
                                   isTopEdge && isRightEdge ? "右上角" :
                                   isBottomEdge && isLeftEdge ? "左下角" :
                                   isBottomEdge && isRightEdge ? "右下角" :
                                   isTopEdge ? "上边缘" :
                                   isBottomEdge ? "下边缘" :
                                   isLeftEdge ? "左边缘" :
                                   isRightEdge ? "右边缘" : "中心";
                
                console.log(`[${row},${col}] ${positionType}: ${textureWidth.toFixed(0)}x${textureHeight.toFixed(0)} at (${textureX.toFixed(0)},${textureY.toFixed(0)})`);
            }
        }
        
        // 缓存生成的切片
        puzzleCache.set(cacheKey, pieces);
        
        console.log(`[PuzzleResourceManager] 成功生成 ${pieces.length} 个拼图切片`);
        return pieces;
    }
    
    /**
     * 根据拼图难度和原图尺寸计算Mask尺寸和装饰半径
     * 基于第2版.md文档的基准数据进行比例缩放
     * @param rows 行数
     * @param cols 列数
     * @param originalImageSize 原图尺寸（正方形图片的边长）
     * @returns Mask尺寸和装饰半径（原图坐标系）
     */
    private calculateMaskSizeAndRadius(rows: number, cols: number, originalImageSize: number): { maskSize: number, decorationRadius: number } {
        // 基准数据（来自第2版.md文档）
        const baseImageSize = 384;      // 基准图片尺寸
        const baseMaskSize = 178;       // 基准Mask尺寸（3x3时）
        const baseDecorationRadius = 25; // 基准装饰半径（3x3时）
        const baseGridSize = 3;         // 基准难度（3x3）
        
        // 计算图片尺寸缩放比例
        const imageSizeRatio = originalImageSize / baseImageSize;
        
        // 计算难度调整比例
        const gridSize = Math.max(rows, cols);
        const difficultyRatio = baseGridSize / gridSize;
        
        // 计算实际值（先按图片尺寸缩放，再按难度调整）
        const actualMaskSize = Math.round(baseMaskSize * imageSizeRatio * difficultyRatio);
        const actualDecorationRadius = Math.round(baseDecorationRadius * imageSizeRatio * difficultyRatio);
        
        console.log(`[PuzzleResourceManager] 基准数据计算 - 原图:${originalImageSize}, 基准:${baseImageSize}, 图片比例:${imageSizeRatio.toFixed(3)}`);
        console.log(`[PuzzleResourceManager] 难度调整 - 当前:${gridSize}x${gridSize}, 基准:${baseGridSize}x${baseGridSize}, 难度比例:${difficultyRatio.toFixed(3)}`);
        console.log(`[PuzzleResourceManager] 最终结果 - Mask尺寸:${actualMaskSize}, 装饰半径:${actualDecorationRadius}`);
        
        // 验证660x660图片3x3拼图的计算结果
        if (originalImageSize === 660 && gridSize === 3) {
            console.log(`[PuzzleResourceManager] 验证660x660-3x3 - 期望Mask:306, 实际:${actualMaskSize}, 期望半径:43, 实际:${actualDecorationRadius}`);
        }
        
        return { 
            maskSize: actualMaskSize, 
            decorationRadius: actualDecorationRadius 
        };
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