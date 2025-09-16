import { _decorator, Component, Node, Sprite, Vec3, UITransform, EventTouch, input, Input, Camera, geometry, PhysicsSystem2D, Vec2, SpriteFrame, Mask } from 'cc';
import { GameDataPuzzle, PuzzleDifficulty } from './GameDataPuzzle';
const { ccclass, property } = _decorator;

@ccclass('PuzzlePiece')
export class PuzzlePiece extends Component {
    @property
    public pieceIndex: number = 0;  // 拼图切片索引
    
    @property
    public correctRow: number = 0;  // 正确的行位置
    
    @property
    public correctCol: number = 0;  // 正确的列位置
    
    private uiTransform: UITransform = null;
    private maskNode: Node = null;  // 遮罩节点
    private maskComponent: Mask = null;  // 遮罩组件
    
    start() {
        this.uiTransform = this.getComponent(UITransform);
    }
    
    onDestroy() {
        // TODO: 清理资源
    }
    

    
    /**
     * 移动到指定位置
     */
    public moveToPosition(parent: Node, localPos: Vec3): void {
        this.node.setParent(parent);
        this.node.position = localPos;
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
     * 设置拼图切片的遮罩
     * @param maskSpriteFrame 遮罩SpriteFrame
     */
    public setMask(maskSpriteFrame: SpriteFrame): void {
        if (!maskSpriteFrame) {
            console.warn(`[PuzzlePiece] 拼图切片 ${this.pieceIndex} 没有提供遮罩SpriteFrame`);
            return;
        }
        
        // 查找或创建遮罩节点
        this.maskNode = this.node.getChildByName('Mask');
        if (!this.maskNode) {
            console.warn(`[PuzzlePiece] 拼图切片 ${this.pieceIndex} 没有找到Mask子节点`);
            return;
        }
        
        // 获取遮罩组件
        this.maskComponent = this.maskNode.getComponent(Mask);
        if (!this.maskComponent) {
            console.warn(`[PuzzlePiece] 拼图切片 ${this.pieceIndex} 的Mask节点没有Mask组件`);
            return;
        }
        
        // 设置遮罩的SpriteFrame
        this.maskComponent.spriteFrame = maskSpriteFrame;
        console.log(`[PuzzlePiece] 拼图切片 ${this.pieceIndex} 遮罩设置成功`);
    }
    
    /**
     * 获取遮罩节点
     */
    public getMaskNode(): Node | null {
        return this.maskNode;
    }
    
    /**
     * 获取遮罩组件
     */
    public getMaskComponent(): Mask | null {
        return this.maskComponent;
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