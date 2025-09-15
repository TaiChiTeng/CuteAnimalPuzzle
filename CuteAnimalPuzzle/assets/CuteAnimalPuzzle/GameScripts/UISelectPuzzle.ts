import { _decorator, Component, Node, Button, Toggle, ScrollView, Prefab, instantiate, Sprite, SpriteFrame, Label } from 'cc';
import { GameDataPuzzle, PuzzleStatus, PuzzleDifficulty } from './GameDataPuzzle';
import { UIManager } from './UIManager';
import { PuzzleResourceManager } from './PuzzleResourceManager';
const { ccclass, property } = _decorator;

@ccclass('UISelectPuzzle')
export class UISelectPuzzle extends Component {

    // 返回按钮
    // 点击时要判断：
    // 如果puzzleScrollView正在显示，则隐藏puzzleScrollView，显示puzzleGroupScrollView
    // 如果puzzleGroupScrollView正在显示，则返回UIMainMenu
    @property(Button)
    public btnBack: Button = null;

    // 难度切换按钮的父节点，与puzzleGroupScrollView同时显示和隐藏
    @property(Node)
    public difficultyToggleParent: Node = null;

    @property(Toggle)
    public toggleEasy: Toggle = null;    // 9张拼图

    @property(Toggle)
    public toggleMedium: Toggle = null;  // 16张拼图

    @property(Toggle)
    public toggleHard: Toggle = null;    // 25张拼图

    // 拼图的滚动视图，如果拼图数据只有1个组，就直接显示，直接展示所有的拼图；
    // 如果拼图数据有多个组，则先隐藏
    // 等玩家点击itemPuzzleGroupPrefab后，根据itemPuzzleGroupPrefab的索引，puzzleScrollView展示对应的拼图组；
    @property(ScrollView)
    public puzzleScrollView: ScrollView = null;

    // 拼图组的滚动视图，如果拼图数据只有1个组，就不用展示puzzleGroupScrollView，直接显示puzzleScrollView；
    // 如果拼图数据有多个组，就展示puzzleGroupScrollView，先隐藏puzzleScrollView；
    // 每个拼图组的内容itemPuzzleGroupPrefab都实例化后放在puzzleGroupScrollView的content节点下；
    // 点击itemPuzzleGroupPrefab，隐藏puzzleGroupScrollView，展示puzzleScrollView；
    @property(ScrollView)
    public puzzleGroupScrollView: ScrollView = null;

    @property(Node)
    public puzzleContent: Node = null;

    @property(Prefab)
    public itemSelectPuzzlePrefab: Prefab = null;

    // 拼图组的内容itemPuzzleGroupPrefab，点击切换展示
    // 隐藏puzzleGroupScrollView，根据根据itemPuzzleGroupPrefab的索引，puzzleScrollView展示对应的拼图组；
    // itemPuzzleGroupPrefab里边只展示对应拼图组的第1张图片
    @property(Prefab)
    public itemPuzzleGroupPrefab: Prefab = null;

    // 等待标签，显示加载进度信息
    @property(Label)
    public labelWait: Label = null;

    // 拼图资源管理器将自动处理资源

    private uiManager: UIManager = null;
    private puzzleItems: Node[] = [];
    private puzzleGroupItems: Node[] = [];
    private currentGroupIndex: number = 0; // 当前选择的拼图组索引
    private readonly WAIT_TIME: number = 0.2; // 等待时间（秒）
    private isWaiting: boolean = false; // 是否正在等待

    start() {
        console.log('[UISelectPuzzle] start方法被调用，开始初始化');
        
        // 获取UIManager引用
        this.uiManager = this.getComponent(UIManager) || this.node.parent?.getComponent(UIManager);
        if (this.uiManager) {
            console.log('[UISelectPuzzle] UIManager组件获取成功');
        } else {
            console.error('[UISelectPuzzle] 未找到UIManager组件');
        }
        
        // 检查必要的组件和节点
        if (!this.puzzleContent) {
            console.error('[UISelectPuzzle] puzzleContent节点未配置');
        } else {
            console.log('[UISelectPuzzle] puzzleContent节点配置正常');
        }
        
        if (!this.itemSelectPuzzlePrefab) {
            console.error('[UISelectPuzzle] itemSelectPuzzlePrefab预制体未配置');
        } else {
            console.log('[UISelectPuzzle] itemSelectPuzzlePrefab预制体配置正常');
        }
        
        // 绑定按钮事件
        this.btnBack?.node.on(Button.EventType.CLICK, this.onBackButtonClick, this);
        
        // 绑定难度切换事件
        this.toggleEasy?.node.on(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        this.toggleMedium?.node.on(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        this.toggleHard?.node.on(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        
        console.log('[UISelectPuzzle] start方法执行完成');
    }

    onDestroy() {
        // 移除事件监听
        this.btnBack?.node.off(Button.EventType.CLICK, this.onBackButtonClick, this);
        this.toggleEasy?.node.off(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        this.toggleMedium?.node.off(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        this.toggleHard?.node.off(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        
        // 清理定时器
        this.unscheduleAllCallbacks();
        
        // 清理拼图项和拼图组项事件
        this.clearPuzzleItems();
        this.clearPuzzleGroupItems();
    }

    /**
     * 返回按钮点击事件
     */
    private onBackButtonClick(): void {
        console.log('[UISelectPuzzle] 点击返回按钮');
        
        // 判断当前显示的是哪个界面
        if (this.puzzleScrollView && this.puzzleScrollView.node.active) {
            // 当前显示拼图列表，返回到拼图组选择
            const gameData = GameDataPuzzle.instance;
            if (gameData && gameData.getPuzzleGroupCount() > 1) {
                console.log('[UISelectPuzzle] 从拼图列表返回到拼图组选择');
                this.showPuzzleGroupView().catch(err => {
                    console.error('[UISelectPuzzle] 显示拼图组视图失败:', err);
                });
                return; // 返回到拼图组选择，不继续执行返回主菜单
            }
        }
        
        // 如果puzzleGroupScrollView正在显示，或者只有一个拼图组，则返回主菜单
        console.log('[UISelectPuzzle] 返回主菜单');
        if (this.uiManager) {
            this.uiManager.showMainMenuOnly();
        } else {
            console.error('[UISelectPuzzle] UIManager未初始化，无法切换界面');
        }
    }

    /**
     * 难度切换事件
     */
    private onDifficultyToggle(toggle: Toggle): void {
        if (!toggle.isChecked) return;
        
        console.log('[UISelectPuzzle] 难度切换被触发');
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.error('[UISelectPuzzle] GameDataPuzzle实例未找到');
            return;
        }
        
        let difficulty: PuzzleDifficulty;
        
        if (toggle === this.toggleEasy) {
            difficulty = PuzzleDifficulty.EASY;
            console.log('[UISelectPuzzle] 选择简单难度 (9张拼图)');
        } else if (toggle === this.toggleMedium) {
            difficulty = PuzzleDifficulty.MEDIUM;
            console.log('[UISelectPuzzle] 选择中等难度 (16张拼图)');
        } else if (toggle === this.toggleHard) {
            difficulty = PuzzleDifficulty.HARD;
            console.log('[UISelectPuzzle] 选择困难难度 (25张拼图)');
        } else {
            console.warn('[UISelectPuzzle] 未知的难度切换按钮');
            return;
        }
        
        gameData.setCurrentDifficulty(difficulty);
        console.log('[UISelectPuzzle] 难度已设置为:', difficulty);
    }

    /**
     * 查看按钮点击事件
     */
    private onLookPuzzleClick(puzzleId: number): void {
        console.log(`[UISelectPuzzle] 查看按钮被点击，拼图ID: ${puzzleId}`);
        
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.error(`[UISelectPuzzle] GameDataPuzzle实例未找到，无法查看拼图 ${puzzleId}`);
            return;
        }
        
        const status = gameData.getPuzzleStatus(puzzleId);
        if (status !== PuzzleStatus.COMPLETED) {
            console.warn(`[UISelectPuzzle] 拼图 ${puzzleId} 状态为 ${status}，不是已完成状态，无法查看`);
            return;
        }
        
        // 设置当前拼图ID
        gameData.setSelectedPuzzleId(puzzleId);
        console.log(`[UISelectPuzzle] 已设置当前拼图ID为: ${puzzleId}`);
        
        // 切换到完成拼图界面
        if (this.uiManager) {
            console.log(`[UISelectPuzzle] 准备切换到完成拼图界面`);
            this.uiManager.showFinishPuzzleOnly();
        } else {
            console.error(`[UISelectPuzzle] 未找到UIManager组件，无法切换到完成拼图界面`);
        }
    }

    /**
     * 拼图选择按钮点击事件
     */
    private onPuzzleItemClick(puzzleId: number): void {
        console.log(`[UISelectPuzzle] 拼图项 ${puzzleId} 被点击`);
        
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.error(`[UISelectPuzzle] GameDataPuzzle实例未找到，无法处理拼图 ${puzzleId} 的点击事件`);
            return;
        }
        
        const status = gameData.getPuzzleStatus(puzzleId);
        console.log(`[UISelectPuzzle] 拼图 ${puzzleId} 当前状态: ${status}`);
        
        // 只有已解锁的拼图才能进入游戏
        if (status === PuzzleStatus.UNLOCKED || status === PuzzleStatus.COMPLETED) {
            console.log(`[UISelectPuzzle] 拼图 ${puzzleId} 可以进入游戏，开始切换界面`);
            
            gameData.setSelectedPuzzleId(puzzleId);
            console.log(`[UISelectPuzzle] 已设置当前拼图ID为: ${puzzleId}`);
            
            if (this.uiManager) {
                console.log(`[UISelectPuzzle] 找到UIManager，准备切换到拼图游戏界面`);
                this.uiManager.showSolvePuzzleOnly();
            } else {
                console.error(`[UISelectPuzzle] 未找到UIManager组件，无法切换到拼图游戏界面`);
            }
        } else {
            console.log(`[UISelectPuzzle] 拼图 ${puzzleId} 状态为 ${status}，无法进入游戏`);
            if (status === PuzzleStatus.LOCKED) {
                console.log(`[UISelectPuzzle] 拼图 ${puzzleId} 处于锁定状态，需要先解锁`);
            }
            // 这里可以播放提示音效或显示提示信息
        }
    }

    /**
     * 界面显示时调用
     */
    public onShow(): void {
        this.initializeDifficultyToggles();
        
        // 开始等待流程
        this.startWaitingProcess();
        
        // 声音按钮状态由UIManager统一更新
    }

    /**
     * 开始等待流程
     */
    private startWaitingProcess(): void {
        console.log('[UISelectPuzzle] 开始等待流程');
        
        this.isWaiting = true;
        
        // 显示等待标签
        if (this.labelWait) {
            this.labelWait.node.active = true;
            this.labelWait.string = '加载拼图中...';
        }
        
        // 隐藏滚动视图和难度切换按钮
        if (this.puzzleScrollView) {
            this.puzzleScrollView.node.active = false;
        }
        if (this.puzzleGroupScrollView) {
            this.puzzleGroupScrollView.node.active = false;
        }
        if (this.difficultyToggleParent) {
            this.difficultyToggleParent.active = false;
        }
        
        // 等待指定时间后检查加载进度
        this.scheduleOnce(() => {
            this.checkLoadingProgressAndShow();
        }, this.WAIT_TIME);
    }

    /**
     * 检查加载进度并显示相应界面
     */
    private checkLoadingProgressAndShow(): void {
        console.log('[UISelectPuzzle] 等待时间结束，检查加载进度');
        
        this.isWaiting = false;
        
        // 隐藏等待标签
        if (this.labelWait) {
            this.labelWait.node.active = false;
        }
        
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.error('[UISelectPuzzle] GameDataPuzzle实例未找到');
            return;
        }
        
        // 获取实际可用的拼图组数量（排除所有图片都加载失败的组）
        const availableGroupCount = this.getAvailableGroupCount();
        console.log(`[UISelectPuzzle] 实际可用拼图组数量: ${availableGroupCount}`);
        
        if (availableGroupCount > 1) {
            // 多个组，显示拼图组选择界面
            this.showPuzzleGroupView().catch(err => {
                console.error('[UISelectPuzzle] 显示拼图组视图失败:', err);
            });
        } else {
            // 只有一个组或没有组，直接显示拼图列表
            this.showPuzzleListView(0).catch(err => {
                console.error('[UISelectPuzzle] 显示拼图列表视图失败:', err);
            });
        }
        
        // 显示难度切换按钮
        if (this.difficultyToggleParent) {
            this.difficultyToggleParent.active = true;
        }
    }

    /**
     * 获取实际可用的拼图组数量
     * 排除所有图片都加载失败的组
     */
    private getAvailableGroupCount(): number {
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
            } else {
                console.log(`[UISelectPuzzle] 拼图组 ${groupId} 的所有图片都加载失败，跳过该组`);
            }
        }
        
        return availableGroupCount;
    }

    /**
     * 初始化难度切换按钮状态
     */
    private initializeDifficultyToggles(): void {
        const gameData = GameDataPuzzle.instance;
        if (!gameData) return;
        
        const currentDifficulty = gameData.getCurrentDifficulty();
        
        if (this.toggleEasy) {
            this.toggleEasy.isChecked = (currentDifficulty === PuzzleDifficulty.EASY);
        }
        
        if (this.toggleMedium) {
            this.toggleMedium.isChecked = (currentDifficulty === PuzzleDifficulty.MEDIUM);
        }
        
        if (this.toggleHard) {
            this.toggleHard.isChecked = (currentDifficulty === PuzzleDifficulty.HARD);
        }
    }

    /**
     * 初始化拼图列表
     */
    private async initializePuzzleList(groupIndex: number = 0): Promise<void> {
        console.log('[UISelectPuzzle] 开始初始化拼图列表');
        
        const gameData = GameDataPuzzle.instance;
        const resourceManager = PuzzleResourceManager.instance;
        
        // 检查必要的组件和节点
        if (!gameData) {
            console.error('[UISelectPuzzle] GameDataPuzzle实例未找到，无法初始化拼图列表');
            return;
        }
        if (!resourceManager) {
            console.error('[UISelectPuzzle] PuzzleResourceManager实例未找到，无法初始化拼图列表');
            return;
        }
        if (!this.puzzleContent) {
            console.error('[UISelectPuzzle] puzzleContent节点未找到，无法初始化拼图列表');
            return;
        }
        if (!this.itemSelectPuzzlePrefab) {
            console.error('[UISelectPuzzle] itemSelectPuzzlePrefab预制未设置，无法初始化拼图列表');
            return;
        }
        
        console.log('[UISelectPuzzle] 所有必要组件检查通过，开始创建拼图列表');
        
        // 清理现有的拼图项
        this.clearPuzzleItems();
        console.log('[UISelectPuzzle] 已清理现有拼图项');
        
        // 根据组索引获取对应组的拼图ID列表
        const allGroupIds = gameData.getAllGroupIds();
        const targetGroupId = allGroupIds[groupIndex] || 0;
        const availablePuzzleIds = gameData.getPuzzleIdsByGroup(targetGroupId);
        console.log(`[UISelectPuzzle] 组索引: ${groupIndex}, 组ID: ${targetGroupId}`);
        console.log('[UISelectPuzzle] 该组可用拼图ID列表:', availablePuzzleIds);
        console.log('[UISelectPuzzle] 该组拼图总数:', availablePuzzleIds.length);
        
        this.currentGroupIndex = groupIndex;
        
        // 过滤掉UNAVAILABLE状态的拼图
        const displayablePuzzleIds = availablePuzzleIds.filter(puzzleId => {
            const status = gameData.getPuzzleStatus(puzzleId);
            const isDisplayable = status !== PuzzleStatus.UNAVAILABLE;
            if (!isDisplayable) {
                console.log(`[UISelectPuzzle] 拼图 ${puzzleId} 状态为UNAVAILABLE，跳过显示`);
            }
            return isDisplayable;
        });
        console.log('[UISelectPuzzle] 过滤后可显示的拼图ID列表:', displayablePuzzleIds);
        console.log('[UISelectPuzzle] 可显示拼图数量:', displayablePuzzleIds.length);
        
        // 创建拼图项
        let successCount = 0;
        for (let i = 0; i < displayablePuzzleIds.length; i++) {
            const puzzleId = displayablePuzzleIds[i];
            console.log(`[UISelectPuzzle] 正在创建拼图项 ${i + 1}/${displayablePuzzleIds.length}, ID: ${puzzleId}`);
            
            const puzzleItem = instantiate(this.itemSelectPuzzlePrefab);
            
            if (puzzleItem) {
                // 获取拼图资源信息用于调试
                const spriteFrame = resourceManager.getPuzzleSpriteFrame(puzzleId);
                const resourceName = spriteFrame ? spriteFrame.name : '未找到资源';
                console.log(`[UISelectPuzzle] 拼图ID ${puzzleId} 对应资源: ${resourceName}`);
                
                // 设置拼图项的显示（异步）
                await this.setupPuzzleItem(puzzleItem, puzzleId, i);
                
                // 添加到内容节点
                this.puzzleContent.addChild(puzzleItem);
                this.puzzleItems.push(puzzleItem);
                successCount++;
                
                console.log(`[UISelectPuzzle] 拼图项 ${puzzleId} 创建成功`);
            } else {
                console.error(`[UISelectPuzzle] 拼图项 ${puzzleId} 实例化失败`);
            }
        }
        
        console.log(`[UISelectPuzzle] 拼图列表初始化完成！成功创建 ${successCount}/${displayablePuzzleIds.length} 个拼图项`);
    }

    /**
     * 设置拼图项的显示和事件
     */
    private async setupPuzzleItem(puzzleItem: Node, puzzleId: number, index: number): Promise<void> {
        console.log(`[UISelectPuzzle] 开始设置拼图项 ${puzzleId} (索引: ${index})`);
        
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.error(`[UISelectPuzzle] GameDataPuzzle实例未找到，无法设置拼图项 ${puzzleId}`);
            return;
        }
        
        const status = gameData.getPuzzleStatus(puzzleId);
        console.log(`[UISelectPuzzle] 拼图 ${puzzleId} 当前状态: ${status}`);
        
        // 查找拼图项的子节点
        const btnPuzzle = puzzleItem.getComponent(Button);
        const sprPuzzle = puzzleItem.getChildByName('sprPuzzle')?.getComponent(Sprite);
        const sprLocked = puzzleItem.getChildByName('sprLocked');
        const sprUnfinished = puzzleItem.getChildByName('sprUnfinished');
        const btnLookPuzzle = puzzleItem.getChildByName('btnLookPuzzle')?.getComponent(Button);
        
        console.log(`[UISelectPuzzle] 拼图项 ${puzzleId} 子节点检查:`);
        console.log(`  - Button组件: ${btnPuzzle ? '找到' : '未找到'}`);
        console.log(`  - sprPuzzle节点: ${sprPuzzle ? '找到' : '未找到'}`);
        console.log(`  - sprLocked节点: ${sprLocked ? '找到' : '未找到'}`);
        console.log(`  - sprUnfinished节点: ${sprUnfinished ? '找到' : '未找到'}`);
        console.log(`  - btnLookPuzzle节点: ${btnLookPuzzle ? '找到' : '未找到'}`);
        
        // 设置拼图图片
        if (sprPuzzle) {
            const resourceManager = PuzzleResourceManager.instance;
            if (resourceManager) {
                // 先尝试同步获取
                let spriteFrame = resourceManager.getPuzzleSpriteFrame(puzzleId);
                
                if (!spriteFrame) {
                    // 如果没有同步获取到，尝试异步加载
                    try {
                        spriteFrame = await resourceManager.loadPuzzleImageAsync(puzzleId);
                    } catch (error) {
                        console.error(`[UISelectPuzzle] 异步加载拼图 ${puzzleId} 图片失败:`, error);
                    }
                }
                
                if (spriteFrame) {
                    sprPuzzle.spriteFrame = spriteFrame;
                    console.log(`[UISelectPuzzle] 拼图 ${puzzleId} 图片设置成功: ${spriteFrame.name}`);
                } else {
                    console.error(`[UISelectPuzzle] 拼图 ${puzzleId} 未找到对应的SpriteFrame资源`);
                }
            } else {
                console.error(`[UISelectPuzzle] PuzzleResourceManager实例未找到，无法设置拼图 ${puzzleId} 的图片`);
            }
        } else {
            console.error(`[UISelectPuzzle] 拼图项 ${puzzleId} 未找到sprPuzzle子节点，无法设置图片`);
        }
        
        // 根据状态设置显示
        console.log(`[UISelectPuzzle] 根据状态 ${status} 设置拼图 ${puzzleId} 的显示`);
        switch (status) {
            case PuzzleStatus.LOCKED:
                if (sprLocked) {
                    sprLocked.active = true;
                    console.log(`[UISelectPuzzle] 拼图 ${puzzleId} 显示锁定图标`);
                }
                if (sprUnfinished) {
                    sprUnfinished.active = true;
                }
                if (btnLookPuzzle) {
                    btnLookPuzzle.node.active = false;
                }
                break;
            case PuzzleStatus.UNLOCKED:
                if (sprLocked) {
                    sprLocked.active = false;
                }
                if (sprUnfinished) {
                    sprUnfinished.active = true;
                }
                if (btnLookPuzzle) {
                    btnLookPuzzle.node.active = false;
                }
                console.log(`[UISelectPuzzle] 拼图 ${puzzleId} 设置为解锁状态`);
                break;
            case PuzzleStatus.COMPLETED:
                if (sprLocked) {
                    sprLocked.active = false;
                }
                if (sprUnfinished) {
                    sprUnfinished.active = false;
                    console.log(`[UISelectPuzzle] 拼图 ${puzzleId} 隐藏未完成图标`);
                }
                if (btnLookPuzzle) {
                    btnLookPuzzle.node.active = true;
                }
                break;
            default:
                if (btnLookPuzzle) {
                    btnLookPuzzle.node.active = false;
                }
                console.warn(`[UISelectPuzzle] 拼图 ${puzzleId} 状态未知: ${status}`);
                break;
        }
        
        // 绑定点击事件
        if (btnPuzzle) {
            btnPuzzle.node.on(Button.EventType.CLICK, () => {
                this.onPuzzleItemClick(puzzleId);
            }, this);
            console.log(`[UISelectPuzzle] 拼图 ${puzzleId} 点击事件绑定成功`);
        } else {
            console.error(`[UISelectPuzzle] 拼图项 ${puzzleId} 未找到Button组件，无法绑定点击事件`);
        }
        
        // 绑定查看按钮点击事件（仅对已完成的拼图）
        if (btnLookPuzzle && status === PuzzleStatus.COMPLETED) {
            btnLookPuzzle.node.on(Button.EventType.CLICK, () => {
                this.onLookPuzzleClick(puzzleId);
            }, this);
            console.log(`[UISelectPuzzle] 拼图 ${puzzleId} 查看按钮点击事件绑定成功`);
        }
        
        console.log(`[UISelectPuzzle] 拼图项 ${puzzleId} 设置完成`);
    }

    /**
     * 显示拼图组选择视图
     */
    private async showPuzzleGroupView(): Promise<void> {
        console.log('[UISelectPuzzle] 显示拼图组选择视图');
        
        if (this.puzzleGroupScrollView) {
            this.puzzleGroupScrollView.node.active = true;
        }
        
        if (this.puzzleScrollView) {
            this.puzzleScrollView.node.active = false;
        }
        
        // 显示难度切换按钮
        if (this.difficultyToggleParent) {
            this.difficultyToggleParent.active = true;
        }
        
        await this.initializePuzzleGroupList();
    }
    
    /**
     * 显示拼图列表视图
     */
    private async showPuzzleListView(groupIndex: number): Promise<void> {
        console.log(`[UISelectPuzzle] 显示拼图列表视图，组索引: ${groupIndex}`);
        
        if (this.puzzleGroupScrollView) {
            this.puzzleGroupScrollView.node.active = false;
        }
        
        if (this.puzzleScrollView) {
            this.puzzleScrollView.node.active = true;
        }
        
        // 显示难度切换按钮
        if (this.difficultyToggleParent) {
            this.difficultyToggleParent.active = true;
        }
        
        await this.initializePuzzleList(groupIndex);
    }
    
    /**
     * 初始化拼图组列表
     */
    private async initializePuzzleGroupList(): Promise<void> {
        console.log('[UISelectPuzzle] 开始初始化拼图组列表');
        
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.error('[UISelectPuzzle] GameDataPuzzle实例未找到');
            return;
        }
        
        if (!this.puzzleGroupScrollView || !this.itemPuzzleGroupPrefab) {
            console.error('[UISelectPuzzle] 拼图组相关组件未配置');
            return;
        }
        
        // 清理现有的拼图组项
        this.clearPuzzleGroupItems();
        
        const allGroupIds = gameData.getAllGroupIds();
        console.log('[UISelectPuzzle] 所有组ID:', allGroupIds);
        
        // 创建拼图组项
        for (let i = 0; i < allGroupIds.length; i++) {
            const groupId = allGroupIds[i];
            const groupItem = instantiate(this.itemPuzzleGroupPrefab);
            
            if (groupItem) {
                await this.setupPuzzleGroupItem(groupItem, i, groupId);
                this.puzzleGroupScrollView.content.addChild(groupItem);
                this.puzzleGroupItems.push(groupItem);
                console.log(`[UISelectPuzzle] 拼图组项 ${i} (组ID: ${groupId}) 创建成功`);
            }
        }
        
        console.log(`[UISelectPuzzle] 拼图组列表初始化完成，共创建 ${this.puzzleGroupItems.length} 个组项`);
    }
    
    /**
     * 设置拼图组项
     */
    private async setupPuzzleGroupItem(groupItem: Node, groupIndex: number, groupId: number): Promise<void> {
        console.log(`[UISelectPuzzle] 设置拼图组项 ${groupIndex} (组ID: ${groupId})`);
        
        const gameData = GameDataPuzzle.instance;
        const resourceManager = PuzzleResourceManager.instance;
        
        if (!gameData || !resourceManager) return;
        
        // 获取该组的拼图ID列表
        const puzzleIds = gameData.getPuzzleIdsByGroup(groupId);
        
        // 只设置第1张图片
        const showNode1 = groupItem.getChildByName('itemPuzzleShow1');
        if (showNode1) {
            const spriteNode1 = showNode1.getChildByName('sprPuzzle1');
            if (spriteNode1) {
                const sprite1 = spriteNode1.getComponent(Sprite);
                if (sprite1 && puzzleIds.length > 0) {
                    const puzzleId = puzzleIds[0];
                    
                    // 先尝试同步获取
                    let spriteFrame = resourceManager.getPuzzleSpriteFrame(puzzleId);
                    
                    if (!spriteFrame) {
                        // 如果没有同步获取到，尝试异步加载
                        try {
                            spriteFrame = await resourceManager.loadPuzzleImageAsync(puzzleId);
                        } catch (error) {
                            console.error(`[UISelectPuzzle] 异步加载拼图组预览图片 ${puzzleId} 失败:`, error);
                        }
                    }
                    
                    if (spriteFrame) {
                        sprite1.spriteFrame = spriteFrame;
                    }
                }
            }
        }
               
        // 绑定点击事件
        const button = groupItem.getComponent(Button);
        if (button) {
            button.node.on(Button.EventType.CLICK, () => {
                this.onPuzzleGroupClick(groupIndex);
            }, this);
        }
    }
    
    /**
     * 拼图组点击事件
     */
    private async onPuzzleGroupClick(groupIndex: number): Promise<void> {
        console.log(`[UISelectPuzzle] 拼图组 ${groupIndex} 被点击`);
        await this.showPuzzleListView(groupIndex);
    }
    
    /**
     * 清理拼图组项
     */
    private clearPuzzleGroupItems(): void {
        for (const item of this.puzzleGroupItems) {
            if (item && item.isValid) {
                const button = item.getComponent(Button);
                if (button) {
                    button.node.off(Button.EventType.CLICK);
                }
                item.destroy();
            }
        }
        this.puzzleGroupItems = [];
    }
    
    /**
     * 清理拼图项
     */
    private clearPuzzleItems(): void {
        for (const item of this.puzzleItems) {
            if (item && item.isValid) {
                const btnPuzzle = item.getComponent(Button);
                if (btnPuzzle) {
                    btnPuzzle.node.off(Button.EventType.CLICK);
                }
                
                const btnLookPuzzle = item.getChildByName('btnLookPuzzle')?.getComponent(Button);
                if (btnLookPuzzle) {
                    btnLookPuzzle.node.off(Button.EventType.CLICK);
                }
                
                item.destroy();
            }
        }
        this.puzzleItems = [];
    }

    update(deltaTime: number) {
        
    }
}