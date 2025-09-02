import { _decorator, Component, Node, Sprite, Vec3, UITransform, EventTouch, input, Input, Camera, geometry, PhysicsSystem2D, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PuzzlePiece')
export class PuzzlePiece extends Component {
    @property
    public pieceIndex: number = 0;  // 拼图切片索引
    
    @property
    public correctRow: number = 0;  // 正确的行位置
    
    @property
    public correctCol: number = 0;  // 正确的列位置
    
    private isDragging: boolean = false;
    private originalParent: Node = null;
    private originalPosition: Vec3 = new Vec3();
    private dragOffset: Vec3 = new Vec3();
    private uiTransform: UITransform = null;
    
    // 拖拽相关回调
    public onDragStart: (piece: PuzzlePiece) => void = null;
    public onDragEnd: (piece: PuzzlePiece, worldPos: Vec3) => void = null;
    public onDragMove: (piece: PuzzlePiece, worldPos: Vec3) => void = null;
    
    start() {
        this.uiTransform = this.getComponent(UITransform);
        this.originalParent = this.node.parent;
        this.originalPosition = this.node.position.clone();
        
        // 注册触摸事件
        this.node.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }
    
    onDestroy() {
        // 移除事件监听
        this.node.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }
    
    /**
     * 触摸开始事件
     */
    private onTouchStart(event: EventTouch): void {
        console.log(`拼图切片 ${this.pieceIndex} 开始拖拽`);
        
        this.isDragging = true;
        this.originalParent = this.node.parent;
        this.originalPosition = this.node.position.clone();
        
        // 计算拖拽偏移
        const touchPos = event.getUILocation();
        const worldPos = this.convertToWorldSpace(touchPos);
        const nodeWorldPos = this.node.getWorldPosition();
        this.dragOffset.set(
            nodeWorldPos.x - worldPos.x,
            nodeWorldPos.y - worldPos.y,
            0
        );
        
        // 将节点移动到最顶层以便拖拽
        const rootCanvas = this.findRootCanvas();
        if (rootCanvas) {
            this.node.setParent(rootCanvas);
        }
        
        // 调用拖拽开始回调
        if (this.onDragStart) {
            this.onDragStart(this);
        }
    }
    
    /**
     * 触摸移动事件
     */
    private onTouchMove(event: EventTouch): void {
        if (!this.isDragging) return;
        
        const touchPos = event.getUILocation();
        const worldPos = this.convertToWorldSpace(touchPos);
        
        // 应用拖拽偏移
        const targetPos = new Vec3(
            worldPos.x + this.dragOffset.x,
            worldPos.y + this.dragOffset.y,
            0
        );
        
        this.node.setWorldPosition(targetPos);
        
        // 调用拖拽移动回调
        if (this.onDragMove) {
            this.onDragMove(this, targetPos);
        }
    }
    
    /**
     * 触摸结束事件
     */
    private onTouchEnd(event: EventTouch): void {
        if (!this.isDragging) return;
        
        console.log(`拼图切片 ${this.pieceIndex} 结束拖拽`);
        
        this.isDragging = false;
        
        const touchPos = event.getUILocation();
        const worldPos = this.convertToWorldSpace(touchPos);
        const targetPos = new Vec3(
            worldPos.x + this.dragOffset.x,
            worldPos.y + this.dragOffset.y,
            0
        );
        
        // 调用拖拽结束回调
        if (this.onDragEnd) {
            this.onDragEnd(this, targetPos);
        }
    }
    
    /**
     * 将UI坐标转换为世界坐标
     */
    private convertToWorldSpace(uiPos: Vec2): Vec3 {
        const camera = this.node.scene?.getComponentInChildren(Camera);
        if (!camera) {
            return new Vec3(uiPos.x, uiPos.y, 0);
        }
        
        // 将屏幕坐标转换为世界坐标
        const worldPos = new Vec3();
        camera.screenToWorld(new Vec3(uiPos.x, uiPos.y, 0), worldPos);
        return worldPos;
    }
    
    /**
     * 查找根Canvas节点
     */
    private findRootCanvas(): Node {
        let current = this.node;
        let rootCanvas = null;
        
        while (current.parent) {
            current = current.parent;
            if (current.getComponent('Canvas')) {
                rootCanvas = current;
            }
        }
        
        return rootCanvas;
    }
    
    /**
     * 重置到原始位置
     */
    public resetToOriginalPosition(): void {
        if (this.originalParent && this.originalParent.isValid) {
            this.node.setParent(this.originalParent);
            this.node.position = this.originalPosition.clone();
        }
    }
    
    /**
     * 移动到指定位置
     */
    public moveToPosition(parent: Node, localPos: Vec3): void {
        this.node.setParent(parent);
        this.node.position = localPos;
        
        // 更新原始位置信息
        this.originalParent = parent;
        this.originalPosition = localPos.clone();
    }
    
    /**
     * 检查是否在指定区域内
     */
    public isInArea(areaNode: Node): boolean {
        if (!areaNode || !areaNode.isValid) return false;
        
        const pieceWorldPos = this.node.getWorldPosition();
        const areaWorldPos = areaNode.getWorldPosition();
        const areaTransform = areaNode.getComponent(UITransform);
        
        if (!areaTransform) return false;
        
        const areaSize = areaTransform.contentSize;
        const halfWidth = areaSize.width / 2;
        const halfHeight = areaSize.height / 2;
        
        return (
            pieceWorldPos.x >= areaWorldPos.x - halfWidth &&
            pieceWorldPos.x <= areaWorldPos.x + halfWidth &&
            pieceWorldPos.y >= areaWorldPos.y - halfHeight &&
            pieceWorldPos.y <= areaWorldPos.y + halfHeight
        );
    }
    
    /**
     * 获取与目标位置的距离
     */
    public getDistanceToPosition(targetWorldPos: Vec3): number {
        const currentWorldPos = this.node.getWorldPosition();
        return Vec3.distance(currentWorldPos, targetWorldPos);
    }
    
    /**
     * 设置拼图切片信息
     */
    public setPieceInfo(index: number, correctRow: number, correctCol: number): void {
        this.pieceIndex = index;
        this.correctRow = correctRow;
        this.correctCol = correctCol;
    }
    
    /**
     * 获取正确位置的索引
     */
    public getCorrectIndex(gridCols: number): number {
        return this.correctRow * gridCols + this.correctCol;
    }
    
    update(deltaTime: number) {
        
    }
}