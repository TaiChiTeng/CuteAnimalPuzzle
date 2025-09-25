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

    @property(Button)
    public btnHideHint: Button = null;

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

    // 统一的拼图切片预制体，用于底部列表、拖拽状态和网格答案显示
    // 预制体配置是：itemPuzzlePiece
    @property(Prefab)
    public puzzlePiecePrefab: Prefab = null;

    // 网格拼图切片预制体，类似国际象棋的棋盘格子相间一黑一白的效果
    // 预制体配置是：itemPieceGrid
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
    private dragSideLength: number = 660;  // 拖拽出列表的拼图切片总边长
    private currentDragPiece: Node = null;  // 当前正在拖动的拼图切片
    private currentDraggedPuzzlePiece: PuzzlePiece = null;  // 当前被拖拽的原始拼图切片
    private isDragFromPuzzleList: boolean = false;  // 标记当前拖拽是否来自puzzlePieces列表
    private isDragging: boolean = false;  // 拖拽状态锁，防止并发拖拽
    
    // 事件监听器状态管理
    private isGlobalEventsRegistered: boolean = false;
    
    // 数组操作锁，防止竞态条件
    private isArrayOperationLocked: boolean = false;
    private gridSideLength: number = 660;  // 网格边长
    private currentPuzzleId: number = 1;
    private currentDifficulty: PuzzleDifficulty = PuzzleDifficulty.EASY;
    private gridRows: number = 3;
    private gridCols: number = 3;
   
    // 容错率，用于计算动态容错距离
    private toleranceRate: number = 0.45;

    start() {
        this.uiManager = this.getComponent(UIManager) || this.node.parent?.getComponent(UIManager);
        
        // 绑定按钮事件
        this.btnBack?.node.on(Button.EventType.CLICK, this.onBackButtonClick, this);
        this.btnHint?.node.on(Button.EventType.CLICK, this.onHintButtonClick, this);
        this.btnHideHint?.node.on(Button.EventType.CLICK, this.onHideHintButtonClick, this);
        
        // 设置提示按钮的初始状态
        this.initializeHintButtonsState();
    }


    
    /**
     * 计算sprIcon的尺寸和位置偏移（基于表格参数的精确计算体系）
     */
    private calculateSprIconSizeAndPosition(slotIndex: number, rows: number, cols: number): {
        width: number, 
        height: number, 
        offsetX: number, 
        offsetY: number
    } {
        // 基于表格参数的标准化计算（与PuzzleResourceManager保持一致）
        const PuzzleRealLength = 660;  // 游戏中实际图标边长
        const maskRefSquareSide = 92;  // 适宜基准中正方形边长
        const maskRefSemiCircleRadius = 18;  // 适宜基准半圆半径
        const difficulty = rows;  // 难度等于行数
        
        // 计算基础参数
        const maskSquareSide = Math.round(PuzzleRealLength / difficulty);
        const maskSemiCircleRadius = Math.ceil(maskSquareSide / maskRefSquareSide * maskRefSemiCircleRadius);  // 向上取整避免小数
        const MaskSide = Math.round(maskSquareSide + maskSemiCircleRadius * 2);
        const LeftCornerSide = MaskSide - maskSemiCircleRadius;
        
        // 计算切片在网格中的位置
        const row = Math.floor(slotIndex / cols);
        const col = slotIndex % cols;
        
        // 判断切片类型
        const isTopEdge = row === 0;
        const isBottomEdge = row === rows - 1;
        const isLeftEdge = col === 0;
        const isRightEdge = col === cols - 1;
        const isCorner = (isTopEdge || isBottomEdge) && (isLeftEdge || isRightEdge);
        const isEdge = isTopEdge || isBottomEdge || isLeftEdge || isRightEdge;
        
        // 基于表格参数计算sprIcon尺寸和偏移
        let sprIconWidth: number, sprIconHeight: number;
        let offsetX: number, offsetY: number;
        const halfRadius = Math.round(maskSemiCircleRadius / 2);  // 偏移距离为半圆半径的一半
        
        if (isCorner) {
            // 角落切片：使用LeftCornerSide尺寸
            sprIconWidth = LeftCornerSide;
            sprIconHeight = LeftCornerSide;
            
            if (isTopEdge && isLeftEdge) {
                // 左上角：偏移(+halfRadius, -halfRadius)
                offsetX = halfRadius;
                offsetY = -halfRadius;
            } else if (isTopEdge && isRightEdge) {
                // 右上角：偏移(-halfRadius, -halfRadius)
                offsetX = -halfRadius;
                offsetY = -halfRadius;
            } else if (isBottomEdge && isLeftEdge) {
                // 左下角：偏移(+halfRadius, +halfRadius)
                offsetX = halfRadius;
                offsetY = halfRadius;
            } else {
                // 右下角：偏移(-halfRadius, +halfRadius)
                offsetX = -halfRadius;
                offsetY = halfRadius;
            }
        } else if (isEdge) {
            if (isTopEdge || isBottomEdge) {
                // 上下边缘：宽度使用MaskSide，高度使用LeftCornerSide
                sprIconWidth = MaskSide;
                sprIconHeight = LeftCornerSide;
                offsetX = 0;
                offsetY = isTopEdge ? -halfRadius : halfRadius;
            } else {
                // 左右边缘：宽度使用LeftCornerSide，高度使用MaskSide
                sprIconWidth = LeftCornerSide;
                sprIconHeight = MaskSide;
                offsetX = isLeftEdge ? halfRadius : -halfRadius;
                offsetY = 0;
            }
        } else {
            // 中间切片：使用MaskSide尺寸，无偏移
            sprIconWidth = MaskSide;
            sprIconHeight = MaskSide;
            offsetX = 0;
            offsetY = 0;
        }
        
        console.log(`[UISolvePuzzle] 切片${slotIndex}[${row},${col}] 难度${difficulty}x${difficulty}, 类型: ${isCorner ? '角落' : isEdge ? '边缘' : '中间'}, sprIcon尺寸: ${sprIconWidth}x${sprIconHeight}, 偏移: (${offsetX}, ${offsetY})`);
        console.log(`[UISolvePuzzle] 参数详情 - maskSquareSide: ${maskSquareSide}, maskSemiCircleRadius: ${maskSemiCircleRadius}, MaskSide: ${MaskSide}, LeftCornerSide: ${LeftCornerSide}`);
        
        return {
            width: sprIconWidth,
            height: sprIconHeight,
            offsetX: offsetX,
            offsetY: offsetY
        };
    }

    onDestroy() {
        // 移除事件监听
        this.btnBack?.node.off(Button.EventType.CLICK, this.onBackButtonClick, this);
        this.btnHint?.node.off(Button.EventType.CLICK, this.onHintButtonClick, this);
        this.btnHideHint?.node.off(Button.EventType.CLICK, this.onHideHintButtonClick, this);
        
        // 移除拼图切片的鼠标事件
        this.removePieceMouseEvents();
        
        // 清理拼图切片
        this.clearPuzzlePieces();
    }

    /**
     * 返回按钮点击事件
     */
    private onBackButtonClick(): void {
        console.log('[UISolvePuzzle] 点击返回选择拼图界面按钮');
        
        // 执行完整的清理逻辑
        this.cleanupBeforeExit();
        
        if (this.uiManager) {
            console.log('[UISolvePuzzle] 准备切换到选择拼图界面');
            this.uiManager.showSelectPuzzleOnly();
        } else {
            console.error('[UISolvePuzzle] UIManager未初始化，无法切换界面');
        }
     }
     
    /**
     * 退出前的完整清理逻辑
     */
    private cleanupBeforeExit(): void {
        try {
            console.log('[UISolvePuzzle] 开始执行退出前清理');
            
            // 强制清理拖拽状态
            this.forceCleanupDragState();
            
            // 注销全局事件
            this.unregisterGlobalEvents();
            
            // 移除拼图切片的鼠标事件
            this.removePieceMouseEvents();
            
            // 清理dragPieceSlots中的切片
            this.clearDragPieceSlots();
            
            // 清理网格答案槽位
            this.clearGridAnswerSlots();
            
            // 重置状态标志
            this.isDragging = false;
            this.isDragFromPuzzleList = false;
            this.isArrayOperationLocked = false;
            this.currentDragPiece = null;
            this.currentDraggedPuzzlePiece = null;
            
            console.log('[UISolvePuzzle] 退出前清理完成');
        } catch (error) {
            console.error('[UISolvePuzzle] 退出前清理异常:', error);
        }
    }
    
    /**
     * 清理dragPieceSlots中的所有切片
     */
    private clearDragPieceSlots(): void {
        try {
            this.dragPieceSlots.forEach(piece => {
                if (piece && piece.isValid) {
                    piece.destroy();
                }
            });
            this.dragPieceSlots.length = 0;
            console.log('[UISolvePuzzle] 已清理dragPieceSlots');
        } catch (error) {
            console.error('[UISolvePuzzle] 清理dragPieceSlots异常:', error);
        }
    }
    
    /**
     * 清理网格答案槽位
     */
    private clearGridAnswerSlots(): void {
        try {
            this.gridAnswerSlots.forEach(slot => {
                if (slot && slot.isValid) {
                    slot.destroy();
                }
            });
            this.gridAnswerSlots.length = 0;
            console.log('[UISolvePuzzle] 已清理gridAnswerSlots');
        } catch (error) {
            console.error('[UISolvePuzzle] 清理gridAnswerSlots异常:', error);
        }
    }
     
    /**
     * 初始化提示按钮状态
     */
    private initializeHintButtonsState(): void {
        // 默认隐藏提示图片
        if (this.hintImage) {
            this.hintImage.active = false;
        }
        
        // 显示开启提示按钮，隐藏关闭提示按钮
        if (this.btnHint?.node) {
            this.btnHint.node.active = true;
        }
        if (this.btnHideHint?.node) {
            this.btnHideHint.node.active = false;
        }
        
        console.log('[UISolvePuzzle] 提示按钮初始状态设置完成');
    }

    /**
     * 开启提示按钮点击事件
     */
    private onHintButtonClick(): void {
        console.log('[UISolvePuzzle] 点击开启提示按钮');
        
        // 显示提示图片
        if (this.hintImage) {
            this.hintImage.active = true;
            console.log('[UISolvePuzzle] 显示提示图片');
        } else {
            console.error('[UISolvePuzzle] 提示图片节点未找到');
        }
        
        // 隐藏开启提示按钮，显示关闭提示按钮
        if (this.btnHint?.node) {
            this.btnHint.node.active = false;
        }
        if (this.btnHideHint?.node) {
            this.btnHideHint.node.active = true;
        }
    }

    /**
     * 关闭提示按钮点击事件
     */
    private onHideHintButtonClick(): void {
        console.log('[UISolvePuzzle] 点击关闭提示按钮');
        
        // 隐藏提示图片
        if (this.hintImage) {
            this.hintImage.active = false;
            console.log('[UISolvePuzzle] 隐藏提示图片');
        } else {
            console.error('[UISolvePuzzle] 提示图片节点未找到');
        }
        
        // 显示开启提示按钮，隐藏关闭提示按钮
        if (this.btnHint?.node) {
            this.btnHint.node.active = true;
        }
        if (this.btnHideHint?.node) {
            this.btnHideHint.node.active = false;
        }
    }

    /**
     * 为拼图切片设置鼠标事件
     */
    private setupPieceMouseEvents(pieceNode: Node, puzzlePiece: PuzzlePiece): void {
        if (!pieceNode || !puzzlePiece) return;
        
        // 添加鼠标按下事件
        pieceNode.on(Node.EventType.MOUSE_DOWN, (event: EventMouse) => {
            this.onPieceMouseDown(event, puzzlePiece);
        }, this);
        
        // 添加触摸开始事件（兼容移动设备）
        pieceNode.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            this.onPieceTouchStart(event, puzzlePiece);
        }, this);
        
        console.log(`[UISolvePuzzle] 为拼图切片${puzzlePiece.pieceIndex}绑定了鼠标和触摸事件`);
    }
    
    /**
     * 为dragPieceSlots中的切片绑定鼠标和触摸事件
     */
    private setupDragPieceEvents(dragPieceNode: Node, pieceIndex: number): void {
        if (!dragPieceNode) return;
        
        // 绑定鼠标事件
        dragPieceNode.on(Node.EventType.MOUSE_DOWN, (event: EventMouse) => {
            this.onDragPieceMouseDown(event, dragPieceNode, pieceIndex);
        }, this);
        
        // 绑定触摸事件（兼容移动设备）
        dragPieceNode.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            this.onDragPieceTouchStart(event, dragPieceNode, pieceIndex);
        }, this);
        
        console.log(`[UISolvePuzzle] 为dragPieceSlots切片${pieceIndex}绑定了鼠标和触摸事件`);
    }
    
    /**
     * 移除拼图切片的鼠标事件
     */
    private removePieceMouseEvents(): void {
        this.puzzlePieces.forEach(puzzlePiece => {
            if (puzzlePiece && puzzlePiece.node && puzzlePiece.node.isValid) {
                puzzlePiece.node.off(Node.EventType.MOUSE_DOWN);
                puzzlePiece.node.off(Node.EventType.TOUCH_START);
            }
        });
        
        console.log('[UISolvePuzzle] 已移除拼图切片的鼠标和触摸事件');
    }
    
    /**
     * 拼图切片鼠标按下事件处理
     */
    private onPieceMouseDown(event: EventMouse, puzzlePiece: PuzzlePiece): void {
        // 检查是否已经在拖拽中
        if (this.isDragging) {
            return;
        }
        
        if (!this.puzzlePiecePrefab || !this.dragArea || !puzzlePiece) return;
        
        // 设置拖拽状态锁
        this.isDragging = true;
        
        // 阻止事件传播，避免触发其他鼠标事件
        event.propagationStopped = true;
        
        // 创建拖拽预制体并从列表中移除原切片
        this.createDragPieceFromPuzzlePiece(event.getUILocation().x, event.getUILocation().y, puzzlePiece);
        
        // 绑定全局鼠标事件（避免重复绑定）
        this.registerGlobalMouseEvents();
        
        console.log(`[UISolvePuzzle] 鼠标按下事件处理完成，切片${puzzlePiece.pieceIndex}`);
    }
    
    /**
     * 拼图切片触摸开始事件处理（兼容移动设备）
     */
    private onPieceTouchStart(event: EventTouch, puzzlePiece: PuzzlePiece): void {
        // 检查是否已经在拖拽中
        if (this.isDragging) {
            return;
        }
        
        if (!this.puzzlePiecePrefab || !this.dragArea || !puzzlePiece) return;
        
        // 设置拖拽状态锁
        this.isDragging = true;
        
        // 阻止事件传播，避免触发其他触摸事件
        event.propagationStopped = true;
        
        // 创建拖拽预制体并从列表中移除原切片
        this.createDragPieceFromPuzzlePiece(event.getUILocation().x, event.getUILocation().y, puzzlePiece);
        
        // 绑定全局触摸事件（避免重复绑定）
        this.registerGlobalTouchEvents();
        
        console.log(`[UISolvePuzzle] 触摸开始事件处理完成，切片${puzzlePiece.pieceIndex}`);
    }
    
    /**
     * dragPieceSlots切片鼠标按下事件处理
     */
    private onDragPieceMouseDown(event: EventMouse, dragPieceNode: Node, pieceIndex: number): void {
        // 检查是否已经在拖拽中
        if (this.isDragging) {
            return;
        }
        
        console.log(`[UISolvePuzzle] dragPieceSlots切片${pieceIndex}鼠标按下`);
        event.propagationStopped = true;
        
        // 设置拖拽状态锁
        this.isDragging = true;
        
        // 创建拖拽预制体
        this.createDragPieceFromDragPiece(event.getUILocation().x, event.getUILocation().y, dragPieceNode, pieceIndex);
        
        // 绑定全局鼠标事件（避免重复绑定）
        this.registerGlobalMouseEvents();
    }
    
    /**
     * dragPieceSlots切片触摸开始事件处理（兼容移动设备）
     */
    private onDragPieceTouchStart(event: EventTouch, dragPieceNode: Node, pieceIndex: number): void {
        // 检查是否已经在拖拽中
        if (this.isDragging) {
            return;
        }
        
        console.log(`[UISolvePuzzle] dragPieceSlots切片${pieceIndex}触摸开始`);
        event.propagationStopped = true;
        
        // 设置拖拽状态锁
        this.isDragging = true;
        
        // 创建拖拽预制体
        this.createDragPieceFromDragPiece(event.getUILocation().x, event.getUILocation().y, dragPieceNode, pieceIndex);
        
        // 绑定全局触摸事件（避免重复绑定）
        this.registerGlobalTouchEvents();
    }
    
    /**
     * 全局鼠标移动事件处理
     */
    private onGlobalMouseMove(event: EventMouse): void {
        if (!this.currentDragPiece) return;
        
        // 更新拖拽预制体位置
        this.updateDragPiecePosition(event.getUILocation().x, event.getUILocation().y);
    }
    
    /**
     * 全局鼠标松开事件处理
     */
    private onGlobalMouseUp(event: EventMouse): void {
        console.log('[UISolvePuzzle] 全局鼠标松开事件触发');
        
        // 执行新的拖拽结束逻辑
        this.handleDragEnd();
        
        // 移除input全局事件监听
        this.unregisterGlobalEvents();
    }
    
    /**
     * 全局触摸移动事件处理（兼容移动设备）
     */
    private onGlobalTouchMove(event: EventTouch): void {
        if (!this.currentDragPiece) return;
        
        // 更新拖拽预制体位置
        this.updateDragPiecePosition(event.getUILocation().x, event.getUILocation().y);
    }
    
    /**
     * 全局触摸结束事件处理（兼容移动设备）
     */
    private onGlobalTouchEnd(event: EventTouch): void {
        console.log('[UISolvePuzzle] 全局触摸结束事件触发');
        
        // 执行新的拖拽结束逻辑
        this.handleDragEnd();
        
        // 移除input全局事件监听
        this.unregisterGlobalEvents();
    }
    
    /**
     * 注册全局鼠标事件
     */
    private registerGlobalMouseEvents(): void {
        if (!this.isGlobalEventsRegistered) {
            input.on(Input.EventType.MOUSE_MOVE, this.onGlobalMouseMove, this);
            input.on(Input.EventType.MOUSE_UP, this.onGlobalMouseUp, this);
            this.isGlobalEventsRegistered = true;
            console.log('[UISolvePuzzle] 注册了全局鼠标事件');
        }
    }
    
    /**
     * 注册全局触摸事件
     */
    private registerGlobalTouchEvents(): void {
        if (!this.isGlobalEventsRegistered) {
            input.on(Input.EventType.TOUCH_MOVE, this.onGlobalTouchMove, this);
            input.on(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
            input.on(Input.EventType.TOUCH_CANCEL, this.onGlobalTouchEnd, this);
            this.isGlobalEventsRegistered = true;
            console.log('[UISolvePuzzle] 注册了全局触摸事件');
        }
    }
    
    /**
     * 注销全局事件
     */
    private unregisterGlobalEvents(): void {
        if (this.isGlobalEventsRegistered) {
            input.off(Input.EventType.MOUSE_MOVE, this.onGlobalMouseMove, this);
            input.off(Input.EventType.MOUSE_UP, this.onGlobalMouseUp, this);
            input.off(Input.EventType.TOUCH_MOVE, this.onGlobalTouchMove, this);
            input.off(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
            input.off(Input.EventType.TOUCH_CANCEL, this.onGlobalTouchEnd, this);
            this.isGlobalEventsRegistered = false;
            console.log('[UISolvePuzzle] 注销了全局事件');
        }
    }
    

    
    /**
     * 处理拖拽结束逻辑
     */
    private handleDragEnd(): void {
        try {
            if (!this.currentDragPiece || !this.currentDraggedPuzzlePiece) {
                console.log('[UISolvePuzzle] 没有正在拖拽的切片，跳过处理');
                this.forceCleanupDragState();
                return;
            }
            
            console.log(`[UISolvePuzzle] 开始处理拖拽结束逻辑，切片索引：${this.currentDraggedPuzzlePiece.pieceIndex}`);
            
            // 使用标记判断拖拽来源
            const isFromPuzzleList = this.isDragFromPuzzleList;
            console.log(`[UISolvePuzzle] 拖拽来源：${isFromPuzzleList ? 'puzzlePieces列表' : 'dragPieceSlots数组'}`);
            
            // 检查是否在正确位置
            const correctSlotIndex = this.checkCorrectPosition();
            
            if (correctSlotIndex !== -1) {
                // 在正确位置：创建答案切片
                console.log(`[UISolvePuzzle] 切片${this.currentDraggedPuzzlePiece.pieceIndex}在正确位置${correctSlotIndex}`);
                this.createAnswerPieceAtSlot(correctSlotIndex);
                
                // 销毁拖拽副本
                this.destroyDragPiece();
                
                // 从相应列表中永久移除原切片
                if (isFromPuzzleList) {
                    this.safeRemovePuzzlePieceFromList(this.currentDraggedPuzzlePiece);
                }
                // 如果来自dragPieceSlots，原切片已经在创建拖拽副本时被移除，无需再次处理
                
                // 检查拼图是否完成
                this.checkPuzzleCompletion();
            } else {
                // 不在正确位置：判断是否在拼图切片列表范围内
                if (this.isInPieceListRange()) {
                    if (isFromPuzzleList) {
                        // 来自puzzlePieces列表：插入回列表
                        console.log(`[UISolvePuzzle] 切片${this.currentDraggedPuzzlePiece.pieceIndex}在列表范围内，插入回列表`);
                        this.insertPieceBackToList();
                    } else {
                        // 来自dragPieceSlots：插入回列表
                        console.log(`[UISolvePuzzle] dragPieceSlots切片${this.currentDraggedPuzzlePiece.pieceIndex}在列表范围内，插入回列表`);
                        this.insertPieceBackToList();
                    }
                    
                    // 销毁拖拽副本
                    this.destroyDragPiece();
                } else {
                    // 不在列表范围内：创建或恢复未拼好切片
                    if (isFromPuzzleList) {
                        console.log(`[UISolvePuzzle] 切片${this.currentDraggedPuzzlePiece.pieceIndex}不在列表范围内，创建未拼好切片`);
                        this.createUnplacedPiece();
                        
                        // 从列表中永久移除原切片
                        this.safeRemovePuzzlePieceFromList(this.currentDraggedPuzzlePiece);
                    } else {
                        console.log(`[UISolvePuzzle] dragPieceSlots切片${this.currentDraggedPuzzlePiece.pieceIndex}不在列表范围内，恢复为未拼好切片`);
                        this.restoreToDragPieceSlots();
                    }
                    
                    // 销毁拖拽副本
                    this.destroyDragPiece();
                }
            }
        } catch (error) {
            console.error('[UISolvePuzzle] handleDragEnd异常:', error);
        } finally {
            // 确保状态清理
            this.forceCleanupDragState();
        }
    }
    
    /**
     * 从拼图切片列表中移除指定切片
     */
    private removePuzzlePieceFromList(puzzlePiece: PuzzlePiece): void {
        const index = this.puzzlePieces.indexOf(puzzlePiece);
        if (index !== -1) {
            this.puzzlePieces.splice(index, 1);
            puzzlePiece.node.removeFromParent();
            console.log(`[UISolvePuzzle] 从列表中移除了切片${puzzlePiece.pieceIndex}`);
        }
    }
    
    /**
     * 安全地从拼图切片列表中移除指定切片
     */
    private safeRemovePuzzlePieceFromList(puzzlePiece: PuzzlePiece): void {
        try {
            if (!puzzlePiece || !puzzlePiece.node || !puzzlePiece.node.isValid) {
                console.warn('[UISolvePuzzle] 尝试移除无效的拼图切片');
                return;
            }
            
            const index = this.puzzlePieces.indexOf(puzzlePiece);
            if (index !== -1) {
                this.puzzlePieces.splice(index, 1);
                puzzlePiece.node.removeFromParent();
                console.log(`[UISolvePuzzle] 安全移除了切片${puzzlePiece.pieceIndex}`);
            }
        } catch (error) {
            console.error('[UISolvePuzzle] 移除拼图切片异常:', error);
        }
    }
    
    /**
     * 强制清理拖拽状态（异常情况下使用）
     */
    private forceCleanupDragState(): void {
        try {
            // 销毁拖拽预制体
            if (this.currentDragPiece && this.currentDragPiece.isValid) {
                this.currentDragPiece.destroy();
            }
            
            // 清理拖拽状态
            this.currentDragPiece = null;
            this.currentDraggedPuzzlePiece = null;
            this.isDragFromPuzzleList = false;
            this.isDragging = false;
            
            // 注销全局事件监听器
            this.unregisterGlobalEvents();
            
            console.log('[UISolvePuzzle] 强制清理拖拽状态完成');
        } catch (error) {
            console.error('[UISolvePuzzle] 强制清理拖拽状态异常:', error);
        }
    }
    
    /**
     * 安全地添加到dragPieceSlots数组
     */
    private safeAddToDragPieceSlots(node: Node): boolean {
        if (this.isArrayOperationLocked) {
            console.warn('[UISolvePuzzle] 数组操作被锁定，无法添加到dragPieceSlots');
            return false;
        }
        
        try {
            this.isArrayOperationLocked = true;
            
            if (!node || !node.isValid) {
                console.warn('[UISolvePuzzle] 尝试添加无效节点到dragPieceSlots');
                return false;
            }
            
            // 检查是否已存在
            if (this.dragPieceSlots.indexOf(node) !== -1) {
                console.warn('[UISolvePuzzle] 节点已存在于dragPieceSlots中');
                return false;
            }
            
            this.dragPieceSlots.push(node);
            console.log(`[UISolvePuzzle] 安全添加节点到dragPieceSlots，当前数量：${this.dragPieceSlots.length}`);
            return true;
        } catch (error) {
            console.error('[UISolvePuzzle] 添加到dragPieceSlots异常:', error);
            return false;
        } finally {
            this.isArrayOperationLocked = false;
        }
    }
    

    
    /**
     * 安全地从dragPieceSlots数组移除节点
     */
    private safeRemoveFromDragPieceSlots(node: Node): boolean {
        if (this.isArrayOperationLocked) {
            console.warn('[UISolvePuzzle] 数组操作被锁定，无法从dragPieceSlots移除');
            return false;
        }
        
        try {
            this.isArrayOperationLocked = true;
            
            const index = this.dragPieceSlots.indexOf(node);
            if (index !== -1) {
                this.dragPieceSlots.splice(index, 1);
                if (node && node.isValid) {
                    node.destroy();
                }
                console.log(`[UISolvePuzzle] 安全移除dragPieceSlots中的节点，索引：${index}，剩余数量：${this.dragPieceSlots.length}`);
                return true;
            } else {
                console.warn('[UISolvePuzzle] 节点不存在于dragPieceSlots中');
                return false;
            }
        } catch (error) {
            console.error('[UISolvePuzzle] 移除dragPieceSlots节点异常:', error);
            return false;
        } finally {
            this.isArrayOperationLocked = false;
        }
    }
    
    /**
     * 安全地添加到puzzlePieces数组
     */
    private safeAddToPuzzlePieces(puzzlePiece: PuzzlePiece): boolean {
        if (this.isArrayOperationLocked) {
            console.warn('[UISolvePuzzle] 数组操作被锁定，无法添加到puzzlePieces');
            return false;
        }
        
        try {
            this.isArrayOperationLocked = true;
            
            if (!puzzlePiece || !puzzlePiece.node || !puzzlePiece.node.isValid) {
                console.warn('[UISolvePuzzle] 尝试添加无效拼图切片到puzzlePieces');
                return false;
            }
            
            // 检查是否已存在
            if (this.puzzlePieces.indexOf(puzzlePiece) !== -1) {
                console.warn('[UISolvePuzzle] 拼图切片已存在于puzzlePieces中');
                return false;
            }
            
            this.puzzlePieces.push(puzzlePiece);
            console.log(`[UISolvePuzzle] 安全添加拼图切片到puzzlePieces，当前数量：${this.puzzlePieces.length}`);
            return true;
        } catch (error) {
            console.error('[UISolvePuzzle] 添加到puzzlePieces异常:', error);
            return false;
        } finally {
            this.isArrayOperationLocked = false;
        }
    }
    
    /**
     * 恢复dragPieceSlots中的切片到原位置
     */
    private restoreToDragPieceSlots(): void {
        if (!this.currentDragPiece || !this.currentDraggedPuzzlePiece) {
            return;
        }
        
        // 获取原dragPieceSlots切片节点
        const originalDragPieceNode = this.currentDraggedPuzzlePiece.node;
        if (!originalDragPieceNode || !originalDragPieceNode.isValid) {
            console.error('[UISolvePuzzle] 原dragPieceSlots切片节点无效，无法恢复');
            return;
        }
        
        // 获取当前拖拽副本的位置
        const dragPiecePos = this.currentDragPiece.getWorldPosition();
        const localPos = new Vec3();
        this.dragArea.getComponent(UITransform).convertToNodeSpaceAR(dragPiecePos, localPos);
        
        // 设置原节点的新位置
        originalDragPieceNode.setPosition(localPos);
        
        // 重新激活原节点（模仿PuzzlePiece的处理方式）
        originalDragPieceNode.active = true;
        
        console.log(`[UISolvePuzzle] 恢复了dragPieceSlots切片${this.currentDraggedPuzzlePiece.pieceIndex}到位置(${localPos.x}, ${localPos.y})`);
    }
    
    /**
     * 从dragPieceSlots切片创建拖拽预制体
     * 统一使用puzzlePiecePrefab预制体
     */
    private createDragPieceFromDragPiece(x: number, y: number, dragPieceNode: Node, pieceIndex: number): void {
        if (!this.puzzlePiecePrefab || !this.dragArea) {
            console.error('[UISolvePuzzle] 缺少puzzlePiecePrefab或dragArea');
            return;
        }
        
        // 实例化拖拽预制体
        this.currentDragPiece = instantiate(this.puzzlePiecePrefab);
        if (!this.currentDragPiece) {
            console.error('[UISolvePuzzle] 无法实例化拖拽预制体');
            return;
        }
        
        // 设置拖拽预制体的尺寸
        const dragTransform = this.currentDragPiece.getComponent(UITransform);
        if (dragTransform) {
            const sideLength = this.dragSideLength / Math.max(this.gridRows, this.gridCols);
            dragTransform.setContentSize(sideLength, sideLength);
        }
        
        // 使用统一的图片设置逻辑，支持基于遮罩的拼图切片形状
        this.setupPieceSprite(this.currentDragPiece, pieceIndex);
        
        // 设置拖拽预制体的遮罩（统一使用精确计算逻辑）
        this.setupPieceMask(this.currentDragPiece, pieceIndex);
        
        // 将拖拽预制体添加到dragArea
        this.dragArea.addChild(this.currentDragPiece);
        
        // 设置拖拽预制体的初始位置
        this.updateDragPiecePosition(x, y);
        
        // 隐藏原dragPieceSlots切片节点（模仿PuzzlePiece的处理方式）
        dragPieceNode.active = false;
        console.log(`[UISolvePuzzle] 隐藏了dragPieceSlots切片${pieceIndex}`);
        
        // 记录当前拖拽的切片信息（创建一个临时的PuzzlePiece对象）
        this.currentDraggedPuzzlePiece = {
            pieceIndex: pieceIndex,
            node: dragPieceNode
        } as PuzzlePiece;
        
        // 标记拖拽来源为dragPieceSlots数组
        this.isDragFromPuzzleList = false;
        
        console.log(`[UISolvePuzzle] 从dragPieceSlots切片${pieceIndex}创建了拖拽预制体，支持基于遮罩的拼图切片形状`);
    }
    
    /**
     * 从拼图切片创建拖拽预制体
     * 统一使用puzzlePiecePrefab预制体
     */
    private createDragPieceFromPuzzlePiece(x: number, y: number, puzzlePiece: PuzzlePiece): void {
        // 如果已经存在拖拽预制体，先销毁
        this.destroyDragPiece();
        
        // 记录当前被拖拽的拼图切片
        this.currentDraggedPuzzlePiece = puzzlePiece;
        
        // 标记拖拽来源为puzzlePieces列表
        this.isDragFromPuzzleList = true;
        
        // 从列表中移除拼图切片
        const pieceIndex = this.puzzlePieces.indexOf(puzzlePiece);
        if (pieceIndex !== -1) {
            this.puzzlePieces.splice(pieceIndex, 1);
        }
        
        // 隐藏原拼图切片节点
        puzzlePiece.node.active = false;
        
        // 创建新的拖拽预制体
        this.currentDragPiece = instantiate(this.puzzlePiecePrefab);
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
        
        // 使用统一的图片设置逻辑，支持基于遮罩的拼图切片形状
        this.setupPieceSprite(this.currentDragPiece, puzzlePiece.pieceIndex);
        
        // 设置拖拽预制体的遮罩（统一使用精确计算逻辑）
        this.setupPieceMask(this.currentDragPiece, puzzlePiece.pieceIndex);
        
        // 将拖拽预制体添加到拖拽区域
        this.dragArea.addChild(this.currentDragPiece);
        
        // 设置拖拽预制体位置
        this.updateDragPiecePosition(x, y);
        
        console.log(`[UISolvePuzzle] 从拼图切片${puzzlePiece.pieceIndex}创建了拖拽预制体，支持基于遮罩的拼图切片形状，尺寸：${uiTransform ? uiTransform.contentSize.width + 'x' + uiTransform.contentSize.height : '未知'}`);
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
     * 恢复拼图切片到列表并销毁拖拽预制体
     */
    private restorePuzzlePieceAndDestroyDrag(): void {
        if (this.currentDraggedPuzzlePiece) {
            // 恢复原拼图切片的显示
            this.currentDraggedPuzzlePiece.node.active = true;
            
            // 安全将拼图切片重新添加到列表
            this.safeAddToPuzzlePieces(this.currentDraggedPuzzlePiece);
            
            console.log(`[UISolvePuzzle] 恢复了拼图切片${this.currentDraggedPuzzlePiece.pieceIndex}到列表`);
            
            // 清空当前被拖拽的拼图切片引用
            this.currentDraggedPuzzlePiece = null;
        }
        
        // 销毁拖拽预制体
        this.destroyDragPiece();
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
     * 检测拖拽预制体是否在正确位置
     * @returns 如果在正确位置返回槽位索引，否则返回-1
     */
    private checkCorrectPosition(): number {
        if (!this.currentDragPiece || !this.currentDraggedPuzzlePiece || !this.puzzleGrid) {
            return -1;
        }
        
        const dragPieceWorldPos = this.currentDragPiece.getWorldPosition();
        const correctSlotIndex = this.currentDraggedPuzzlePiece.pieceIndex;
        
        // 检查是否有对应的网格槽位
        if (correctSlotIndex < 0 || correctSlotIndex >= this.gridSlots.length) {
            return -1;
        }
        
        const correctSlot = this.gridSlots[correctSlotIndex];
        if (!correctSlot) {
            return -1;
        }
        
        const slotWorldPos = correctSlot.getWorldPosition();
        const distance = Vec3.distance(dragPieceWorldPos, slotWorldPos);
        
        // 动态计算容错距离：根据拼图难度、网格边长和容错率
        const tolerance = this.calculateDynamicTolerance();
        
        if (distance <= tolerance) {
            console.log(`[UISolvePuzzle] 拖拽预制体在正确位置，槽位索引：${correctSlotIndex}，距离：${distance}，容错距离：${tolerance}`);
            return correctSlotIndex;
        }
        
        return -1;
    }
    
    /**
     * 计算拼图切片的标准尺寸（通用方法）
     * @param difficulty 拼图难度
     * @param gridSideLength 网格总边长，默认使用当前实例的gridSideLength
     * @returns 返回切片尺寸信息
     */
    public static calculatePuzzlePieceSize(difficulty: PuzzleDifficulty, gridSideLength: number = 660): {
        slotSize: number,
        gridSize: number,
        rows: number,
        cols: number
    } {
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.warn('[UISolvePuzzle] GameDataPuzzle实例不存在，使用默认网格尺寸');
            // 默认使用简单难度的3x3网格
            const defaultGridSize = 3;
            return {
                slotSize: gridSideLength / defaultGridSize,
                gridSize: defaultGridSize,
                rows: defaultGridSize,
                cols: defaultGridSize
            };
        }

        const gridInfo = gameData.getPuzzleGridSize(difficulty);
        const gridSize = Math.max(gridInfo.rows, gridInfo.cols);
        const slotSize = gridSideLength / gridSize;

        console.log(`[UISolvePuzzle] 计算拼图切片尺寸 - 难度:${PuzzleDifficulty[difficulty]}, 网格:${gridInfo.rows}x${gridInfo.cols}, 总边长:${gridSideLength}, 切片尺寸:${slotSize}`);

        return {
            slotSize: slotSize,
            gridSize: gridSize,
            rows: gridInfo.rows,
            cols: gridInfo.cols
        };
    }

    /**
     * 获取当前实例的拼图切片尺寸
     * @returns 返回当前难度下的切片尺寸信息
     */
    private getCurrentPuzzlePieceSize(): {
        slotSize: number,
        gridSize: number,
        rows: number,
        cols: number
    } {
        return UISolvePuzzle.calculatePuzzlePieceSize(this.currentDifficulty, this.gridSideLength);
    }

    /**
     * 动态计算Mask尺寸
     * 根据网格尺寸和第2版.md的说明计算正确的Mask尺寸
     * @param rows 网格行数
     * @param cols 网格列数
     * @returns Mask的尺寸（像素）
     */
    /**
     * 计算动态Mask尺寸（显示坐标系）
     * 基于第2版.md文档的基准数据进行比例缩放
     * @param rows 行数
     * @param cols 列数
     * @returns 显示坐标系下的Mask尺寸
     */
    private calculateDynamicMaskSize(rows: number, cols: number): number {
        // 基准数据（来自第2版.md文档，与PuzzleResourceManager保持一致）
        const baseImageSize = 384;      // 基准图片尺寸
        const baseMaskSize = 178;       // 基准Mask尺寸（3x3时）
        const baseGridSize = 3;         // 基准难度（3x3）
        const displayGridSideLength = 660; // 游戏中显示的网格总边长
        
        // 计算显示尺寸缩放比例（显示660相对于基准384的比例）
        const displaySizeRatio = displayGridSideLength / baseImageSize;
        
        // 计算难度调整比例
        const gridSize = Math.max(rows, cols);
        const difficultyRatio = baseGridSize / gridSize;
        
        // 计算显示坐标系下的Mask尺寸
        const displayMaskSize = Math.round(baseMaskSize * displaySizeRatio * difficultyRatio);
        
        console.log(`[UISolvePuzzle] 显示Mask计算 - 显示:${displayGridSideLength}, 基准:${baseImageSize}, 显示比例:${displaySizeRatio.toFixed(3)}`);
        console.log(`[UISolvePuzzle] 难度调整 - 当前:${gridSize}x${gridSize}, 基准:${baseGridSize}x${baseGridSize}, 难度比例:${difficultyRatio.toFixed(3)}`);
        console.log(`[UISolvePuzzle] 显示Mask尺寸 - ${displayMaskSize}`);
        
        // 验证660显示尺寸3x3拼图的计算结果
        if (displayGridSideLength === 660 && gridSize === 3) {
            console.log(`[UISolvePuzzle] 验证660显示-3x3 - 期望Mask:306, 实际:${displayMaskSize}`);
        }
        
        return displayMaskSize;
    }

    /**
     * 计算动态容错距离
     * @returns 容错距离
     */
    private calculateDynamicTolerance(): number {
        // 使用新的通用计算方法
        const sizeInfo = this.getCurrentPuzzlePieceSize();
        
        // 容错距离 = 槽位边长 * 容错率
        const tolerance = sizeInfo.slotSize * this.toleranceRate;
        
        console.log(`[UISolvePuzzle] 动态容错距离计算 - 难度：${this.currentDifficulty}，网格尺寸：${sizeInfo.rows}x${sizeInfo.cols}，网格边长：${this.gridSideLength}，槽位边长：${sizeInfo.slotSize}，容错率：${this.toleranceRate}，容错距离：${tolerance}`);
        
        return tolerance;
    }
    
    /**
     * 在正确位置创建答案切片
     * 统一使用puzzlePiecePrefab预制体
     * @param slotIndex 槽位索引
     */
    private createAnswerPieceAtSlot(slotIndex: number): void {
        if (!this.puzzlePiecePrefab || !this.puzzleAnswers || slotIndex < 0 || slotIndex >= this.gridSlots.length) {
            console.error('[UISolvePuzzle] 无法创建答案切片，参数无效');
            return;
        }
        
        const slotNode = this.gridSlots[slotIndex];
        if (!slotNode) {
            console.error('[UISolvePuzzle] 找不到对应的网格槽位');
            return;
        }
        
        // 如果已经存在答案切片，先移除
        if (this.gridAnswerSlots[slotIndex]) {
            this.gridAnswerSlots[slotIndex].destroy();
            this.gridAnswerSlots[slotIndex] = null;
        }
        
        // 创建答案切片
        const answerPiece = instantiate(this.puzzlePiecePrefab);
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
            // console.log(`[UISolvePuzzle] 槽位${slotIndex}尺寸设置前:`);
            // console.log(`  - slotTransform.contentSize: ${slotTransform.contentSize.width}x${slotTransform.contentSize.height}`);
            // console.log(`  - answerTransform.contentSize: ${answerTransform.contentSize.width}x${answerTransform.contentSize.height}`);
            
            answerTransform.setContentSize(slotTransform.contentSize);
            
            // console.log(`[UISolvePuzzle] 槽位${slotIndex}尺寸设置后:`);
            // console.log(`  - answerTransform.contentSize: ${answerTransform.contentSize.width}x${answerTransform.contentSize.height}`);
        }
        
        // 设置答案切片的位置与槽位一致
        const slotWorldPos = slotNode.getWorldPosition();
        const puzzleAnswersWorldPos = this.puzzleAnswers.getWorldPosition();
        const localPos = new Vec3();
        this.puzzleAnswers.getComponent(UITransform).convertToNodeSpaceAR(slotWorldPos, localPos);
        answerPiece.setPosition(localPos);
        
        // 设置答案切片的遮罩和图片
        // 设置答案切片的遮罩（统一使用精确计算逻辑）
        this.setupPieceMask(answerPiece, slotIndex);
        this.setupAnswerPieceSprite(answerPiece, slotIndex);
        
        // 隐藏网格答案的MaskShadow节点
        this.hideMaskShadowForAnswerPiece(answerPiece);
        
        // 将答案切片添加到puzzleAnswers父节点
        this.puzzleAnswers.addChild(answerPiece);
        
        // 保存到答案槽位数组
        this.gridAnswerSlots[slotIndex] = answerPiece;
        
        console.log(`[UISolvePuzzle] 在puzzleAnswers下创建了槽位${slotIndex}的答案切片`);
    }
    
    /**
     * 检测拖拽预制体是否在拼图切片列表范围内
     * @returns 如果在列表范围内返回true，否则返回false
     */
    private isInPieceListRange(): boolean {
        if (!this.currentDragPiece || !this.pieceScrollView) {
            return false;
        }
        
        const dragPieceWorldPos = this.currentDragPiece.getWorldPosition();
        const scrollViewWorldPos = this.pieceScrollView.node.getWorldPosition();
        const scrollViewTransform = this.pieceScrollView.node.getComponent(UITransform);
        
        if (!scrollViewTransform) {
            return false;
        }
        
        // 计算ScrollView的世界坐标边界
        const halfWidth = scrollViewTransform.width / 2;
        const halfHeight = scrollViewTransform.height / 2;
        
        const leftBound = scrollViewWorldPos.x - halfWidth;
        const rightBound = scrollViewWorldPos.x + halfWidth;
        const topBound = scrollViewWorldPos.y + halfHeight;
        const bottomBound = scrollViewWorldPos.y - halfHeight;
        
        // 检查拖拽预制体是否在ScrollView范围内
        const inRange = dragPieceWorldPos.x >= leftBound && 
                       dragPieceWorldPos.x <= rightBound && 
                       dragPieceWorldPos.y >= bottomBound && 
                       dragPieceWorldPos.y <= topBound;
        
        console.log(`[UISolvePuzzle] 拖拽预制体${inRange ? '在' : '不在'}拼图切片列表范围内`);
        return inRange;
    }
    
    /**
     * 创建未拼好的切片，停留在当前位置
     */
    private createUnplacedPiece(): void {
        if (!this.currentDragPiece || !this.currentDraggedPuzzlePiece || !this.dragArea) {
            console.error('[UISolvePuzzle] 无法创建未拼好切片，缺少必要参数');
            return;
        }
        
        // 检查拖拽来源，确保只处理来自puzzlePieces列表的切片
        if (!this.isDragFromPuzzleList) {
            console.error('[UISolvePuzzle] createUnplacedPiece只能处理来自puzzlePieces列表的切片');
            return;
        }
        
        // 创建未拼好的切片（使用puzzlePiecePrefab）
        const unplacedPiece = instantiate(this.puzzlePiecePrefab);
        if (!unplacedPiece) {
            console.error('[UISolvePuzzle] 无法创建未拼好切片');
            return;
        }
        
        // 设置名称便于识别
        unplacedPiece.name = `UnplacedPiece_${this.currentDraggedPuzzlePiece.pieceIndex}`;
        
        // 复制当前拖拽预制体的位置和尺寸
        const dragTransform = this.currentDragPiece.getComponent(UITransform);
        const unplacedTransform = unplacedPiece.getComponent(UITransform);
        if (dragTransform && unplacedTransform) {
            unplacedTransform.setContentSize(dragTransform.contentSize);
        }
        
        // 设置位置（与当前拖拽切片相同）
        const originalPos = this.currentDragPiece.getPosition();
        unplacedPiece.setPosition(originalPos);
        
        // 使用统一的图片设置逻辑，支持基于遮罩的拼图切片形状
        this.setupPieceSprite(unplacedPiece, this.currentDraggedPuzzlePiece.pieceIndex);
        
        // 设置未拼好切片的遮罩（统一使用精确计算逻辑）
        this.setupPieceMask(unplacedPiece, this.currentDraggedPuzzlePiece.pieceIndex);
        
        // 将未拼好切片添加到dragArea父节点
        this.dragArea.addChild(unplacedPiece);
        
        // 为未拼好切片绑定事件
        this.setupDragPieceEvents(unplacedPiece, this.currentDraggedPuzzlePiece.pieceIndex);
        
        // 安全存储到dragPieceSlots数组
        this.safeAddToDragPieceSlots(unplacedPiece);
        
        console.log(`[UISolvePuzzle] 创建了未拼好切片，支持基于遮罩的拼图切片形状，切片索引：${this.currentDraggedPuzzlePiece.pieceIndex}`);
    }
    
    /**
     * 将拼图切片插入回列表，根据最近位置确定插入位置
     */
    private insertPieceBackToList(): void {
        if (!this.currentDraggedPuzzlePiece || !this.pieceContent) {
            console.error('[UISolvePuzzle] 无法插入回列表，缺少必要参数');
            return;
        }
        
        let puzzlePieceToInsert = this.currentDraggedPuzzlePiece;
        
        // 如果来自dragPieceSlots，需要创建完整的PuzzlePiece对象
        if (!this.isDragFromPuzzleList) {
            this.safeRemoveFromDragPieceSlots(this.currentDraggedPuzzlePiece.node);
            
            // 创建新的完整PuzzlePiece节点
            const newPieceNode = instantiate(this.puzzlePiecePrefab);
            if (!newPieceNode) {
                console.error('[UISolvePuzzle] 无法创建新的拼图切片节点');
                return;
            }
            
            // 获取PuzzlePiece组件并设置属性
            const puzzlePieceComponent = newPieceNode.getComponent(PuzzlePiece);
            if (puzzlePieceComponent) {
                const pieceIndex = this.currentDraggedPuzzlePiece.pieceIndex;
                const correctRow = Math.floor(pieceIndex / this.gridCols);
                const correctCol = pieceIndex % this.gridCols;
                puzzlePieceComponent.setPieceInfo(pieceIndex, correctRow, correctCol);
            }
            
            // 设置切片图片和遮罩（支持基于遮罩的拼图切片形状）
            this.setupPieceSprite(newPieceNode, this.currentDraggedPuzzlePiece.pieceIndex);
            
            // 设置新创建的PuzzlePiece节点的遮罩
            if (puzzlePieceComponent) {
                this.setupBottomListPieceMask(puzzlePieceComponent.node, this.currentDraggedPuzzlePiece.pieceIndex);
            }
            
            // 销毁原dragPieceSlots节点
            this.currentDraggedPuzzlePiece.node.destroy();
            
            // 更新要插入的切片对象
            puzzlePieceToInsert = puzzlePieceComponent;
            
            console.log(`[UISolvePuzzle] 为dragPieceSlots切片${this.currentDraggedPuzzlePiece.pieceIndex}创建了新的完整PuzzlePiece对象`);
        } else {
            // 恢复原拼图切片的显示
            this.currentDraggedPuzzlePiece.node.active = true;
        }
        
        // 如果列表为空，直接添加
        if (this.puzzlePieces.length === 0) {
            this.safeAddToPuzzlePieces(puzzlePieceToInsert);
            this.pieceContent.addChild(puzzlePieceToInsert.node);
            console.log(`[UISolvePuzzle] 将切片${puzzlePieceToInsert.pieceIndex}插入到空列表，当前列表数量：${this.puzzlePieces.length}`);
            
            // 重新设置事件监听
            this.setupPieceMouseEvents(puzzlePieceToInsert.node, puzzlePieceToInsert);
            
            // 重新排列UI中的切片位置
            this.rearrangePuzzlePiecesInUI();
            return;
        }
        
        // 获取拖拽预制体的位置
        const dragPieceWorldPos = this.currentDragPiece ? this.currentDragPiece.getWorldPosition() : new Vec3();
        
        let insertIndex = 0;
        let minDistance = Number.MAX_VALUE;
        
        // 找到距离最近的拼图切片位置
        for (let i = 0; i < this.puzzlePieces.length; i++) {
            const piece = this.puzzlePieces[i];
            if (piece && piece.node && piece.node.isValid) {
                const pieceWorldPos = piece.node.getWorldPosition();
                const distance = Vec3.distance(dragPieceWorldPos, pieceWorldPos);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    insertIndex = i;
                }
            }
        }
        
        // 插入到最近位置
        this.puzzlePieces.splice(insertIndex, 0, puzzlePieceToInsert);
        
        // 重新排列pieceContent中的子节点顺序
        puzzlePieceToInsert.node.removeFromParent();
        this.pieceContent.insertChild(puzzlePieceToInsert.node, insertIndex);
        
        console.log(`[UISolvePuzzle] 将切片${puzzlePieceToInsert.pieceIndex}插入到列表位置${insertIndex}，当前列表数量：${this.puzzlePieces.length}`);
        
        // 重新设置事件监听
        this.setupPieceMouseEvents(puzzlePieceToInsert.node, puzzlePieceToInsert);
        
        // 重新排列UI中的切片位置
        this.rearrangePuzzlePiecesInUI();
    }
    
    /**
     * 界面显示时调用
     */
    public onShow(): void {
        const gameData = GameDataPuzzle.instance;
        if (gameData) {
            this.currentPuzzleId = gameData.getSelectedPuzzleId();
            this.currentDifficulty = gameData.getCurrentDifficulty();
            this.initializeHintButtonsState();
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
            
            // 设置网格槽位的遮罩和图片
            this.setupGridSlotMask(slotNode, i, row, col);
                      
            // 添加到网格区域
            this.puzzleGrid.addChild(slotNode);
            this.gridSlots.push(slotNode);
        }
        
        console.log(`[UISolvePuzzle] 创建了${totalSlots}个网格槽位，网格大小：${this.gridRows}x${this.gridCols}，槽位尺寸：${slotSize}`);
    }
    
    /**
     * 设置答案切片的图片
     */
    private setupAnswerPieceSprite(answerPiece: Node, slotIndex: number): void {
        // 正确的节点查找路径：answerPiece -> Mask -> sprIcon
        const maskNode = answerPiece.getChildByName('Mask');
        if (!maskNode) {
            console.warn(`[UISolvePuzzle] 答案切片${slotIndex}无法找到Mask子节点`);
            return;
        }
        
        // 使用现有的setupPieceSprite方法来设置sprIcon的Sprite
        this.setupPieceSprite(maskNode, slotIndex);
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
            
            // 设置底部列表拼图切片遮罩（专门用于150x150规格）
            this.setupBottomListPieceMask(pieceNode, i);
            
            // 为拼图切片添加鼠标事件
            this.setupPieceMouseEvents(pieceNode, puzzlePiece);
            
            // 安全添加到滚动列表
            this.pieceContent.addChild(pieceNode);
            this.safeAddToPuzzlePieces(puzzlePiece);
        }
        
        // 打乱拼图切片顺序
        this.shufflePieces();
        
        // 打印底部列表各节点的尺寸信息
        this.printBottomListNodeSizes();
    }

    /**
     * 设置拼图切片图片
     */
    private setupPieceSprite(pieceNode: Node, index: number): void {
        // 先检查是否有Mask子节点
        const maskNode = pieceNode.getChildByName('Mask');
        let sprIconNode: Node | null = null;
        
        if (maskNode) {
            // 如果有Mask节点，从Mask下查找sprIcon
            sprIconNode = maskNode.getChildByName('sprIcon');
        } else {
            // 如果没有Mask节点，直接从pieceNode下查找sprIcon
            sprIconNode = pieceNode.getChildByName('sprIcon');
        }
        
        const resourceManager = PuzzleResourceManager.instance;
        
        if (sprIconNode && resourceManager) {
            const sprite = sprIconNode.getComponent(Sprite);
            if (sprite) {
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
    }

    /**
     * 计算底部列表拼图切片的尺寸和位置（固定150x150规格）
     * @param slotIndex 切片索引
     * @param difficulty 难度（行数或列数）
     * @returns 包含sprIcon尺寸和偏移的对象
     */
    private calculateBottomListSprIconSizeAndPosition(slotIndex: number, difficulty: number): {
        width: number;
        height: number;
        offsetX: number;
        offsetY: number;
    } {
        // 底部列表固定参数
        const BOTTOM_LIST_SIZE = 150; // 底部列表固定尺寸150x150
        
        // 获取表格参数（与PuzzleResourceManager保持一致）
        const PuzzleRealLength = 660; // 基准图片尺寸
        const maskRefSquareSide = 92;  // 适宜基准中正方形边长
        const maskRefSemiCircleRadius = 18;  // 适宜基准半圆半径
        
        // 计算基础参数
        const maskSquareSide = Math.round((PuzzleRealLength / difficulty) * (maskRefSquareSide / PuzzleRealLength));
        const maskSemiCircleRadius = Math.ceil((PuzzleRealLength / difficulty) * (maskRefSemiCircleRadius / PuzzleRealLength));
        const MaskSide = maskSquareSide + 2 * maskSemiCircleRadius;
        const LeftCornerSide = maskSquareSide + maskSemiCircleRadius;
        
        // 计算缩放比例（将原始尺寸缩放到150x150）
        const scaleRatio = BOTTOM_LIST_SIZE / MaskSide;
        
        // 计算切片位置信息
        const row = Math.floor(slotIndex / difficulty);
        const col = slotIndex % difficulty;
        
        // 判断切片类型
        const isCorner = (row === 0 || row === difficulty - 1) && (col === 0 || col === difficulty - 1);
        const isEdge = !isCorner && (row === 0 || row === difficulty - 1 || col === 0 || col === difficulty - 1);
        
        // 判断边缘位置
        const isTopEdge = row === 0;
        const isBottomEdge = row === difficulty - 1;
        const isLeftEdge = col === 0;
        const isRightEdge = col === difficulty - 1;
        
        let sprIconWidth: number;
        let sprIconHeight: number;
        let offsetX: number;
        let offsetY: number;
        
        const halfRadius = maskSemiCircleRadius * scaleRatio;
        
        if (isCorner) {
            // 角落切片：使用LeftCornerSide尺寸，根据位置设置偏移
            sprIconWidth = LeftCornerSide * scaleRatio;
            sprIconHeight = LeftCornerSide * scaleRatio;
            
            // 根据角落位置设置偏移
            if (isTopEdge && isLeftEdge) {
                // 左上角
                offsetX = halfRadius;
                offsetY = -halfRadius;
            } else if (isTopEdge && isRightEdge) {
                // 右上角
                offsetX = -halfRadius;
                offsetY = -halfRadius;
            } else if (isBottomEdge && isLeftEdge) {
                // 左下角
                offsetX = halfRadius;
                offsetY = halfRadius;
            } else {
                // 右下角
                offsetX = -halfRadius;
                offsetY = halfRadius;
            }
        } else if (isEdge) {
            // 边缘切片：根据边缘方向设置尺寸和偏移
            if (isTopEdge || isBottomEdge) {
                // 上下边缘：宽度使用MaskSide，高度使用LeftCornerSide
                sprIconWidth = MaskSide * scaleRatio;
                sprIconHeight = LeftCornerSide * scaleRatio;
                offsetX = 0;
                offsetY = isTopEdge ? -halfRadius : halfRadius;
            } else {
                // 左右边缘：宽度使用LeftCornerSide，高度使用MaskSide
                sprIconWidth = LeftCornerSide * scaleRatio;
                sprIconHeight = MaskSide * scaleRatio;
                offsetX = isLeftEdge ? halfRadius : -halfRadius;
                offsetY = 0;
            }
        } else {
            // 中间切片：使用MaskSide尺寸，无偏移
            sprIconWidth = MaskSide * scaleRatio;
            sprIconHeight = MaskSide * scaleRatio;
            offsetX = 0;
            offsetY = 0;
        }

        // 添加阴影MaskShadow/sprShadow后，发现得×0.5才是正确的偏移，还没想通
        offsetX *= 0.5;
        offsetY *= 0.5;

        console.log(`[UISolvePuzzle] 底部列表切片${slotIndex}[${row},${col}] 难度${difficulty}x${difficulty}, 类型: ${isCorner ? '角落' : isEdge ? '边缘' : '中间'}, sprIcon尺寸: ${sprIconWidth.toFixed(1)}x${sprIconHeight.toFixed(1)}, 偏移: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
        console.log(`[UISolvePuzzle] 底部列表参数详情 - 缩放比例: ${scaleRatio.toFixed(3)}, maskSquareSide: ${maskSquareSide}, maskSemiCircleRadius: ${maskSemiCircleRadius}, MaskSide: ${MaskSide}, LeftCornerSide: ${LeftCornerSide}`);
        
        return {
            width: Math.round(sprIconWidth),
            height: Math.round(sprIconHeight),
            offsetX: Math.round(offsetX),
            offsetY: Math.round(offsetY)
        };
    }

    /**
     * 设置底部列表拼图切片的尺寸（专门用于150x150规格）
     * @param pieceNode 拼图切片节点
     * @param slotIndex 切片索引
     */
    private setupBottomListPieceMask(pieceNode: Node, slotIndex: number): void {
        const BOTTOM_LIST_SIZE = 150; // 底部列表固定尺寸
        
        // 设置puzzlePiecePrefab的尺寸为150x150
        const pieceUITransform = pieceNode.getComponent(UITransform);
        if (pieceUITransform) {
            pieceUITransform.setContentSize(BOTTOM_LIST_SIZE, BOTTOM_LIST_SIZE);
        }
        
        // 获取遮罩图片
        const maskSpriteFrame = GameDataPuzzle.getMaskSpriteFrame(this.currentDifficulty, slotIndex);
        if (!maskSpriteFrame) {
            console.warn(`[UISolvePuzzle] 无法获取槽位${slotIndex}的遮罩图片`);
            return;
        }
        
        // 查找Mask节点
        const maskNode = pieceNode.getChildByName('Mask');
        if (!maskNode) {
            console.warn(`[UISolvePuzzle] 切片${slotIndex}无法找到Mask子节点`);
            return;
        }
        
        // 设置Mask节点的尺寸为150x150
        const maskUITransform = maskNode.getComponent(UITransform);
        if (maskUITransform) {
            maskUITransform.setContentSize(BOTTOM_LIST_SIZE, BOTTOM_LIST_SIZE);
        }
        
        // 设置Mask节点的遮罩图片
        const maskSprite = maskNode.getComponent(Sprite);
        if (maskSprite) {
            maskSprite.spriteFrame = maskSpriteFrame;
        }
        
        // 设置MaskShadow
        this.setupMaskShadow(pieceNode, maskNode, maskSpriteFrame, { width: BOTTOM_LIST_SIZE, height: BOTTOM_LIST_SIZE }, -4, slotIndex, true);
        
        // 查找sprIcon节点
        const sprIconNode = maskNode.getChildByName('sprIcon');
        if (!sprIconNode) {
            console.warn(`[UISolvePuzzle] 切片${slotIndex}的Mask无法找到sprIcon子节点`);
            return;
        }
        
        // 设置sprIcon的拼图切片图片和精确尺寸
        const sprIconSprite = sprIconNode.getComponent(Sprite);
        const sprIconUITransform = sprIconNode.getComponent(UITransform);
        if (sprIconSprite && sprIconUITransform) {
            // 获取对应的拼图切片
            const puzzlePieceSpriteFrame = PuzzleResourceManager.instance.getPuzzlePiece(
                this.currentPuzzleId, 
                this.gridRows, 
                this.gridCols, 
                slotIndex
            );
            
            if (puzzlePieceSpriteFrame) {
                sprIconSprite.spriteFrame = puzzlePieceSpriteFrame;
                
                // 计算底部列表sprIcon的精确尺寸和位置
                const sprIconSizeAndPos = this.calculateBottomListSprIconSizeAndPosition(slotIndex, this.gridRows);
                
                // 设置sprIcon精确尺寸
                sprIconUITransform.setContentSize(sprIconSizeAndPos.width, sprIconSizeAndPos.height);
                
                // 设置sprIcon位置偏移
                sprIconNode.setPosition(sprIconSizeAndPos.offsetX, sprIconSizeAndPos.offsetY, 0);
                
                console.log(`[UISolvePuzzle] 底部列表切片${slotIndex}设置完成 - puzzlePiece: ${BOTTOM_LIST_SIZE}x${BOTTOM_LIST_SIZE}, Mask: ${BOTTOM_LIST_SIZE}x${BOTTOM_LIST_SIZE}, sprIcon: ${sprIconSizeAndPos.width}x${sprIconSizeAndPos.height}, 偏移: (${sprIconSizeAndPos.offsetX}, ${sprIconSizeAndPos.offsetY})`);
            } else {
                console.error(`[UISolvePuzzle] 无法获取切片${slotIndex}的拼图图片`);
            }
        }
    }

    /**
     * 设置MaskShadow的动态属性，包括sprShadow的设置
     * 根据Mask的设置同步设置MaskShadow和sprShadow的图片、尺寸和位置
     * @param pieceNode 拼图切片节点
     * @param maskNode Mask节点
     * @param maskSpriteFrame Mask使用的SpriteFrame
     * @param maskSize Mask的尺寸
     * @param shadowOffsetY MaskShadow的Y轴偏移，默认-4
     * @param slotIndex 切片索引，用于计算sprShadow的精确尺寸和位置
     * @param isBottomList 是否为底部列表，影响sprShadow的计算方式
     */
    private setupMaskShadow(
        pieceNode: Node, 
        maskNode: Node, 
        maskSpriteFrame: SpriteFrame, 
        maskSize: { width: number, height: number }, 
        shadowOffsetY: number = -4,
        slotIndex?: number,
        isBottomList: boolean = false
    ): void {
        // 查找MaskShadow节点
        const maskShadowNode = pieceNode.getChildByName('MaskShadow');
        if (!maskShadowNode) {
            console.warn(`[UISolvePuzzle] 切片节点无法找到MaskShadow子节点`);
            return;
        }
        
        // 获取MaskShadow的Sprite组件
        const maskShadowSprite = maskShadowNode.getComponent(Sprite);
        if (!maskShadowSprite) {
            console.warn(`[UISolvePuzzle] MaskShadow节点没有Sprite组件`);
            return;
        }
        
        // 获取MaskShadow的UITransform组件
        const maskShadowUITransform = maskShadowNode.getComponent(UITransform);
        if (!maskShadowUITransform) {
            console.warn(`[UISolvePuzzle] MaskShadow节点没有UITransform组件`);
            return;
        }
        
        // 获取Mask节点的位置
        const maskPosition = maskNode.getPosition();
        
        // 设置MaskShadow的图片（与Mask相同）
        maskShadowSprite.spriteFrame = maskSpriteFrame;
        
        // 设置MaskShadow的尺寸（与Mask相同）
        maskShadowUITransform.setContentSize(maskSize.width, maskSize.height);
        
        // 设置MaskShadow的位置（X坐标与Mask相同，Y坐标根据配置偏移）
        maskShadowNode.setPosition(maskPosition.x, maskPosition.y + shadowOffsetY, maskPosition.z);
        
        console.log(`[UISolvePuzzle] MaskShadow设置完成 - 图片: ${maskSpriteFrame.name || '未知'}, 尺寸: ${maskSize.width}x${maskSize.height}, 位置: (${maskPosition.x}, ${maskPosition.y + shadowOffsetY}), 偏移: ${shadowOffsetY}`);
        
        // 设置sprShadow（如果提供了slotIndex）
        if (slotIndex !== undefined) {
            this.setupSprShadow(maskShadowNode, slotIndex, isBottomList);
        }
    }

    /**
     * 设置sprShadow的坐标和尺寸，使其与sprIcon保持一致
     * @param maskShadowNode MaskShadow节点
     * @param slotIndex 切片索引
     * @param isBottomList 是否为底部列表
     */
    private setupSprShadow(maskShadowNode: Node, slotIndex: number, isBottomList: boolean): void {
        // 查找sprShadow节点
        const sprShadowNode = maskShadowNode.getChildByName('sprShadow');
        if (!sprShadowNode) {
            console.warn(`[UISolvePuzzle] MaskShadow节点无法找到sprShadow子节点`);
            return;
        }
        
        // 获取sprShadow的UITransform组件
        const sprShadowUITransform = sprShadowNode.getComponent(UITransform);
        if (!sprShadowUITransform) {
            console.warn(`[UISolvePuzzle] sprShadow节点没有UITransform组件`);
            return;
        }
        
        let sprIconSizeAndPos: { width: number; height: number; offsetX: number; offsetY: number };
        
        if (isBottomList) {
            // 底部列表：使用底部列表的计算方法
            sprIconSizeAndPos = this.calculateBottomListSprIconSizeAndPosition(slotIndex, this.gridRows);
        } else {
            // 非底部列表：使用网格的计算方法
            sprIconSizeAndPos = this.calculateSprIconSizeAndPosition(slotIndex, this.gridRows, this.gridCols);
        }
        
        // 设置sprShadow的尺寸（与sprIcon相同）
        sprShadowUITransform.setContentSize(sprIconSizeAndPos.width, sprIconSizeAndPos.height);
        
        // 设置sprShadow的位置（与sprIcon相同）
        sprShadowNode.setPosition(sprIconSizeAndPos.offsetX, sprIconSizeAndPos.offsetY, 0);
        
        console.log(`[UISolvePuzzle] sprShadow设置完成 - 切片${slotIndex}, 类型: ${isBottomList ? '底部列表' : '网格'}, 尺寸: ${sprIconSizeAndPos.width}x${sprIconSizeAndPos.height}, 位置: (${sprIconSizeAndPos.offsetX}, ${sprIconSizeAndPos.offsetY})`);
    }

    /**
     * 隐藏网格答案切片的MaskShadow节点
     * @param pieceNode 拼图切片节点
     */
    private hideMaskShadowForAnswerPiece(pieceNode: Node): void {
        // 查找MaskShadow节点
        const maskShadowNode = pieceNode.getChildByName('MaskShadow');
        if (!maskShadowNode) {
            console.warn(`[UISolvePuzzle] 答案切片节点无法找到MaskShadow子节点`);
            return;
        }
        
        // 隐藏MaskShadow节点
        maskShadowNode.active = false;
        
        console.log(`[UISolvePuzzle] 已隐藏答案切片的MaskShadow节点`);
    }

    /**
     * 打印不同难度下底部列表各节点的尺寸信息
     */
    private printBottomListNodeSizes(): void {
        console.log(`\n=== 底部列表拼图切片尺寸信息 ===`);
        console.log(`当前难度: ${this.gridRows}x${this.gridCols}`);
        console.log(`底部列表固定规格: 150x150`);
        
        const totalPieces = this.gridRows * this.gridCols;
        
        for (let i = 0; i < totalPieces; i++) {
            const row = Math.floor(i / this.gridCols);
            const col = i % this.gridCols;
            
            // 计算sprIcon尺寸和位置
            const sprIconInfo = this.calculateBottomListSprIconSizeAndPosition(i, this.gridRows);
            
            // 判断切片类型
            const isCorner = (row === 0 || row === this.gridRows - 1) && (col === 0 || col === this.gridCols - 1);
            const isEdge = !isCorner && (row === 0 || row === this.gridRows - 1 || col === 0 || col === this.gridCols - 1);
            const pieceType = isCorner ? '角落' : isEdge ? '边缘' : '中间';
            
            console.log(`切片${i}[${row},${col}] ${pieceType}: puzzlePiece(150x150) -> Mask(150x150) -> sprIcon(${sprIconInfo.width}x${sprIconInfo.height}, 偏移:${sprIconInfo.offsetX},${sprIconInfo.offsetY})`);
        }
        
        console.log(`=== 底部列表尺寸信息打印完成 ===\n`);
    }

    /**
     * 设置拼图切片遮罩
     * 统一使用精确计算逻辑
     */
    private setupPieceMask(pieceNode: Node, slotIndex: number): void {
        // 获取遮罩图片
        const maskSpriteFrame = GameDataPuzzle.getMaskSpriteFrame(this.currentDifficulty, slotIndex);
        if (!maskSpriteFrame) {
            console.warn(`[UISolvePuzzle] 无法获取槽位${slotIndex}的遮罩图片`);
            return;
        }
        
        // 查找Mask节点
        const maskNode = pieceNode.getChildByName('Mask');
        if (!maskNode) {
            console.warn(`[UISolvePuzzle] 切片${slotIndex}无法找到Mask子节点`);
            return;
        }
        
        // 查找sprIcon节点
        const sprIconNode = maskNode.getChildByName('sprIcon');
        if (!sprIconNode) {
            console.warn(`[UISolvePuzzle] 切片${slotIndex}的Mask无法找到sprIcon子节点`);
            return;
        }
        
        // 设置Mask节点的遮罩图片
        const maskSprite = maskNode.getComponent(Sprite);
        if (maskSprite) {
            maskSprite.spriteFrame = maskSpriteFrame;
            console.log(`[UISolvePuzzle] 已为切片${slotIndex}的Mask设置遮罩图片: ${maskSpriteFrame.name || '未知'}`);
            
            // 动态计算Mask尺寸
            const sizeInfo = this.getCurrentPuzzlePieceSize();
            const maskUITransform = maskNode.getComponent(UITransform);
            if (maskUITransform && sizeInfo) {
                // 使用动态计算的Mask尺寸
                const maskSize = this.calculateDynamicMaskSize(sizeInfo.rows, sizeInfo.cols);
                maskUITransform.setContentSize(maskSize, maskSize);
                console.log(`[UISolvePuzzle] 已为切片${slotIndex}的Mask设置尺寸: ${maskSize}x${maskSize}`);
                
                // 设置MaskShadow（非底部列表）
                // 设置MaskShadow
                this.setupMaskShadow(pieceNode, maskNode, maskSpriteFrame, { width: maskSize, height: maskSize }, -8, slotIndex, false);
                
                // 设置sprIcon的拼图切片图片和精确尺寸
                const sprIconSprite = sprIconNode.getComponent(Sprite);
                const sprIconUITransform = sprIconNode.getComponent(UITransform);
                if (sprIconSprite && sprIconUITransform) {
                    // 获取对应的拼图切片
                    const puzzlePieceSpriteFrame = PuzzleResourceManager.instance.getPuzzlePiece(
                        this.currentPuzzleId, 
                        sizeInfo.rows, 
                        sizeInfo.cols, 
                        slotIndex
                    );
                    
                    if (puzzlePieceSpriteFrame) {
                        sprIconSprite.spriteFrame = puzzlePieceSpriteFrame;
                        
                        // 计算sprIcon的精确尺寸和位置（基于拼图形状的精确计算）
                        const sprIconSizeAndPos = this.calculateSprIconSizeAndPosition(slotIndex, sizeInfo.rows, sizeInfo.cols);
                        
                        // 设置sprIcon精确尺寸（与对应拼图切片的长宽比相等）
                        sprIconUITransform.setContentSize(sprIconSizeAndPos.width, sprIconSizeAndPos.height);
                        
                        // 设置sprIcon位置偏移
                        sprIconNode.setPosition(sprIconSizeAndPos.offsetX, sprIconSizeAndPos.offsetY, 0);
                        
                        console.log(`[UISolvePuzzle] 已为切片${slotIndex}的sprIcon设置图片和精确尺寸: ${sprIconSizeAndPos.width}x${sprIconSizeAndPos.height}, 偏移: (${sprIconSizeAndPos.offsetX}, ${sprIconSizeAndPos.offsetY})`);
                    } else {
                        console.error(`[UISolvePuzzle] 无法获取切片${slotIndex}的拼图图片`);
                    }
                }
            }
        } else {
            console.error(`[UISolvePuzzle] 切片${slotIndex}的Mask节点没有Sprite组件`);
        }
    }

    /**
     * 设置网格槽位遮罩
     */
    private setupGridSlotMask(slotNode: Node, index: number, row: number, col: number): void {
        const maskSpriteFrame = GameDataPuzzle.getMaskSpriteFrame(this.currentDifficulty, index);
        if (maskSpriteFrame) {
            // 查找Mask节点
            let maskNode = slotNode.getChildByName('Mask');
            if (!maskNode) {
                console.warn(`[UISolvePuzzle] 预制体"${slotNode.name}"的网格槽位${index}没有找到Mask子节点`);
                return;
            }
            
            // 获取当前难度下的切片尺寸信息
            const sizeInfo = this.getCurrentPuzzlePieceSize();
            
            // 设置Mask节点的尺寸和遮罩SpriteFrame
            const maskUITransform = maskNode.getComponent(UITransform);
            let maskContentSize = '无UITransform组件';
            if (maskUITransform) {
                // 使用动态计算的Mask尺寸，而不是固定比例
                const maskSize = this.calculateDynamicMaskSize(sizeInfo.rows, sizeInfo.cols);
                maskUITransform.setContentSize(maskSize, maskSize);
                maskContentSize = `${maskUITransform.contentSize.width}x${maskUITransform.contentSize.height}`;
            }
            
            const maskSprite = maskNode.getComponent(Sprite);
            if (maskSprite) {
                maskSprite.spriteFrame = maskSpriteFrame;
                
                // 获取遮罩图片名称
                const maskImageName = maskSpriteFrame.name || '未知遮罩图片';
                
                // 查找sprIcon子节点并设置原来的网格图片
                const sprIconNode = maskNode.getChildByName('sprIcon');
                let sprIconImageName = '无sprIcon子节点';
                let sprIconContentSize = '无sprIcon子节点';
                if (sprIconNode) {
                    // 只设置图片内容
                    const sprIconSprite = sprIconNode.getComponent(Sprite);
                    if (sprIconSprite) {
                        // 设置sprIcon使用原来的网格图片（根据行号+列号的奇偶性）
                        if ((row + col) % 2 === 0) {
                            sprIconSprite.spriteFrame = this.gridSpriteFrame0;
                            sprIconImageName = this.gridSpriteFrame0?.name || 'gridSpriteFrame0';
                        } else {
                            sprIconSprite.spriteFrame = this.gridSpriteFrame1;
                            sprIconImageName = this.gridSpriteFrame1?.name || 'gridSpriteFrame1';
                        }
                        
                        // sprIcon直接设置和Mask一样大（必须在设置spriteFrame之后）
                        const sprIconUITransform = sprIconNode.getComponent(UITransform);
                        if (sprIconUITransform) {
                            // 计算目标尺寸（和Mask一样大）
                            const maskSize = this.calculateDynamicMaskSize(sizeInfo.rows, sizeInfo.cols);
                            const targetSize = { width: maskSize, height: maskSize };
                            
                            // 立即设置sprIcon尺寸和Mask一样大
                            sprIconUITransform.setContentSize(targetSize.width, targetSize.height);
                            
                            // 在下一帧再次确保尺寸正确（防止spriteFrame重置尺寸）
                            this.scheduleOnce(() => {
                                if (sprIconUITransform && sprIconUITransform.isValid) {
                                    sprIconUITransform.setContentSize(targetSize.width, targetSize.height);
                                    console.log(`[UISolvePuzzle] 槽位${index} sprIcon尺寸已确保设置为: ${sprIconUITransform.contentSize.width}x${sprIconUITransform.contentSize.height}`);
                                }
                            }, 0);
                            
                            sprIconContentSize = `${sprIconUITransform.contentSize.width}x${sprIconUITransform.contentSize.height}`;
                        } else {
                            sprIconContentSize = '无UITransform组件';
                        }
                    } else {
                        sprIconImageName = 'sprIcon无Sprite组件';
                    }
                } else {
                    console.warn(`[UISolvePuzzle] 预制体"${slotNode.name}"的Mask节点没有找到sprIcon子节点`);
                }
                
                console.log(`[UISolvePuzzle] 为网格槽位${index}设置了遮罩 - 预制体:"${slotNode.name}", 父节点尺寸:${sizeInfo.slotSize}, Mask尺寸:${maskContentSize}(动态计算), 遮罩图片:"${maskImageName}", sprIcon尺寸:${sprIconContentSize}(直接设置), sprIcon图片:"${sprIconImageName}"`);
            } else {
                console.warn(`[UISolvePuzzle] 预制体"${slotNode.name}"的网格槽位${index}的Mask节点没有Sprite组件`);
            }
        } else {
            console.warn(`[UISolvePuzzle] 无法获取网格槽位${index}的遮罩SpriteFrame，难度:${this.currentDifficulty}`);
        }
    }

    /**
     * 打乱拼图切片顺序
     */
    private shufflePieces(): void {
        if (!this.puzzlePieces || this.puzzlePieces.length === 0) {
            console.warn('[UISolvePuzzle] 没有拼图切片可以打乱');
            return;
        }
        
        console.log(`[UISolvePuzzle] 开始打乱${this.puzzlePieces.length}个拼图切片`);
        
        // 使用Fisher-Yates洗牌算法打乱数组
        for (let i = this.puzzlePieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            
            // 交换数组中的元素
            [this.puzzlePieces[i], this.puzzlePieces[j]] = [this.puzzlePieces[j], this.puzzlePieces[i]];
        }
        
        // 重新排列UI中的拼图切片位置
        this.rearrangePuzzlePiecesInUI();
        
        console.log('[UISolvePuzzle] 拼图切片打乱完成');
    }
    
    /**
     * 重新排列UI中的拼图切片位置
     */
    private rearrangePuzzlePiecesInUI(): void {
        if (!this.pieceContent) {
            console.error('[UISolvePuzzle] pieceContent未找到，无法重新排列UI');
            return;
        }
        
        // 按照打乱后的顺序重新设置每个切片在父节点中的位置
        this.puzzlePieces.forEach((puzzlePiece, index) => {
            if (puzzlePiece && puzzlePiece.node && puzzlePiece.node.isValid) {
                // 将节点移动到对应的索引位置
                puzzlePiece.node.setSiblingIndex(index);
            }
        });
        
        console.log('[UISolvePuzzle] UI中的拼图切片位置重新排列完成');
    }

    /**
     * 检查拼图是否完成
     */
    private checkPuzzleCompletion(): void {
        const totalSlots = this.gridRows * this.gridCols;
        let completedSlots = 0;
        
        // 统计已完成的槽位数量
        for (let i = 0; i < totalSlots; i++) {
            if (this.gridAnswerSlots[i] && this.gridAnswerSlots[i].isValid) {
                completedSlots++;
            }
        }
        
        console.log(`[UISolvePuzzle] 拼图完成进度：${completedSlots}/${totalSlots}`);
        
        // 如果所有槽位都有答案切片，则拼图完成
        if (completedSlots === totalSlots) {
            console.log('[UISolvePuzzle] 拼图已完成！');
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