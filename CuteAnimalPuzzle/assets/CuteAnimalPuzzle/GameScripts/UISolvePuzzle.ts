import { _decorator, Component, Node, Button, ScrollView, Prefab, instantiate, Sprite, SpriteFrame, UITransform, Vec3, Layout, Input } from 'cc';
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

    // 拼图资源管理器将自动处理资源

    private uiManager: UIManager = null;
    private puzzlePieces: PuzzlePiece[] = [];
    private gridSlots: Node[] = [];  // 网格槽位
    private currentPuzzleId: number = 1;
    private currentDifficulty: PuzzleDifficulty = PuzzleDifficulty.EASY;
    private gridRows: number = 3;
    private gridCols: number = 3;
    private slotSize: number = 100;  // 槽位大小
    private snapDistance: number = 50;  // 吸附距离

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
        console.log('点击返回选择拼图界面按钮');
        
        if (this.uiManager) {
            this.uiManager.showSelectPuzzleOnly();
        }
    }

    /**
     * 提示按钮点击事件
     */
    private onHintButtonClick(): void {
        console.log('点击提示按钮');
        
        if (this.hintImage) {
            this.hintImage.active = !this.hintImage.active;
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
        if (!this.puzzleGrid) return;
        
        // 清理现有槽位
        this.clearGridSlots();
        
        const gridTransform = this.puzzleGrid.getComponent(UITransform);
        if (!gridTransform) return;
        
        const gridSize = gridTransform.contentSize;
        this.slotSize = Math.min(gridSize.width / this.gridCols, gridSize.height / this.gridRows) * 0.9;
        
        const startX = -(this.gridCols - 1) * this.slotSize / 2;
        const startY = (this.gridRows - 1) * this.slotSize / 2;
        
        for (let row = 0; row < this.gridRows; row++) {
            for (let col = 0; col < this.gridCols; col++) {
                const slot = new Node(`Slot_${row}_${col}`);
                const slotTransform = slot.addComponent(UITransform);
                slotTransform.setContentSize(this.slotSize, this.slotSize);
                
                const x = startX + col * this.slotSize;
                const y = startY - row * this.slotSize;
                slot.setPosition(x, y, 0);
                
                this.puzzleGrid.addChild(slot);
                this.gridSlots.push(slot);
            }
        }
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
            
            // 设置拖拽回调
            puzzlePiece.onDragStart = this.onPieceDragStart.bind(this);
            puzzlePiece.onDragMove = this.onPieceDragMove.bind(this);
            puzzlePiece.onDragEnd = this.onPieceDragEnd.bind(this);
            
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
        const pieces = [...this.puzzlePieces];
        
        // Fisher-Yates 洗牌算法
        for (let i = pieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
        }
        
        // 重新排列节点顺序
        for (let i = 0; i < pieces.length; i++) {
            pieces[i].node.setSiblingIndex(i);
        }
    }

    /**
     * 拼图切片开始拖拽
     */
    private onPieceDragStart(piece: PuzzlePiece): void {
        console.log(`拼图切片 ${piece.pieceIndex} 开始拖拽`);
    }

    /**
     * 拼图切片拖拽移动
     */
    private onPieceDragMove(piece: PuzzlePiece, worldPos: Vec3): void {
        // 可以在这里实现拖拽时的视觉反馈
    }

    /**
     * 拼图切片结束拖拽
     */
    private onPieceDragEnd(piece: PuzzlePiece, worldPos: Vec3): void {
        console.log(`拼图切片 ${piece.pieceIndex} 结束拖拽`);
        
        // 检查是否拖拽到正确位置
        const correctSlotIndex = piece.getCorrectIndex(this.gridCols);
        const correctSlot = this.gridSlots[correctSlotIndex];
        
        if (correctSlot && piece.getDistanceToPosition(correctSlot.getWorldPosition()) < this.snapDistance) {
            // 拖拽到正确位置
            this.placePieceInCorrectPosition(piece, correctSlot);
            this.checkPuzzleCompletion();
        } else {
            // 检查是否在拖拽区域内
            if (this.dragArea && piece.isInArea(this.dragArea)) {
                // 停留在拖拽区域
                console.log('拼图切片停留在拖拽区域');
            } else {
                // 拖回原位置
                piece.resetToOriginalPosition();
            }
        }
    }

    /**
     * 将拼图切片放置到正确位置
     */
    private placePieceInCorrectPosition(piece: PuzzlePiece, slot: Node): void {
        console.log(`拼图切片 ${piece.pieceIndex} 放置到正确位置`);
        
        piece.moveToPosition(slot, Vec3.ZERO);
        
        // 禁用拖拽（已放置正确）
        piece.node.off(Input.EventType.TOUCH_START);
        piece.node.off(Input.EventType.TOUCH_MOVE);
        piece.node.off(Input.EventType.TOUCH_END);
    }

    /**
     * 检查拼图是否完成
     */
    private checkPuzzleCompletion(): void {
        let completedPieces = 0;
        
        for (const piece of this.puzzlePieces) {
            const correctSlotIndex = piece.getCorrectIndex(this.gridCols);
            const correctSlot = this.gridSlots[correctSlotIndex];
            
            if (correctSlot && piece.node.parent === correctSlot) {
                completedPieces++;
            }
        }
        
        console.log(`已完成拼图切片: ${completedPieces}/${this.puzzlePieces.length}`);
        
        if (completedPieces === this.puzzlePieces.length) {
            this.onPuzzleCompleted();
        }
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