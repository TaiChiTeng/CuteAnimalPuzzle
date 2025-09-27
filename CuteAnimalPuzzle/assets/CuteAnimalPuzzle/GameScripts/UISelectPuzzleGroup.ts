import { _decorator, Component, Node, Button, ScrollView, Prefab, instantiate, Sprite, Label } from 'cc';
import { GameDataPuzzle } from './GameDataPuzzle';
import { UIManager } from './UIManager';
import { PuzzleResourceManager } from './PuzzleResourceManager';
const { ccclass, property } = _decorator;

/**
 * 拼图组选择界面
 * 负责显示所有可用的拼图组，用户点击后进入对应组的拼图列表界面
 */
@ccclass('UISelectPuzzleGroup')
export class UISelectPuzzleGroup extends Component {

    // 返回主菜单按钮
    @property(Button)
    public btnBack: Button = null;

    // 拼图组的滚动视图
    @property(ScrollView)
    public puzzleGroupScrollView: ScrollView = null;

    // 拼图组内容节点
    @property(Node)
    public puzzleGroupContent: Node = null;

    // 拼图组项预制体
    @property(Prefab)
    public itemPuzzleGroupPrefab: Prefab = null;

    // 等待标签，显示加载进度信息
    @property(Label)
    public labelWait: Label = null;

    private uiManager: UIManager = null;
    private puzzleGroupItems: Node[] = [];
    private readonly WAIT_TIME: number = 0.2; // 等待时间（秒）
    private isWaiting: boolean = false; // 是否正在等待

    start() {
        console.log('[UISelectPuzzleGroup] start方法被调用，开始初始化');
        
        // 获取UIManager引用
        this.uiManager = this.getComponent(UIManager) || this.node.parent?.getComponent(UIManager);
        if (this.uiManager) {
            console.log('[UISelectPuzzleGroup] UIManager组件获取成功');
        } else {
            console.error('[UISelectPuzzleGroup] 未找到UIManager组件');
        }
        
        // 检查必要的组件和节点
        if (!this.puzzleGroupContent) {
            console.error('[UISelectPuzzleGroup] puzzleGroupContent节点未配置');
        } else {
            console.log('[UISelectPuzzleGroup] puzzleGroupContent节点配置正常');
        }
        
        if (!this.itemPuzzleGroupPrefab) {
            console.error('[UISelectPuzzleGroup] itemPuzzleGroupPrefab预制体未配置');
        } else {
            console.log('[UISelectPuzzleGroup] itemPuzzleGroupPrefab预制体配置正常');
        }
        
        // 绑定按钮事件
        this.btnBack?.node.on(Button.EventType.CLICK, this.onBackButtonClick, this);
        
        console.log('[UISelectPuzzleGroup] start方法执行完成');
    }

    onDestroy() {
        // 移除事件监听
        this.btnBack?.node.off(Button.EventType.CLICK, this.onBackButtonClick, this);
        
        // 清理定时器
        this.unscheduleAllCallbacks();
        
        // 清理拼图组项事件
        this.clearPuzzleGroupItems();
    }

    /**
     * 返回按钮点击事件 - 返回主菜单
     */
    private onBackButtonClick(): void {
        console.log('[UISelectPuzzleGroup] 点击返回按钮，返回主菜单');
        
        if (this.uiManager) {
            this.uiManager.showMainMenuOnly();
        } else {
            console.error('[UISelectPuzzleGroup] UIManager未初始化，无法切换界面');
        }
    }

    /**
     * 拼图组点击事件
     */
    private onPuzzleGroupClick(groupIndex: number): void {
        console.log(`[UISelectPuzzleGroup] 拼图组 ${groupIndex} 被点击`);
        
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.error('[UISelectPuzzleGroup] GameDataPuzzle实例未找到');
            return;
        }
        
        // 设置当前选择的拼图组索引
        gameData.setCurrentPuzzleGroupIndex(groupIndex);
        console.log(`[UISelectPuzzleGroup] 已设置当前拼图组索引: ${groupIndex}`);
        
        if (this.uiManager) {
            // 切换到难度选择和拼图列表界面，并传递组索引
            console.log('[UISelectPuzzleGroup] 调用UIManager切换到拼图列表界面');
            this.uiManager.showSelectDifAndPuzzleOnly(groupIndex);
        } else {
            console.error('[UISelectPuzzleGroup] UIManager未初始化，无法切换界面');
        }
    }

    /**
     * 界面显示时调用
     */
    public onShow(): void {
        console.log('[UISelectPuzzleGroup] 界面显示，开始等待流程');
        
        // 开始等待流程
        this.startWaitingProcess();
        
        // 声音按钮状态由UIManager统一更新
    }

    /**
     * 开始等待流程
     */
    private startWaitingProcess(): void {
        console.log('[UISelectPuzzleGroup] 开始等待流程');
        
        this.isWaiting = true;
        
        // 显示等待标签
        if (this.labelWait) {
            this.labelWait.node.active = true;
            this.labelWait.string = '加载拼图组中...';
        }
        
        // 隐藏拼图组滚动视图
        if (this.puzzleGroupScrollView) {
            this.puzzleGroupScrollView.node.active = false;
        }
        
        // 等待指定时间后检查加载进度
        this.scheduleOnce(() => {
            this.checkLoadingProgressAndShow();
        }, this.WAIT_TIME);
    }

    /**
     * 检查加载进度并显示拼图组列表
     */
    private checkLoadingProgressAndShow(): void {
        console.log('[UISelectPuzzleGroup] 等待时间结束，检查加载进度');
        
        this.isWaiting = false;
        
        // 隐藏等待标签
        if (this.labelWait) {
            this.labelWait.node.active = false;
        }
        
        // 显示拼图组列表
        this.showPuzzleGroupList();
    }

    /**
     * 显示拼图组列表
     */
    private showPuzzleGroupList(): void {
        console.log('[UISelectPuzzleGroup] 显示拼图组列表');
        
        // 显示拼图组滚动视图
        if (this.puzzleGroupScrollView) {
            this.puzzleGroupScrollView.node.active = true;
        }
        
        // 初始化拼图组列表
        this.initializePuzzleGroupList().catch(err => {
            console.error('[UISelectPuzzleGroup] 初始化拼图组列表失败:', err);
        });
    }

    /**
     * 初始化拼图组列表
     */
    private async initializePuzzleGroupList(): Promise<void> {
        console.log('[UISelectPuzzleGroup] 开始初始化拼图组列表');
        
        const gameData = GameDataPuzzle.instance;
        const resourceManager = PuzzleResourceManager.instance;
        
        // 检查必要的组件
        if (!gameData) {
            console.error('[UISelectPuzzleGroup] GameDataPuzzle实例未找到，无法初始化拼图组列表');
            return;
        }
        if (!resourceManager) {
            console.error('[UISelectPuzzleGroup] PuzzleResourceManager实例未找到，无法初始化拼图组列表');
            return;
        }
        if (!this.puzzleGroupContent) {
            console.error('[UISelectPuzzleGroup] puzzleGroupContent节点未找到，无法初始化拼图组列表');
            return;
        }
        if (!this.itemPuzzleGroupPrefab) {
            console.error('[UISelectPuzzleGroup] itemPuzzleGroupPrefab预制未设置，无法初始化拼图组列表');
            return;
        }
        
        console.log('[UISelectPuzzleGroup] 所有必要组件检查通过，开始创建拼图组列表');
        
        // 清理现有的拼图组项
        this.clearPuzzleGroupItems();
        console.log('[UISelectPuzzleGroup] 已清理现有拼图组项');
        
        // 获取所有拼图组ID
        const allGroupIds = gameData.getAllGroupIds();
        console.log('[UISelectPuzzleGroup] 所有拼图组ID:', allGroupIds);
        console.log('[UISelectPuzzleGroup] 拼图组总数:', allGroupIds.length);
        
        // 过滤出有可用图片的拼图组
        const availableGroups: { groupId: number, groupIndex: number }[] = [];
        for (let i = 0; i < allGroupIds.length; i++) {
            const groupId = allGroupIds[i];
            const puzzleIds = gameData.getPuzzleIdsByGroup(groupId);
            let hasAvailableImage = false;
            
            // 检查该组是否有至少一张可用的图片
            for (const puzzleId of puzzleIds) {
                const spriteFrame = resourceManager.getPuzzleSpriteFrame(puzzleId);
                if (spriteFrame) {
                    hasAvailableImage = true;
                    break;
                }
            }
            
            if (hasAvailableImage) {
                availableGroups.push({ groupId, groupIndex: i });
                console.log(`[UISelectPuzzleGroup] 拼图组 ${groupId} (索引${i}) 有可用图片，加入显示列表`);
            } else {
                console.log(`[UISelectPuzzleGroup] 拼图组 ${groupId} (索引${i}) 的所有图片都加载失败，跳过该组`);
            }
        }
        
        console.log('[UISelectPuzzleGroup] 可用拼图组数量:', availableGroups.length);
        
        // 创建拼图组项
        let successCount = 0;
        for (let i = 0; i < availableGroups.length; i++) {
            const { groupId, groupIndex } = availableGroups[i];
            console.log(`[UISelectPuzzleGroup] 正在创建拼图组项 ${i + 1}/${availableGroups.length}, 组ID: ${groupId}, 组索引: ${groupIndex}`);
            
            const puzzleGroupItem = instantiate(this.itemPuzzleGroupPrefab);
            
            if (puzzleGroupItem) {
                // 设置拼图组项的显示（异步）
                await this.setupPuzzleGroupItem(puzzleGroupItem, groupId, groupIndex);
                
                // 添加到内容节点
                this.puzzleGroupContent.addChild(puzzleGroupItem);
                this.puzzleGroupItems.push(puzzleGroupItem);
                successCount++;
                
                console.log(`[UISelectPuzzleGroup] 拼图组项 ${groupId} 创建成功`);
            } else {
                console.error(`[UISelectPuzzleGroup] 拼图组项 ${groupId} 实例化失败`);
            }
        }
        
        console.log(`[UISelectPuzzleGroup] 拼图组列表初始化完成！成功创建 ${successCount}/${availableGroups.length} 个拼图组项`);
    }

    /**
     * 设置拼图组项的显示和事件
     */
    private async setupPuzzleGroupItem(puzzleGroupItem: Node, groupId: number, groupIndex: number): Promise<void> {
        console.log(`[UISelectPuzzleGroup] 开始设置拼图组项 ${groupId} (索引: ${groupIndex})`);
        
        const gameData = GameDataPuzzle.instance;
        const resourceManager = PuzzleResourceManager.instance;
        
        if (!gameData || !resourceManager) {
            console.error(`[UISelectPuzzleGroup] 必要组件未找到，无法设置拼图组项 ${groupId}`);
            return;
        }
        
        // 查找拼图组项的子节点（参考UISelectPuzzle.ts的正确实现）
        const btnPuzzleGroup = puzzleGroupItem.getComponent(Button);
        
        // 获取该组的拼图ID列表
        const puzzleIds = gameData.getPuzzleIdsByGroup(groupId);
        
        console.log(`[UISelectPuzzleGroup] 拼图组项 ${groupId} 子节点检查:`);
        console.log(`  - Button组件: ${btnPuzzleGroup ? '找到' : '未找到'}`);
        
        // 查找正确的节点路径：itemPuzzleShow1 -> sprPuzzle1
        const showNode1 = puzzleGroupItem.getChildByName('itemPuzzleShow1');
        if (showNode1) {
            const spriteNode1 = showNode1.getChildByName('sprPuzzle1');
            if (spriteNode1) {
                const sprite1 = spriteNode1.getComponent(Sprite);
                console.log(`  - itemPuzzleShow1节点: 找到`);
                console.log(`  - sprPuzzle1节点: ${sprite1 ? '找到' : '未找到'}`);
                
                if (sprite1 && puzzleIds.length > 0) {
                    // 使用第一张拼图作为组的代表图片
                    const representativePuzzleId = puzzleIds[0];
                    
                    // 先尝试同步获取
                    let spriteFrame = resourceManager.getPuzzleSpriteFrame(representativePuzzleId);
                    
                    if (spriteFrame) {
                        sprite1.spriteFrame = spriteFrame;
                        console.log(`[UISelectPuzzleGroup] 拼图组 ${groupId} 设置代表图片成功（同步），使用拼图ID: ${representativePuzzleId}`);
                    } else {
                        // 如果同步获取失败，尝试异步加载
                        try {
                            spriteFrame = await resourceManager.loadPuzzleImageAsync(representativePuzzleId);
                            if (spriteFrame) {
                                sprite1.spriteFrame = spriteFrame;
                                console.log(`[UISelectPuzzleGroup] 拼图组 ${groupId} 设置代表图片成功（异步），使用拼图ID: ${representativePuzzleId}`);
                            } else {
                                console.warn(`[UISelectPuzzleGroup] 拼图组 ${groupId} 异步加载代表图片失败，拼图ID: ${representativePuzzleId}`);
                            }
                        } catch (error) {
                            console.error(`[UISelectPuzzleGroup] 拼图组 ${groupId} 异步加载代表图片出错，拼图ID: ${representativePuzzleId}`, error);
                        }
                    }
                } else {
                    console.warn(`[UISelectPuzzleGroup] 拼图组 ${groupId} 没有找到Sprite组件或拼图ID列表为空`);
                }
            } else {
                console.error(`[UISelectPuzzleGroup] 拼图组 ${groupId} 未找到sprPuzzle1节点`);
            }
        } else {
            console.error(`[UISelectPuzzleGroup] 拼图组 ${groupId} 未找到itemPuzzleShow1节点`);
        }
        
        // 绑定点击事件
        if (btnPuzzleGroup) {
            btnPuzzleGroup.node.on(Button.EventType.CLICK, () => {
                this.onPuzzleGroupClick(groupIndex);
            }, this);
            console.log(`[UISelectPuzzleGroup] 拼图组 ${groupId} 点击事件绑定成功`);
        } else {
            console.error(`[UISelectPuzzleGroup] 拼图组 ${groupId} Button组件未找到，无法绑定点击事件`);
        }
        
        console.log(`[UISelectPuzzleGroup] 拼图组项 ${groupId} 设置完成`);
    }

    /**
     * 清理拼图组项
     */
    private clearPuzzleGroupItems(): void {
        console.log('[UISelectPuzzleGroup] 开始清理拼图组项');
        
        // 移除事件监听并销毁节点
        for (const item of this.puzzleGroupItems) {
            if (item && item.isValid) {
                const btn = item.getComponent(Button);
                if (btn) {
                    btn.node.off(Button.EventType.CLICK);
                }
                item.destroy();
            }
        }
        
        // 清空数组
        this.puzzleGroupItems.length = 0;
        
        console.log('[UISelectPuzzleGroup] 拼图组项清理完成');
    }

    /**
     * 获取实际可用的拼图组数量
     * 排除所有图片都加载失败的组
     */
    public getAvailableGroupCount(): number {
        const gameData = GameDataPuzzle.instance;
        const resourceManager = PuzzleResourceManager.instance;
        
        if (!gameData || !resourceManager) {
            return 0;
        }
        
        const allGroupIds = gameData.getAllGroupIds();
        let availableGroupCount = 0;
        
        for (const groupId of allGroupIds) {
            const puzzleIds = gameData.getPuzzleIdsByGroup(groupId);
            let hasAvailableImage = false;
            
            // 检查该组是否有至少一张可用的图片
            for (const puzzleId of puzzleIds) {
                const spriteFrame = resourceManager.getPuzzleSpriteFrame(puzzleId);
                if (spriteFrame) {
                    hasAvailableImage = true;
                    break;
                }
            }
            
            if (hasAvailableImage) {
                availableGroupCount++;
            }
        }
        
        return availableGroupCount;
    }
}