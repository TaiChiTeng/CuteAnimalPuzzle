import { _decorator, Component, Node, Button, Toggle, ScrollView, Prefab, instantiate, Sprite, SpriteFrame } from 'cc';
import { GameDataPuzzle, PuzzleStatus, PuzzleDifficulty } from './GameDataPuzzle';
import { UIManager } from './UIManager';
import { PuzzleResourceManager } from './PuzzleResourceManager';
const { ccclass, property } = _decorator;

@ccclass('UISelectPuzzle')
export class UISelectPuzzle extends Component {
    @property(Button)
    public btnBack: Button = null;

    @property(Toggle)
    public toggleEasy: Toggle = null;    // 9张拼图

    @property(Toggle)
    public toggleMedium: Toggle = null;  // 16张拼图

    @property(Toggle)
    public toggleHard: Toggle = null;    // 25张拼图

    @property(ScrollView)
    public puzzleScrollView: ScrollView = null;

    @property(Node)
    public puzzleContent: Node = null;

    @property(Prefab)
    public itemSelectPuzzlePrefab: Prefab = null;

    // 拼图资源管理器将自动处理资源

    private uiManager: UIManager = null;
    private puzzleItems: Node[] = [];

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
        
        // 清理拼图项事件
        this.clearPuzzleItems();
    }

    /**
     * 返回按钮点击事件
     */
    private onBackButtonClick(): void {
        console.log('[UISelectPuzzle] 点击返回主菜单按钮');
        
        if (this.uiManager) {
            console.log('[UISelectPuzzle] 准备切换到主菜单界面');
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
        this.initializePuzzleList();
        // 声音按钮状态由UIManager统一更新
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
    private initializePuzzleList(): void {
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
        
        // 获取可显示的拼图ID列表
        const availablePuzzleIds = resourceManager.getAvailablePuzzleIds();
        console.log('[UISelectPuzzle] 可用拼图ID列表:', availablePuzzleIds);
        console.log('[UISelectPuzzle] 拼图总数:', availablePuzzleIds.length);
        
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
                
                // 设置拼图项的显示
                this.setupPuzzleItem(puzzleItem, puzzleId, i);
                
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
    private setupPuzzleItem(puzzleItem: Node, puzzleId: number, index: number): void {
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
                const spriteFrame = resourceManager.getPuzzleSpriteFrame(puzzleId);
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