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
        this.uiManager = this.getComponent(UIManager) || this.node.parent?.getComponent(UIManager);
        
        // 绑定按钮事件
        this.btnBack?.node.on(Button.EventType.CLICK, this.onBackButtonClick, this);
        
        // 绑定难度切换事件
        this.toggleEasy?.node.on(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        this.toggleMedium?.node.on(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        this.toggleHard?.node.on(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
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
        console.log('点击返回主菜单按钮');
        
        if (this.uiManager) {
            this.uiManager.showMainMenuOnly();
        }
    }

    /**
     * 难度切换事件
     */
    private onDifficultyToggle(toggle: Toggle): void {
        if (!toggle.isChecked) return;
        
        let difficulty: PuzzleDifficulty;
        
        if (toggle === this.toggleEasy) {
            difficulty = PuzzleDifficulty.EASY;
            console.log('选择简单难度 (9张拼图)');
        } else if (toggle === this.toggleMedium) {
            difficulty = PuzzleDifficulty.MEDIUM;
            console.log('选择中等难度 (16张拼图)');
        } else if (toggle === this.toggleHard) {
            difficulty = PuzzleDifficulty.HARD;
            console.log('选择困难难度 (25张拼图)');
        }
        
        const gameData = GameDataPuzzle.instance;
        if (gameData && difficulty !== undefined) {
            gameData.setCurrentDifficulty(difficulty);
        }
    }

    /**
     * 拼图选择按钮点击事件
     */
    private onPuzzleItemClick(puzzleId: number): void {
        console.log('选择拼图:', puzzleId);
        
        const gameData = GameDataPuzzle.instance;
        if (gameData) {
            const status = gameData.getPuzzleStatus(puzzleId);
            
            // 只有已解锁的拼图才能进入游戏
            if (status === PuzzleStatus.UNLOCKED || status === PuzzleStatus.COMPLETED) {
                gameData.setSelectedPuzzleId(puzzleId);
                
                if (this.uiManager) {
                    this.uiManager.showSolvePuzzleOnly();
                }
            } else {
                console.log('拼图未解锁，无法进入');
                // 这里可以播放提示音效或显示提示信息
            }
        }
    }

    /**
     * 界面显示时调用
     */
    public onShow(): void {
        this.initializeDifficultyToggles();
        this.initializePuzzleList();
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
        const gameData = GameDataPuzzle.instance;
        const resourceManager = PuzzleResourceManager.instance;
        if (!gameData || !resourceManager || !this.puzzleContent || !this.itemSelectPuzzlePrefab) return;
        
        // 清理现有的拼图项
        this.clearPuzzleItems();
        
        // 获取可显示的拼图ID列表
        const availablePuzzleIds = resourceManager.getAvailablePuzzleIds();
        
        // 创建拼图项
        for (let i = 0; i < availablePuzzleIds.length; i++) {
            const puzzleId = availablePuzzleIds[i];
            const puzzleItem = instantiate(this.itemSelectPuzzlePrefab);
            
            if (puzzleItem) {
                // 设置拼图项的显示
                this.setupPuzzleItem(puzzleItem, puzzleId, i);
                
                // 添加到内容节点
                this.puzzleContent.addChild(puzzleItem);
                this.puzzleItems.push(puzzleItem);
            }
        }
    }

    /**
     * 设置拼图项的显示和事件
     */
    private setupPuzzleItem(puzzleItem: Node, puzzleId: number, index: number): void {
        const gameData = GameDataPuzzle.instance;
        if (!gameData) return;
        
        const status = gameData.getPuzzleStatus(puzzleId);
        
        // 查找拼图项的子节点
        const btnPuzzle = puzzleItem.getComponent(Button);
        const sprPuzzle = puzzleItem.getChildByName('sprPuzzle')?.getComponent(Sprite);
        const lockIcon = puzzleItem.getChildByName('lockIcon');
        const completeIcon = puzzleItem.getChildByName('completeIcon');
        
        // 设置拼图图片
        if (sprPuzzle) {
            const resourceManager = PuzzleResourceManager.instance;
            if (resourceManager) {
                const spriteFrame = resourceManager.getPuzzleSpriteFrame(puzzleId);
                if (spriteFrame) {
                    sprPuzzle.spriteFrame = spriteFrame;
                }
            }
        }
        
        // 根据状态设置显示
        switch (status) {
            case PuzzleStatus.LOCKED:
                if (lockIcon) lockIcon.active = true;
                if (completeIcon) completeIcon.active = false;
                break;
            case PuzzleStatus.UNLOCKED:
                if (lockIcon) lockIcon.active = false;
                if (completeIcon) completeIcon.active = false;
                break;
            case PuzzleStatus.COMPLETED:
                if (lockIcon) lockIcon.active = false;
                if (completeIcon) completeIcon.active = true;
                break;
        }
        
        // 绑定点击事件
        if (btnPuzzle) {
            btnPuzzle.node.on(Button.EventType.CLICK, () => {
                this.onPuzzleItemClick(puzzleId);
            }, this);
        }
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
                item.destroy();
            }
        }
        this.puzzleItems = [];
    }

    update(deltaTime: number) {
        
    }
}