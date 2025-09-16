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
        
        // 不再在dragArea上绑定鼠标事件，改为在拼图切片上绑定
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
        
        if (!this.dragPiecePrefab || !this.dragArea || !puzzlePiece) return;
        
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
        
        if (!this.dragPiecePrefab || !this.dragArea || !puzzlePiece) return;
        
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
     */
    private createDragPieceFromDragPiece(x: number, y: number, dragPieceNode: Node, pieceIndex: number): void {
        if (!this.dragPiecePrefab || !this.dragArea) {
            console.error('[UISolvePuzzle] 缺少dragPiecePrefab或dragArea');
            return;
        }
        
        // 实例化拖拽预制体
        this.currentDragPiece = instantiate(this.dragPiecePrefab);
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
        
        // 设置拖拽预制体的图片（复制dragPieceNode的图片）
        const dragPieceSprIconNode = dragPieceNode.getChildByName('sprIcon');
        const currentDragSprIconNode = this.currentDragPiece.getChildByName('sprIcon');
        if (dragPieceSprIconNode && currentDragSprIconNode) {
            const dragPieceSprite = dragPieceSprIconNode.getComponent(Sprite);
            const currentDragSprite = currentDragSprIconNode.getComponent(Sprite);
            if (dragPieceSprite && currentDragSprite && dragPieceSprite.spriteFrame) {
                currentDragSprite.spriteFrame = dragPieceSprite.spriteFrame;
            }
        }
        
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
        
        console.log(`[UISolvePuzzle] 从dragPieceSlots切片${pieceIndex}创建了拖拽预制体`);
    }
    
    /**
     * 从拼图切片创建拖拽预制体
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
        
        // 设置拖拽预制体图片（与被拖拽的拼图切片相同）
        const sprIconNode = this.currentDragPiece.getChildByName('sprIcon');
        const resourceManager = PuzzleResourceManager.instance;
        
        if (sprIconNode && resourceManager && puzzlePiece) {
            const sprite = sprIconNode.getComponent(Sprite);
            if (sprite) {
                // 获取被拖拽拼图切片的索引
                const pieceIndex = puzzlePiece.pieceIndex;
                
                // 获取对应的图片
                const pieceSpriteFrame = resourceManager.getPuzzlePiece(
                    this.currentPuzzleId, 
                    this.gridRows, 
                    this.gridCols, 
                    pieceIndex
                );
                
                if (pieceSpriteFrame) {
                    sprite.spriteFrame = pieceSpriteFrame;
                } else {
                    console.warn(`[UISolvePuzzle] 无法获取拖拽预制体的图片，索引：${pieceIndex}`);
                }
            }
        }
        
        // 将拖拽预制体添加到拖拽区域
        this.dragArea.addChild(this.currentDragPiece);
        
        // 设置拖拽预制体位置
        this.updateDragPiecePosition(x, y);
        
        console.log(`[UISolvePuzzle] 从拼图切片${puzzlePiece.pieceIndex}创建了拖拽预制体，尺寸：${pieceSize}`);
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
     * 计算动态容错距离
     * @returns 容错距离
     */
    private calculateDynamicTolerance(): number {
        // 根据拼图难度获取网格尺寸
        let gridSize: number;
        switch (this.currentDifficulty) {
            case PuzzleDifficulty.EASY:
                gridSize = 3; // 3x3
                break;
            case PuzzleDifficulty.MEDIUM:
                gridSize = 4; // 4x4
                break;
            case PuzzleDifficulty.HARD:
                gridSize = 5; // 5x5
                break;
            default:
                gridSize = 3;
                break;
        }
        
        // 计算单个网格槽位的边长
        const slotSize = this.gridSideLength / gridSize;
        
        // 容错距离 = 槽位边长 * 容错率
        const tolerance = slotSize * this.toleranceRate;
        
        console.log(`[UISolvePuzzle] 动态容错距离计算 - 难度：${this.currentDifficulty}，网格尺寸：${gridSize}x${gridSize}，网格边长：${this.gridSideLength}，槽位边长：${slotSize}，容错率：${this.toleranceRate}，容错距离：${tolerance}`);
        
        return tolerance;
    }
    
    /**
     * 在正确位置创建答案切片
     * @param slotIndex 槽位索引
     */
    private createAnswerPieceAtSlot(slotIndex: number): void {
        if (!this.gridPieceAnswerPrefab || !this.puzzleAnswers || slotIndex < 0 || slotIndex >= this.gridSlots.length) {
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
        
        // 创建未拼好的切片（使用dragPiecePrefab）
        const unplacedPiece = instantiate(this.dragPiecePrefab);
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
        
        // 设置图片（与被拖拽的拼图切片相同）
        const sprIconNode = unplacedPiece.getChildByName('sprIcon');
        const resourceManager = PuzzleResourceManager.instance;
        
        if (sprIconNode && resourceManager && this.currentDraggedPuzzlePiece) {
            const sprite = sprIconNode.getComponent(Sprite);
            if (sprite) {
                const pieceIndex = this.currentDraggedPuzzlePiece.pieceIndex;
                const pieceSpriteFrame = resourceManager.getPuzzlePiece(
                    this.currentPuzzleId, 
                    this.gridRows, 
                    this.gridCols, 
                    pieceIndex
                );
                
                if (pieceSpriteFrame) {
                    sprite.spriteFrame = pieceSpriteFrame;
                }
            }
        }
        
        // 将未拼好切片添加到dragArea父节点
        this.dragArea.addChild(unplacedPiece);
        
        // 为未拼好切片绑定事件
        this.setupDragPieceEvents(unplacedPiece, this.currentDraggedPuzzlePiece.pieceIndex);
        
        // 安全存储到dragPieceSlots数组
        this.safeAddToDragPieceSlots(unplacedPiece);
        
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
            
            // 设置切片图片（复制原dragPieceSlots节点的图片）
            this.setupPieceSprite(newPieceNode, this.currentDraggedPuzzlePiece.pieceIndex);
            
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
        // 屏蔽网格槽位点击事件，改为通过拖拽放置来创建答案切片
        return;
        
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
            
            // 设置拼图切片遮罩
            this.setupPieceMask(puzzlePiece, i);
            
            // 为拼图切片添加鼠标事件
            this.setupPieceMouseEvents(pieceNode, puzzlePiece);
            
            // 安全添加到滚动列表
            this.pieceContent.addChild(pieceNode);
            this.safeAddToPuzzlePieces(puzzlePiece);
        }
        
        // 打乱拼图切片顺序
        this.shufflePieces();
    }

    /**
     * 设置拼图切片图片
     */
    private setupPieceSprite(pieceNode: Node, index: number): void {
        const sprIconNode = pieceNode.getChildByName('sprIcon');
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
     * 设置拼图切片遮罩
     */
    private setupPieceMask(puzzlePiece: PuzzlePiece, index: number): void {
        const maskSpriteFrame = GameDataPuzzle.getMaskSpriteFrame(this.currentDifficulty, index);
        if (maskSpriteFrame) {
            puzzlePiece.setMask(maskSpriteFrame);
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