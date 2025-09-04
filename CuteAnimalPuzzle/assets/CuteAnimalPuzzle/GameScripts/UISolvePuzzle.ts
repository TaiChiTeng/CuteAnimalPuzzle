import { _decorator, Component, Node, Button, ScrollView, Prefab, instantiate, Sprite, SpriteFrame, UITransform, Vec3, EventMouse, input, Input, EventTouch, UIOpacity} from 'cc';
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
    public puzzleAnswers: Node = null;  // 拼图答案父节点
    @property(Node)
    public puzzleGrid: Node = null;  // 拼图网格父节点

    @property(Node)
    public dragArea: Node = null;    // 拖拽区域

    @property(ScrollView)
    public pieceScrollView: ScrollView = null;

    @property(Node)
    public pieceContent: Node = null;

    // 从底部列表拖拽出来，未正确放入网格的拼图切片预制体
    @property(Prefab)
    public dragPiecePrefab: Prefab = null;

    // 底部列表的拼图切片预制体
    @property(Prefab)
    public puzzlePiecePrefab: Prefab = null;

    // 网格拼图切片答案预制体，用于显示正确的拼图位置
    @property(Prefab)
    public gridPieceAnswerPrefab: Prefab = null;

    // 网格拼图切片预制体，类似国际象棋的棋盘格子相间一黑一白的效果
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
    private gridAnswerSlots: Node[] = [];  // 答案槽位
    private dragPieceSlots: Node[] = [];  // 拖拽出列表的拼图切片数组
    private dragSideLength: number = 720;  // 拖拽出列表的拼图切片总边长
    private currentDragPiece: Node = null;  // 当前正在拖动的拼图切片
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
        
        // 绑定鼠标事件
        this.setupMouseEvents();
    }

    onDestroy() {
        // 移除事件监听
        this.btnBack?.node.off(Button.EventType.CLICK, this.onBackButtonClick, this);
        this.btnHint?.node.off(Button.EventType.CLICK, this.onHintButtonClick, this);
        
        // 移除鼠标事件
        this.removeMouseEvents();
        
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
     * 设置鼠标事件
     */
    private setupMouseEvents(): void {
        if (!this.dragArea) {
            console.error('[UISolvePuzzle] dragArea未设置，无法绑定鼠标事件');
            return;
        }
        
        // 添加鼠标按下事件
        this.dragArea.on(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
        // 添加鼠标移动事件
        this.dragArea.on(Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
        // 添加鼠标松开事件
        this.dragArea.on(Node.EventType.MOUSE_UP, this.onMouseUp, this);
        
        // 不再在鼠标离开时触发onMouseUp，允许鼠标移出区域继续拖动
        
        // 添加触摸事件（兼容移动设备）
        this.dragArea.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.dragArea.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.dragArea.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.dragArea.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        
        console.log('[UISolvePuzzle] 已绑定鼠标和触摸事件');
    }
    
    /**
     * 移除鼠标事件
     */
    private removeMouseEvents(): void {
        if (!this.dragArea) return;
        
        // 移除鼠标事件
        this.dragArea.off(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
        this.dragArea.off(Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
        this.dragArea.off(Node.EventType.MOUSE_UP, this.onMouseUp, this);
        // 不再需要移除MOUSE_LEAVE事件
        
        // 移除触摸事件
        this.dragArea.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.dragArea.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.dragArea.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.dragArea.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        
        console.log('[UISolvePuzzle] 已移除鼠标和触摸事件');
    }
    
    /**
     * 鼠标按下事件处理
     */
    private onMouseDown(event: EventMouse): void {
        if (!this.dragPiecePrefab || !this.dragArea) return;
        
        // 创建拖拽预制体
        this.createDragPiece(event.getUILocation().x, event.getUILocation().y);
    }
    
    /**
     * 鼠标移动事件处理
     */
    private onMouseMove(event: EventMouse): void {
        if (!this.currentDragPiece) return;
        
        // 更新拖拽预制体位置
        this.updateDragPiecePosition(event.getUILocation().x, event.getUILocation().y);
    }
    
    /**
     * 鼠标松开事件处理
     */
    private onMouseUp(event: EventMouse): void {
        // 删除拖拽预制体
        this.destroyDragPiece();
    }
    
    /**
     * 触摸开始事件处理（兼容移动设备）
     */
    private onTouchStart(event: EventTouch): void {
        if (!this.dragPiecePrefab || !this.dragArea) return;
        
        // 创建拖拽预制体
        this.createDragPiece(event.getUILocation().x, event.getUILocation().y);
    }
    
    /**
     * 触摸移动事件处理（兼容移动设备）
     */
    private onTouchMove(event: EventTouch): void {
        if (!this.currentDragPiece) return;
        
        // 更新拖拽预制体位置
        this.updateDragPiecePosition(event.getUILocation().x, event.getUILocation().y);
    }
    
    /**
     * 触摸结束事件处理（兼容移动设备）
     */
    private onTouchEnd(event: EventTouch): void {
        // 删除拖拽预制体
        this.destroyDragPiece();
    }
    
    /**
     * 创建拖拽预制体
     */
    private createDragPiece(x: number, y: number): void {
        // 如果已经存在拖拽预制体，先销毁
        this.destroyDragPiece();
        
        // 创建新的拖拽预制体
        this.currentDragPiece = instantiate(this.dragPiecePrefab);
        if (!this.currentDragPiece) {
            console.error('[UISolvePuzzle] 无法创建拖拽预制体');
            return;
        }
        
        // 设置名称便于识别
        this.currentDragPiece.name = 'DragPiece';
        
        // 设置拖拽预制体尺寸
        const pieceSize = this.dragSideLength / Math.max(this.gridRows, this.gridCols);
        const uiTransform = this.currentDragPiece.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(pieceSize, pieceSize);
        }
        
        // 设置拖拽预制体图片（与puzzlePieces[0]相同）
        const sprite = this.currentDragPiece.getComponent(Sprite);
        const resourceManager = PuzzleResourceManager.instance;
        
        if (sprite && resourceManager && this.puzzlePieces.length > 0) {
            // 获取第一个拼图切片的索引
            const firstPieceIndex = this.puzzlePieces[0].pieceIndex;
            
            // 获取对应的图片
            const pieceSpriteFrame = resourceManager.getPuzzlePiece(
                this.currentPuzzleId, 
                this.gridRows, 
                this.gridCols, 
                firstPieceIndex
            );
            
            if (pieceSpriteFrame) {
                sprite.spriteFrame = pieceSpriteFrame;
            } else {
                console.warn('[UISolvePuzzle] 无法获取拖拽预制体的图片');
            }
        }
        
        // 将拖拽预制体添加到拖拽区域
        this.dragArea.addChild(this.currentDragPiece);
        
        // 设置拖拽预制体位置
        this.updateDragPiecePosition(x, y);
        
        console.log('[UISolvePuzzle] 创建了拖拽预制体，尺寸：' + pieceSize);
    }
    
    /**
     * 更新拖拽预制体位置
     */
    private updateDragPiecePosition(x: number, y: number): void {
        if (!this.currentDragPiece || !this.dragArea) return;
        
        // 将屏幕坐标转换为节点本地坐标
        const worldPos = new Vec3(x, y, 0);
        const localPos = new Vec3();
        const dragAreaTransform = this.dragArea.getComponent(UITransform);
        dragAreaTransform.convertToNodeSpaceAR(worldPos, localPos);
        
        // 限制拖拽预制体在dragArea区域内
        const dragAreaWidth = dragAreaTransform.width;
        const dragAreaHeight = dragAreaTransform.height;
        const pieceTransform = this.currentDragPiece.getComponent(UITransform);
        const pieceWidth = pieceTransform ? pieceTransform.width : 0;
        const pieceHeight = pieceTransform ? pieceTransform.height : 0;
        
        // 计算边界限制
        const halfWidth = dragAreaWidth / 2;
        const halfHeight = dragAreaHeight / 2;
        const halfPieceWidth = pieceWidth / 2;
        const halfPieceHeight = pieceHeight / 2;
        
        // 限制X坐标在区域内
        if (localPos.x < -halfWidth + halfPieceWidth) {
            localPos.x = -halfWidth + halfPieceWidth;
        } else if (localPos.x > halfWidth - halfPieceWidth) {
            localPos.x = halfWidth - halfPieceWidth;
        }
        
        // 限制Y坐标在区域内
        if (localPos.y < -halfHeight + halfPieceHeight) {
            localPos.y = -halfHeight + halfPieceHeight;
        } else if (localPos.y > halfHeight - halfPieceHeight) {
            localPos.y = halfHeight - halfPieceHeight;
        }
        
        // 设置拖拽预制体位置
        this.currentDragPiece.setPosition(localPos);
    }
    
    /**
     * 销毁拖拽预制体
     */
    private destroyDragPiece(): void {
        if (!this.currentDragPiece) return;
        
        // 销毁拖拽预制体
        this.currentDragPiece.destroy();
        this.currentDragPiece = null;
        
        console.log('[UISolvePuzzle] 销毁了拖拽预制体');
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
            
            // 添加点击事件监听器
            slotNode.on(Node.EventType.TOUCH_END, () => {
                this.onGridSlotClicked(i);
            }, this);
            
            // 添加到网格区域
            this.puzzleGrid.addChild(slotNode);
            this.gridSlots.push(slotNode);
        }
        
        console.log(`[UISolvePuzzle] 创建了${totalSlots}个网格槽位，网格大小：${this.gridRows}x${this.gridCols}，槽位尺寸：${slotSize}`);
    }

    /**
     * 处理网格槽位点击事件
     */
    private onGridSlotClicked(slotIndex: number): void {
        if (!this.gridPieceAnswerPrefab || !this.puzzleAnswers || slotIndex < 0 || slotIndex >= this.gridSlots.length) {
            console.error('[UISolvePuzzle] gridPieceAnswerPrefab或puzzleAnswers未设置或槽位索引无效');
            return;
        }
        
        const slotNode = this.gridSlots[slotIndex];
        if (!slotNode) {
            console.error('[UISolvePuzzle] 找不到对应的网格槽位');
            return;
        }
        
        // 检查是否已经存在答案切片，如果存在则移除
        if (this.gridAnswerSlots[slotIndex]) {
            this.gridAnswerSlots[slotIndex].destroy();
            this.gridAnswerSlots[slotIndex] = null;
            return;
        }
        
        // 创建答案切片
        const answerPiece = instantiate(this.gridPieceAnswerPrefab);
        if (!answerPiece) {
            console.error('[UISolvePuzzle] 无法创建答案切片');
            return;
        }
        
        // 设置名称便于识别
        answerPiece.name = `AnswerPiece_${slotIndex}`;
        
        // 设置答案切片的尺寸与槽位一致
        const slotTransform = slotNode.getComponent(UITransform);
        const answerTransform = answerPiece.getComponent(UITransform);
        if (slotTransform && answerTransform) {
            answerTransform.setContentSize(slotTransform.contentSize);
        }
        
        // 设置答案切片的位置与槽位一致
        const slotWorldPos = slotNode.getWorldPosition();
        const puzzleAnswersWorldPos = this.puzzleAnswers.getWorldPosition();
        const localPos = new Vec3();
        this.puzzleAnswers.getComponent(UITransform).convertToNodeSpaceAR(slotWorldPos, localPos);
        answerPiece.setPosition(localPos);
        
        // 设置答案切片的图片
        this.setupAnswerPieceSprite(answerPiece, slotIndex);
        
        // 将答案切片添加到puzzleAnswers父节点
        this.puzzleAnswers.addChild(answerPiece);
        
        // 保存到答案槽位数组
        this.gridAnswerSlots[slotIndex] = answerPiece;
        
        console.log(`[UISolvePuzzle] 在puzzleAnswers下创建了槽位${slotIndex}的答案切片`);
    }
    
    /**
     * 设置答案切片的图片
     */
    private setupAnswerPieceSprite(answerPiece: Node, slotIndex: number): void {
        const sprite = answerPiece.getComponent(Sprite);
        const resourceManager = PuzzleResourceManager.instance;
        
        if (sprite && resourceManager) {
            const pieceSpriteFrame = resourceManager.getPuzzlePiece(
                this.currentPuzzleId, 
                this.gridRows, 
                this.gridCols, 
                slotIndex
            );
            
            if (pieceSpriteFrame) {
                sprite.spriteFrame = pieceSpriteFrame;
            } else {
                console.warn(`[UISolvePuzzle] 无法获取槽位${slotIndex}的拼图切片图片`);
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
        // 清理答案切片
        for (let i = 0; i < this.gridAnswerSlots.length; i++) {
            if (this.gridAnswerSlots[i] && this.gridAnswerSlots[i].isValid) {
                this.gridAnswerSlots[i].destroy();
            }
        }
        this.gridAnswerSlots = [];
        
        for (const slot of this.gridSlots) {
            if (slot && slot.isValid) {
                // 移除事件监听器
                slot.off(Node.EventType.TOUCH_END);
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