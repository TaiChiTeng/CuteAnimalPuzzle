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
    private currentDraggedPuzzlePiece: PuzzlePiece = null;  // 当前被拖拽的原始拼图切片
    private isDragFromPuzzleList: boolean = false;  // 标记当前拖拽是否来自puzzlePieces列表
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
        
        // 不再在dragArea上绑定鼠标事件，改为在拼图切片上绑定
    }

    onDestroy() {
        // 移除事件监听
        this.btnBack?.node.off(Button.EventType.CLICK, this.onBackButtonClick, this);
        this.btnHint?.node.off(Button.EventType.CLICK, this.onHintButtonClick, this);
        
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
        if (!this.dragPiecePrefab || !this.dragArea || !puzzlePiece) return;
        
        // 阻止事件传播，避免触发其他鼠标事件
        event.propagationStopped = true;
        
        // 创建拖拽预制体并从列表中移除原切片
        this.createDragPieceFromPuzzlePiece(event.getUILocation().x, event.getUILocation().y, puzzlePiece);
        
        // 使用input全局事件监听
        input.on(Input.EventType.MOUSE_MOVE, this.onGlobalMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onGlobalMouseUp, this);
        
        console.log(`[UISolvePuzzle] 鼠标按下事件处理完成，切片${puzzlePiece.pieceIndex}`);
    }
    
    /**
     * 拼图切片触摸开始事件处理（兼容移动设备）
     */
    private onPieceTouchStart(event: EventTouch, puzzlePiece: PuzzlePiece): void {
        if (!this.dragPiecePrefab || !this.dragArea || !puzzlePiece) return;
        
        // 阻止事件传播，避免触发其他触摸事件
        event.propagationStopped = true;
        
        // 创建拖拽预制体并从列表中移除原切片
        this.createDragPieceFromPuzzlePiece(event.getUILocation().x, event.getUILocation().y, puzzlePiece);
        
        // 使用input全局事件监听，避免ScrollView干扰
        input.on(Input.EventType.TOUCH_MOVE, this.onGlobalTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onGlobalTouchEnd, this);
        
        console.log(`[UISolvePuzzle] 触摸开始事件处理完成，切片${puzzlePiece.pieceIndex}`);
    }
    
    /**
     * dragPieceSlots切片鼠标按下事件处理
     */
    private onDragPieceMouseDown(event: EventMouse, dragPieceNode: Node, pieceIndex: number): void {
        console.log(`[UISolvePuzzle] dragPieceSlots切片${pieceIndex}鼠标按下`);
        event.propagationStopped = true;
        
        // 创建拖拽预制体
        this.createDragPieceFromDragPiece(event.getUILocation().x, event.getUILocation().y, dragPieceNode, pieceIndex);
        
        // 添加input全局鼠标事件监听
        input.on(Input.EventType.MOUSE_MOVE, this.onGlobalMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onGlobalMouseUp, this);
    }
    
    /**
     * dragPieceSlots切片触摸开始事件处理（兼容移动设备）
     */
    private onDragPieceTouchStart(event: EventTouch, dragPieceNode: Node, pieceIndex: number): void {
        console.log(`[UISolvePuzzle] dragPieceSlots切片${pieceIndex}触摸开始`);
        event.propagationStopped = true;
        
        // 创建拖拽预制体
        this.createDragPieceFromDragPiece(event.getUILocation().x, event.getUILocation().y, dragPieceNode, pieceIndex);
        
        // 添加input全局触摸事件监听
        input.on(Input.EventType.TOUCH_MOVE, this.onGlobalTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onGlobalTouchEnd, this);
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
        input.off(Input.EventType.MOUSE_MOVE, this.onGlobalMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onGlobalMouseUp, this);
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
        input.off(Input.EventType.TOUCH_MOVE, this.onGlobalTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onGlobalTouchEnd, this);
    }
    
    /**
     * 处理拖拽结束逻辑
     */
    private handleDragEnd(): void {
        if (!this.currentDragPiece || !this.currentDraggedPuzzlePiece) {
            console.log('[UISolvePuzzle] 没有正在拖拽的切片，跳过处理');
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
                this.removePuzzlePieceFromList(this.currentDraggedPuzzlePiece);
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
                    // 来自dragPieceSlots：恢复到dragPieceSlots
                    console.log(`[UISolvePuzzle] dragPieceSlots切片${this.currentDraggedPuzzlePiece.pieceIndex}在列表范围内，但保持为未拼好切片`);
                    this.restoreToDragPieceSlots();
                }
                
                // 销毁拖拽副本
                this.destroyDragPiece();
            } else {
                // 不在列表范围内：创建或恢复未拼好切片
                if (isFromPuzzleList) {
                    console.log(`[UISolvePuzzle] 切片${this.currentDraggedPuzzlePiece.pieceIndex}不在列表范围内，创建未拼好切片`);
                    this.createUnplacedPiece();
                    
                    // 从列表中永久移除原切片
                    this.removePuzzlePieceFromList(this.currentDraggedPuzzlePiece);
                } else {
                    console.log(`[UISolvePuzzle] dragPieceSlots切片${this.currentDraggedPuzzlePiece.pieceIndex}不在列表范围内，恢复为未拼好切片`);
                    this.restoreToDragPieceSlots();
                }
                
                // 销毁拖拽副本
                this.destroyDragPiece();
            }
        }
        
        // 清理当前拖拽状态
        this.currentDraggedPuzzlePiece = null;
        this.isDragFromPuzzleList = false;
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
     * 恢复dragPieceSlots中的切片到原位置
     */
    private restoreToDragPieceSlots(): void {
        if (!this.currentDragPiece || !this.currentDraggedPuzzlePiece) {
            return;
        }
        
        // 创建新的未拼好切片，使用当前拖拽副本的位置
        const dragPiecePos = this.currentDragPiece.getWorldPosition();
        const localPos = new Vec3();
        this.dragArea.getComponent(UITransform).convertToNodeSpaceAR(dragPiecePos, localPos);
        
        // 实例化dragPiecePrefab
        const restoredPiece = instantiate(this.dragPiecePrefab);
        
        // 设置尺寸
        const restoredTransform = restoredPiece.getComponent(UITransform);
        const currentTransform = this.currentDragPiece.getComponent(UITransform);
        if (restoredTransform && currentTransform) {
            restoredTransform.setContentSize(currentTransform.contentSize);
        }
        
        // 设置图片
        const restoredSprite = restoredPiece.getComponent(Sprite);
        const currentSprite = this.currentDragPiece.getComponent(Sprite);
        if (restoredSprite && currentSprite && currentSprite.spriteFrame) {
            restoredSprite.spriteFrame = currentSprite.spriteFrame;
        }
        
        // 设置位置
        restoredPiece.setPosition(localPos);
        
        // 添加到dragArea
        this.dragArea.addChild(restoredPiece);
        
        // 为恢复的切片绑定事件
        this.setupDragPieceEvents(restoredPiece, this.currentDraggedPuzzlePiece.pieceIndex);
        
        // 添加到dragPieceSlots数组
        this.dragPieceSlots.push(restoredPiece);
        
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
        const dragPieceSprite = dragPieceNode.getComponent(Sprite);
        const currentDragSprite = this.currentDragPiece.getComponent(Sprite);
        if (dragPieceSprite && currentDragSprite && dragPieceSprite.spriteFrame) {
            currentDragSprite.spriteFrame = dragPieceSprite.spriteFrame;
        }
        
        // 将拖拽预制体添加到dragArea
        this.dragArea.addChild(this.currentDragPiece);
        
        // 设置拖拽预制体的初始位置
        this.updateDragPiecePosition(x, y);
        
        // 从dragPieceSlots数组中暂时移除原切片
        const index = this.dragPieceSlots.indexOf(dragPieceNode);
        if (index !== -1) {
            this.dragPieceSlots.splice(index, 1);
            dragPieceNode.removeFromParent();
            console.log(`[UISolvePuzzle] 从dragPieceSlots中暂时移除了切片${pieceIndex}`);
        }
        
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
        const sprite = this.currentDragPiece.getComponent(Sprite);
        const resourceManager = PuzzleResourceManager.instance;
        
        if (sprite && resourceManager && puzzlePiece) {
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
            
            // 将拼图切片重新添加到列表
            this.puzzlePieces.push(this.currentDraggedPuzzlePiece);
            
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
        
        // 设置容错距离，如果拖拽预制体与正确槽位的距离小于阈值，则认为在正确位置
        const tolerance = 50; // 可以根据需要调整
        
        if (distance <= tolerance) {
            console.log(`[UISolvePuzzle] 拖拽预制体在正确位置，槽位索引：${correctSlotIndex}，距离：${distance}`);
            return correctSlotIndex;
        }
        
        return -1;
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
        
        // 设置位置为当前拖拽预制体的位置
        unplacedPiece.setPosition(this.currentDragPiece.getPosition());
        
        // 设置图片（与被拖拽的拼图切片相同）
        const sprite = unplacedPiece.getComponent(Sprite);
        const resourceManager = PuzzleResourceManager.instance;
        
        if (sprite && resourceManager && this.currentDraggedPuzzlePiece) {
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
        
        // 将未拼好切片添加到dragArea父节点
        this.dragArea.addChild(unplacedPiece);
        
        // 为未拼好切片绑定事件
        this.setupDragPieceEvents(unplacedPiece, this.currentDraggedPuzzlePiece.pieceIndex);
        
        // 存储到dragPieceSlots数组
        this.dragPieceSlots.push(unplacedPiece);
        
        console.log(`[UISolvePuzzle] 创建了未拼好切片${this.currentDraggedPuzzlePiece.pieceIndex}，停留在松开位置`);
    }
    
    /**
     * 将拼图切片插入回列表，根据最近位置确定插入位置
     */
    private insertPieceBackToList(): void {
        if (!this.currentDraggedPuzzlePiece || !this.pieceContent) {
            console.error('[UISolvePuzzle] 无法插入回列表，缺少必要参数');
            return;
        }
        
        // 恢复原拼图切片的显示
        this.currentDraggedPuzzlePiece.node.active = true;
        
        // 如果列表为空，直接添加
        if (this.puzzlePieces.length === 0) {
            this.puzzlePieces.push(this.currentDraggedPuzzlePiece);
            this.pieceContent.addChild(this.currentDraggedPuzzlePiece.node);
            console.log(`[UISolvePuzzle] 将切片${this.currentDraggedPuzzlePiece.pieceIndex}插入到空列表`);
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
        this.puzzlePieces.splice(insertIndex, 0, this.currentDraggedPuzzlePiece);
        
        // 重新排列pieceContent中的子节点顺序
        this.currentDraggedPuzzlePiece.node.removeFromParent();
        this.pieceContent.insertChild(this.currentDraggedPuzzlePiece.node, insertIndex);
        
        console.log(`[UISolvePuzzle] 将切片${this.currentDraggedPuzzlePiece.pieceIndex}插入到列表位置${insertIndex}`);
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
            
            // 为拼图切片添加鼠标事件
            this.setupPieceMouseEvents(pieceNode, puzzlePiece);
            
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