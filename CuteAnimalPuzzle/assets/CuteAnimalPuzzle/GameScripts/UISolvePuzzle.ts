import { _decorator, Component, Node, Button, ScrollView, Prefab, instantiate, Sprite, SpriteFrame, UITransform} from 'cc';
import { GameDataPuzzle, PuzzleDifficulty } from './GameDataPuzzle';
import { UIManager } from './UIManager';
import { PuzzlePiece } from './PuzzlePiece';
import { PuzzleResourceManager } from './PuzzleResourceManager';
const { ccclass, property } = _decorator;

@ccclass('UISolvePuzzle')
export class UISolvePuzzle extends Component {
    @property(Button)
    public btnBack: Button = null;

    @property(Button)
    public btnHint: Button = null;

    @property(Node)
    public hintImage: Node = null;  // 拼图提示图片

    @property(Node)
    public puzzleGrid: Node = null;  // 拼图网格区域

    @property(Node)
    public dragArea: Node = null;    // 拖拽区域

    @property(ScrollView)
    public pieceScrollView: ScrollView = null;

    @property(Node)
    public pieceContent: Node = null;

    @property(Prefab)
    public puzzlePiecePrefab: Prefab = null;

    @property(Prefab)
    public gridPiecePrefab: Prefab = null;

    @property(SpriteFrame)
    public gridSpriteFrame0: SpriteFrame = null;

    @property(SpriteFrame)
    public gridSpriteFrame1: SpriteFrame = null;

    // 拼图资源管理器将自动处理资源
    private uiManager: UIManager = null;
    private puzzlePieces: PuzzlePiece[] = [];
    private gridSlots: Node[] = [];  // 网格槽位
    private gridSideLength: number = 660;  // 网格边长
    private currentPuzzleId: number = 1;
    private currentDifficulty: PuzzleDifficulty = PuzzleDifficulty.EASY;
    private gridRows: number = 3;
    private gridCols: number = 3;
    


    start() {
        this.uiManager = this.getComponent(UIManager) || this.node.parent?.getComponent(UIManager);
        
        // 绑定按钮事件
        this.btnBack?.node.on(Button.EventType.CLICK, this.onBackButtonClick, this);
        this.btnHint?.node.on(Button.EventType.CLICK, this.onHintButtonClick, this);
    }

    onDestroy() {
        // 移除事件监听
        this.btnBack?.node.off(Button.EventType.CLICK, this.onBackButtonClick, this);
        this.btnHint?.node.off(Button.EventType.CLICK, this.onHintButtonClick, this);
        
        // 清理拼图切片
        this.clearPuzzlePieces();
    }

    /**
     * 返回按钮点击事件
     */
    private onBackButtonClick(): void {
        console.log('[UISolvePuzzle] 点击返回选择拼图界面按钮');
        
        if (this.uiManager) {
            console.log('[UISolvePuzzle] 准备切换到选择拼图界面');
            this.uiManager.showSelectPuzzleOnly();
        } else {
            console.error('[UISolvePuzzle] UIManager未初始化，无法切换界面');
        }
     }
     
    /**
     * 提示按钮点击事件
     */
    private onHintButtonClick(): void {
        console.log('[UISolvePuzzle] 点击提示按钮');
        
        // 显示/隐藏提示图片
        if (this.hintImage) {
            const newState = !this.hintImage.active;
            this.hintImage.active = newState;
            console.log('[UISolvePuzzle] 提示图片状态:', newState ? '显示' : '隐藏');
        } else {
            console.error('[UISolvePuzzle] 提示图片节点未找到');
        }
    }

    /**
     * 界面显示时调用
     */
    public onShow(): void {
        const gameData = GameDataPuzzle.instance;
        if (gameData) {
            this.currentPuzzleId = gameData.getSelectedPuzzleId();
            this.currentDifficulty = gameData.getCurrentDifficulty();
            
            this.initializePuzzle();
        }
        // 声音按钮状态由UIManager统一更新
    }

    /**
     * 初始化拼图
     */
    private initializePuzzle(): void {
        const gameData = GameDataPuzzle.instance;
        if (!gameData) return;
        
        this.currentPuzzleId = gameData.getSelectedPuzzleId();
        this.currentDifficulty = gameData.getCurrentDifficulty();
        
        const gridSize = gameData.getPuzzleGridSize(this.currentDifficulty);
        this.gridRows = gridSize.rows;
        this.gridCols = gridSize.cols;
        
        console.log(`初始化拼图: ${this.currentPuzzleId}, 难度: ${this.currentDifficulty}, 网格: ${this.gridRows}x${this.gridCols}`);
        
        // 设置提示图片
        this.setupHintImage();
        
        // 创建网格槽位
        this.createGridSlots();
        
        // 创建拼图切片
        this.createPuzzlePieces();
        
        // 隐藏提示图片
        if (this.hintImage) {
            this.hintImage.active = false;
        }
    }

    /**
     * 设置提示图片
     */
    private setupHintImage(): void {
        if (!this.hintImage) return;
        
        const sprite = this.hintImage.getComponent(Sprite);
        const gameData = GameDataPuzzle.instance;
        
        if (sprite && gameData) {
            const spriteFrame = gameData.getPuzzleSpriteFrame(this.currentPuzzleId);
            if (spriteFrame) {
                sprite.spriteFrame = spriteFrame;
            }
        }
    }

    /**
     * 创建网格槽位
     */
    private createGridSlots(): void {
        if (!this.puzzleGrid || !this.gridPiecePrefab) {
            console.error('[UISolvePuzzle] puzzleGrid或gridPiecePrefab未设置');
            return;
        }
        
        // 清理现有网格槽位
        this.clearGridSlots();
        
        const totalSlots = this.gridRows * this.gridCols;
        const slotSize = this.gridSideLength / Math.max(this.gridRows, this.gridCols);
        
        // 计算网格起始位置（居中对齐）
        const startX = -(this.gridSideLength - slotSize) / 2;
        const startY = (this.gridSideLength - slotSize) / 2;
        
        for (let i = 0; i < totalSlots; i++) {
            const slotNode = instantiate(this.gridPiecePrefab);
            if (!slotNode) continue;
            
            // 计算网格位置
            const row = Math.floor(i / this.gridCols);
            const col = i % this.gridCols;
            
            const posX = startX + col * slotSize;
            const posY = startY - row * slotSize;
            
            slotNode.setPosition(posX, posY, 0);
            
            // 设置网格槽位尺寸
            const uiTransform = slotNode.getComponent(UITransform);
            if (uiTransform) {
                uiTransform.setContentSize(slotSize, slotSize);
            }
            
            // 设置网格槽位图片（根据行号+列号的奇偶性）
            const sprite = slotNode.getComponent(Sprite);
            if (sprite) {
                if ((row + col) % 2 === 0) {
                    sprite.spriteFrame = this.gridSpriteFrame0;
                } else {
                    sprite.spriteFrame = this.gridSpriteFrame1;
                }
            }
            
            // 添加到网格区域
            this.puzzleGrid.addChild(slotNode);
            this.gridSlots.push(slotNode);
        }
        
        console.log(`[UISolvePuzzle] 创建了${totalSlots}个网格槽位，网格大小：${this.gridRows}x${this.gridCols}，槽位尺寸：${slotSize}`);
    }

    /**
     * 创建拼图切片
     */
    private createPuzzlePieces(): void {
        if (!this.pieceContent || !this.puzzlePiecePrefab) return;
        
        // 清理现有切片
        this.clearPuzzlePieces();
        
        const totalPieces = this.gridRows * this.gridCols;
        
        for (let i = 0; i < totalPieces; i++) {
            const pieceNode = instantiate(this.puzzlePiecePrefab);
            if (!pieceNode) continue;
            
            const puzzlePiece = pieceNode.getComponent(PuzzlePiece);
            if (!puzzlePiece) {
                pieceNode.destroy();
                continue;
            }
            
            // 设置拼图切片信息
            const row = Math.floor(i / this.gridCols);
            const col = i % this.gridCols;
            puzzlePiece.setPieceInfo(i, row, col);
            
            // 设置拼图切片图片（这里需要根据实际需求实现切片逻辑）
            this.setupPieceSprite(pieceNode, i);
            
            // TODO: 设置拖拽回调
            
            // 添加到滚动列表
            this.pieceContent.addChild(pieceNode);
            this.puzzlePieces.push(puzzlePiece);
        }
        
        // 打乱拼图切片顺序
        this.shufflePieces();
    }

    /**
     * 设置拼图切片图片
     */
    private setupPieceSprite(pieceNode: Node, index: number): void {
        const sprite = pieceNode.getComponent(Sprite);
        const resourceManager = PuzzleResourceManager.instance;
        
        if (sprite && resourceManager) {
            const pieceSpriteFrame = resourceManager.getPuzzlePiece(
                this.currentPuzzleId, 
                this.gridRows, 
                this.gridCols, 
                index
            );
            
            if (pieceSpriteFrame) {
                sprite.spriteFrame = pieceSpriteFrame;
            }
        }
    }

    /**
     * 打乱拼图切片顺序
     */
    private shufflePieces(): void {
        // TODO: 打乱拼图切片顺序
    }

    /**
     * 将拼图切片放置到正确位置
     */
    private placePieceInCorrectPosition(piece: PuzzlePiece, slot: Node): void {
        // TODO: 拼图切片的槽位正确则按正确大小放置好
    }
    
    /**
     * 检查拼图是否完成
     */
    private checkPuzzleCompletion(): void {
        // TODO: 检查拼图是否完成
    }

    /**
     * 拼图完成处理
     */
    private onPuzzleCompleted(): void {
        console.log('拼图完成！');
        
        const gameData = GameDataPuzzle.instance;
        if (gameData) {
            // 更新存档数据
            gameData.completePuzzle(this.currentPuzzleId);
            
            // 跳转到完成界面
            if (this.uiManager) {
                this.uiManager.showFinishPuzzleOnly();
            }
        }
    }

    /**
     * 清理网格槽位
     */
    private clearGridSlots(): void {
        for (const slot of this.gridSlots) {
            if (slot && slot.isValid) {
                slot.destroy();
            }
        }
        this.gridSlots = [];
    }

    /**
     * 清理拼图切片
     */
    private clearPuzzlePieces(): void {
        for (const piece of this.puzzlePieces) {
            if (piece && piece.node && piece.node.isValid) {
                piece.node.destroy();
            }
        }
        this.puzzlePieces = [];
    }

    update(deltaTime: number) {
        
    }
}