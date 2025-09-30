import { _decorator, Component, Node, Button, Toggle, ScrollView, Prefab, instantiate, Sprite, SpriteFrame, Label, ProgressBar } from 'cc';
import { GameDataPuzzle, PuzzleStatus, PuzzleDifficulty } from './GameDataPuzzle';
import { UIManager } from './UIManager';
import { PuzzleResourceManager } from './PuzzleResourceManager';
const { ccclass, property } = _decorator;

/**
 * 难度选择和拼图列表界面
 * 负责显示特定拼图组的拼图列表，以及难度选择功能
 */
@ccclass('UISelectDifAndPuzzle')
export class UISelectDifAndPuzzle extends Component {

    // 返回拼图组选择界面按钮
    @property(Button)
    public btnBack: Button = null;

    // 难度切换按钮的父节点
    @property(Node)
    public difficultyToggleParent: Node = null;

    @property(Toggle)
    public toggleEasy: Toggle = null;    // 9张拼图

    @property(Toggle)
    public toggleMedium: Toggle = null;  // 16张拼图

    @property(Toggle)
    public toggleHard: Toggle = null;    // 25张拼图

    // 拼图的滚动视图
    @property(ScrollView)
    public puzzleScrollView: ScrollView = null;

    // 拼图内容节点
    @property(Node)
    public puzzleContent: Node = null;

    // 拼图项预制体
    @property(Prefab)
    public itemSelectPuzzlePrefab: Prefab = null;

    // 下载进度条（可选）
    @property(ProgressBar)
    public downloadProgressBar: ProgressBar = null;

    // 下载状态标签（可选）
    @property(Label)
    public downloadStatusLabel: Label = null;

    // 等待标签，显示加载进度信息
    @property(Label)
    public labelWait: Label = null;

    private uiManager: UIManager = null;
    private puzzleItems: Node[] = [];
    private currentGroupIndex: number = 0; // 当前选择的拼图组索引
    private isDownloading: boolean = false; // 是否正在下载
    private currentGroupId: number = -1; // 当前正在处理的拼图组ID

    start() {
        console.log('[UISelectDifAndPuzzle] start方法被调用，开始初始化');
        
        // 获取UIManager引用
        this.uiManager = this.getComponent(UIManager) || this.node.parent?.getComponent(UIManager);
        if (this.uiManager) {
            console.log('[UISelectDifAndPuzzle] UIManager组件获取成功');
        } else {
            console.error('[UISelectDifAndPuzzle] 未找到UIManager组件');
        }
        
        // 检查必要的组件和节点
        if (!this.puzzleContent) {
            console.error('[UISelectDifAndPuzzle] puzzleContent节点未配置');
        } else {
            console.log('[UISelectDifAndPuzzle] puzzleContent节点配置正常');
        }
        
        if (!this.itemSelectPuzzlePrefab) {
            console.error('[UISelectDifAndPuzzle] itemSelectPuzzlePrefab预制体未配置');
        } else {
            console.log('[UISelectDifAndPuzzle] itemSelectPuzzlePrefab预制体配置正常');
        }
        
        // 绑定按钮事件
        this.btnBack?.node.on(Button.EventType.CLICK, this.onBackButtonClick, this);
        
        // 绑定难度切换事件
        this.toggleEasy?.node.on(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        this.toggleMedium?.node.on(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        this.toggleHard?.node.on(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        
        console.log('[UISelectDifAndPuzzle] start方法执行完成');
    }

    onDestroy() {
        // 暂停当前组的下载任务（不取消，保留下载进度）
        this.pauseCurrentGroupDownload();
        
        // 移除事件监听
        this.btnBack?.node.off(Button.EventType.CLICK, this.onBackButtonClick, this);
        this.toggleEasy?.node.off(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        this.toggleMedium?.node.off(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        this.toggleHard?.node.off(Toggle.EventType.TOGGLE, this.onDifficultyToggle, this);
        
        // 清理拼图项事件
        this.clearPuzzleItems();
    }

    /**
     * 返回按钮点击事件 - 返回拼图组选择界面
     */
    private onBackButtonClick(): void {
        console.log('[UISelectDifAndPuzzle] 点击返回按钮，返回拼图组选择界面');
        
        // 暂停当前组的下载任务（不取消，保留下载进度）
        this.pauseCurrentGroupDownload();
        
        if (this.uiManager) {
            // 返回到拼图组选择界面
            console.log('[UISelectDifAndPuzzle] 调用UIManager切换到拼图组选择界面');
            this.uiManager.showSelectPuzzleGroupOnly();
        } else {
            console.error('[UISelectDifAndPuzzle] UIManager未初始化，无法切换界面');
        }
    }

    /**
     * 难度切换事件
     */
    private onDifficultyToggle(toggle: Toggle): void {
        if (!toggle.isChecked) return;
        
        console.log('[UISelectDifAndPuzzle] 难度切换被触发');
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.error('[UISelectDifAndPuzzle] GameDataPuzzle实例未找到');
            return;
        }
        
        let difficulty: PuzzleDifficulty;
        
        if (toggle === this.toggleEasy) {
            difficulty = PuzzleDifficulty.EASY;
            console.log('[UISelectDifAndPuzzle] 选择简单难度 (9张拼图)');
        } else if (toggle === this.toggleMedium) {
            difficulty = PuzzleDifficulty.MEDIUM;
            console.log('[UISelectDifAndPuzzle] 选择中等难度 (16张拼图)');
        } else if (toggle === this.toggleHard) {
            difficulty = PuzzleDifficulty.HARD;
            console.log('[UISelectDifAndPuzzle] 选择困难难度 (25张拼图)');
        } else {
            console.warn('[UISelectDifAndPuzzle] 未知的难度切换按钮');
            return;
        }
        
        gameData.setCurrentDifficulty(difficulty);
        console.log('[UISelectDifAndPuzzle] 难度已设置为:', difficulty);
    }

    /**
     * 查看按钮点击事件
     */
    private onLookPuzzleClick(puzzleId: number): void {
        console.log(`[UISelectDifAndPuzzle] 查看按钮被点击，拼图ID: ${puzzleId}`);
        
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.error(`[UISelectDifAndPuzzle] GameDataPuzzle实例未找到，无法查看拼图 ${puzzleId}`);
            return;
        }
        
        const status = gameData.getPuzzleStatus(puzzleId);
        if (status !== PuzzleStatus.COMPLETED) {
            console.warn(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 状态为 ${status}，不是已完成状态，无法查看`);
            return;
        }
        
        // 根据拼图ID设置当前拼图组索引
        gameData.setCurrentPuzzleGroupIndexByPuzzleId(puzzleId);
        // 设置当前拼图ID
        gameData.setSelectedPuzzleId(puzzleId);
        console.log(`[UISelectDifAndPuzzle] 已设置当前拼图ID为: ${puzzleId}`);
        
        // 切换到完成拼图界面
        if (this.uiManager) {
            console.log(`[UISelectDifAndPuzzle] 准备切换到完成拼图界面`);
            this.uiManager.showFinishPuzzleOnly();
        } else {
            console.error(`[UISelectDifAndPuzzle] 未找到UIManager组件，无法切换到完成拼图界面`);
        }
    }

    /**
     * 拼图选择按钮点击事件
     */
    private onPuzzleItemClick(puzzleId: number): void {
        console.log(`[UISelectDifAndPuzzle] 拼图项 ${puzzleId} 被点击`);
        
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.error(`[UISelectDifAndPuzzle] GameDataPuzzle实例未找到，无法处理拼图 ${puzzleId} 的点击事件`);
            return;
        }
        
        const status = gameData.getPuzzleStatus(puzzleId);
        console.log(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 当前状态: ${status}`);
        
        // 只有已解锁的拼图才能进入游戏
        if (status === PuzzleStatus.UNLOCKED || status === PuzzleStatus.COMPLETED) {
            console.log(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 可以进入游戏，开始切换界面`);
            
            // 根据拼图ID设置当前拼图组索引
            gameData.setCurrentPuzzleGroupIndexByPuzzleId(puzzleId);
            gameData.setSelectedPuzzleId(puzzleId);
            console.log(`[UISelectDifAndPuzzle] 已设置当前拼图ID为: ${puzzleId}`);
            
            if (this.uiManager) {
                console.log(`[UISelectDifAndPuzzle] 找到UIManager，准备切换到拼图游戏界面`);
                this.uiManager.showSolvePuzzleOnly();
            } else {
                console.error(`[UISelectDifAndPuzzle] 未找到UIManager组件，无法切换到拼图游戏界面`);
            }
        } else {
            console.log(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 状态为 ${status}，无法进入游戏`);
            if (status === PuzzleStatus.LOCKED) {
                console.log(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 处于锁定状态，需要先解锁`);
            }
            // 这里可以播放提示音效或显示提示信息
        }
    }

    /**
     * 界面显示时调用
     * @param groupIndex 要显示的拼图组索引，默认为0
     */
    public onShow(groupIndex: number = 0): void {
        console.log(`[UISelectDifAndPuzzle] 界面显示，拼图组索引: ${groupIndex}`);
        
        // 如果切换到不同的组，暂停之前组的下载任务，继续新组的下载任务
        const gameData = GameDataPuzzle.instance;
        if (gameData) {
            const allGroupIds = gameData.getAllGroupIds();
            const newGroupId = allGroupIds[groupIndex] || 0;
            
            if (this.currentGroupId !== -1 && this.currentGroupId !== newGroupId) {
                console.log(`[UISelectDifAndPuzzle] 切换拼图组，暂停组 ${this.currentGroupId} 的下载任务`);
                this.pauseCurrentGroupDownload();
            }
            
            this.currentGroupId = newGroupId;
            
            // 如果是相同的组，继续之前的下载任务
            if (this.currentGroupId === newGroupId) {
                console.log(`[UISelectDifAndPuzzle] 继续拼图组 ${this.currentGroupId} 的下载任务`);
                this.resumeCurrentGroupDownload();
            }
        }
        
        this.currentGroupIndex = groupIndex;
        
        // 初始化难度切换按钮状态
        this.initializeDifficultyToggles();
        
        // 显示难度切换按钮
        if (this.difficultyToggleParent) {
            this.difficultyToggleParent.active = true;
        }
        
        // 隐藏下载进度条和状态标签
        this.hideDownloadProgress();
        
        // 检查拼图组下载状态
        if (gameData) {
            const allGroupIds = gameData.getAllGroupIds();
            const targetGroupId = allGroupIds[groupIndex] || 0;
            const downloadStatus = gameData.checkGroupDownloadStatus(targetGroupId);
            
            if (downloadStatus.isFullyDownloaded) {
                // 拼图组已完全下载，直接显示拼图列表
                console.log(`[UISelectDifAndPuzzle] 拼图组 ${targetGroupId} 已完全下载，直接显示拼图列表`);
                this.showPuzzleScrollView();
                this.hideLabelWait();
                this.initializePuzzleList(groupIndex).catch(err => {
                    console.error('[UISelectDifAndPuzzle] 初始化拼图列表失败:', err);
                });
            } else {
                // 拼图组未完全下载，显示等待标签并开始下载
                console.log(`[UISelectDifAndPuzzle] 拼图组 ${targetGroupId} 未完全下载 (${downloadStatus.downloadedCount}/${downloadStatus.totalCount})，开始下载`);
                this.hidePuzzleScrollView();
                this.showLabelWait();
                this.updateLabelWaitText(downloadStatus.downloadedCount, downloadStatus.totalCount);
                
                // 开始下载当前拼图组的图片，然后初始化拼图列表
                this.downloadAndInitializePuzzleGroup(groupIndex).catch(err => {
                    console.error('[UISelectDifAndPuzzle] 下载和初始化拼图组失败:', err);
                });
            }
        } else {
            console.error('[UISelectDifAndPuzzle] GameDataPuzzle实例不存在');
        }
        
        // 声音按钮状态由UIManager统一更新
    }

    /**
     * 下载并初始化拼图组
     */
    private async downloadAndInitializePuzzleGroup(groupIndex: number): Promise<void> {
        if (this.isDownloading) {
            console.log('[UISelectDifAndPuzzle] 正在下载中，跳过重复下载');
            return;
        }

        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.error('[UISelectDifAndPuzzle] GameDataPuzzle实例不存在');
            return;
        }

        try {
            this.isDownloading = true;
            
            // 获取拼图组ID
            const allGroupIds = gameData.getAllGroupIds();
            const targetGroupId = allGroupIds[groupIndex] || 0;
            
            console.log(`[UISelectDifAndPuzzle] 开始下载拼图组 ${targetGroupId} (索引: ${groupIndex}) 的图片`);
            
            // 使用新的按组初始化方法，带进度回调
            await gameData.initializePuzzleGroupData(targetGroupId, (current: number, total: number) => {
                // 更新等待标签的进度文本
                this.updateLabelWaitText(current, total);
                console.log(`[UISelectDifAndPuzzle] 拼图组 ${targetGroupId} 下载进度: ${current}/${total}`);
            });
            
            console.log(`[UISelectDifAndPuzzle] 拼图组 ${targetGroupId} 下载完成`);
            
            // 下载完成后初始化拼图列表
            await this.initializePuzzleList(groupIndex);
            
            // 隐藏等待标签，显示拼图滚动视图
            this.hideLabelWait();
            this.showPuzzleScrollView();
            
        } catch (error) {
            console.error('[UISelectDifAndPuzzle] 下载拼图组失败:', error);
            this.updateLabelWaitText(0, 1, '下载失败，请重试');
            
            // 即使下载失败也尝试初始化拼图列表（可能有缓存的图片）
            await this.initializePuzzleList(groupIndex);
            
            // 延迟隐藏错误信息
            setTimeout(() => {
                this.hideLabelWait();
                this.showPuzzleScrollView();
            }, 2000);
        } finally {
            this.isDownloading = false;
        }
    }

    /**
     * 显示拼图滚动视图
     */
    private showPuzzleScrollView(): void {
        if (this.puzzleScrollView) {
            this.puzzleScrollView.node.active = true;
        }
    }

    /**
     * 隐藏拼图滚动视图
     */
    private hidePuzzleScrollView(): void {
        if (this.puzzleScrollView) {
            this.puzzleScrollView.node.active = false;
        }
    }

    /**
     * 显示等待标签
     */
    private showLabelWait(): void {
        if (this.labelWait) {
            this.labelWait.node.active = true;
        }
    }

    /**
     * 隐藏等待标签
     */
    private hideLabelWait(): void {
        if (this.labelWait) {
            this.labelWait.node.active = false;
        }
    }

    /**
     * 更新等待标签的文本
     * @param current 当前已下载数量
     * @param total 总数量
     * @param customText 自定义文本（可选）
     */
    private updateLabelWaitText(current: number, total: number, customText?: string): void {
        if (this.labelWait) {
            if (customText) {
                this.labelWait.string = customText;
            } else {
                const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
                this.labelWait.string = `加载拼图中:${percentage}%`;
            }
        }
    }

    /**
     * 显示下载进度
     */
    private showDownloadProgress(): void {
        if (this.downloadProgressBar) {
            this.downloadProgressBar.node.active = true;
            this.downloadProgressBar.progress = 0;
        }
        if (this.downloadStatusLabel) {
            this.downloadStatusLabel.node.active = true;
        }
    }

    /**
     * 隐藏下载进度
     */
    private hideDownloadProgress(): void {
        if (this.downloadProgressBar) {
            this.downloadProgressBar.node.active = false;
        }
        if (this.downloadStatusLabel) {
            this.downloadStatusLabel.node.active = false;
        }
    }

    /**
     * 更新下载进度
     */
    private updateDownloadProgress(progress: number): void {
        if (this.downloadProgressBar) {
            this.downloadProgressBar.progress = Math.max(0, Math.min(1, progress));
        }
    }

    /**
     * 更新下载状态文本
     */
    private updateDownloadStatus(status: string): void {
        if (this.downloadStatusLabel) {
            this.downloadStatusLabel.string = status;
        }
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
        console.log(`[UISelectDifAndPuzzle] 开始初始化拼图列表，组索引: ${groupIndex}`);
        
        const gameData = GameDataPuzzle.instance;
        const resourceManager = PuzzleResourceManager.instance;
        
        // 检查必要的组件和节点
        if (!gameData) {
            console.error('[UISelectDifAndPuzzle] GameDataPuzzle实例未找到，无法初始化拼图列表');
            return;
        }
        if (!resourceManager) {
            console.error('[UISelectDifAndPuzzle] PuzzleResourceManager实例未找到，无法初始化拼图列表');
            return;
        }
        if (!this.puzzleContent) {
            console.error('[UISelectDifAndPuzzle] puzzleContent节点未找到，无法初始化拼图列表');
            return;
        }
        if (!this.itemSelectPuzzlePrefab) {
            console.error('[UISelectDifAndPuzzle] itemSelectPuzzlePrefab预制未设置，无法初始化拼图列表');
            return;
        }
        
        console.log('[UISelectDifAndPuzzle] 所有必要组件检查通过，开始创建拼图列表');
        
        // 清理现有的拼图项
        this.clearPuzzleItems();
        console.log('[UISelectDifAndPuzzle] 已清理现有拼图项');
        
        // 根据组索引获取对应组的拼图ID列表
        const allGroupIds = gameData.getAllGroupIds();
        const targetGroupId = allGroupIds[groupIndex] || 0;
        const availablePuzzleIds = gameData.getPuzzleIdsByGroup(targetGroupId);
        console.log(`[UISelectDifAndPuzzle] 组索引: ${groupIndex}, 组ID: ${targetGroupId}`);
        console.log('[UISelectDifAndPuzzle] 该组可用拼图ID列表:', availablePuzzleIds);
        console.log('[UISelectDifAndPuzzle] 该组拼图总数:', availablePuzzleIds.length);
        
        this.currentGroupIndex = groupIndex;
        
        // 过滤掉UNAVAILABLE状态的拼图
        const displayablePuzzleIds = availablePuzzleIds.filter(puzzleId => {
            const status = gameData.getPuzzleStatus(puzzleId);
            const isDisplayable = status !== PuzzleStatus.UNAVAILABLE;
            if (!isDisplayable) {
                console.log(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 状态为UNAVAILABLE，跳过显示`);
            }
            return isDisplayable;
        });
        console.log('[UISelectDifAndPuzzle] 过滤后可显示的拼图ID列表:', displayablePuzzleIds);
        console.log('[UISelectDifAndPuzzle] 可显示拼图数量:', displayablePuzzleIds.length);
        
        // 创建拼图项
        let successCount = 0;
        for (let i = 0; i < displayablePuzzleIds.length; i++) {
            const puzzleId = displayablePuzzleIds[i];
            console.log(`[UISelectDifAndPuzzle] 正在创建拼图项 ${i + 1}/${displayablePuzzleIds.length}, ID: ${puzzleId}`);
            
            const puzzleItem = instantiate(this.itemSelectPuzzlePrefab);
            
            if (puzzleItem) {
                // 获取拼图资源信息用于调试
                const spriteFrame = resourceManager.getPuzzleSpriteFrame(puzzleId);
                const resourceName = spriteFrame ? spriteFrame.name : '未找到资源';
                console.log(`[UISelectDifAndPuzzle] 拼图ID ${puzzleId} 对应资源: ${resourceName}`);
                
                // 设置拼图项的显示（异步）
                await this.setupPuzzleItem(puzzleItem, puzzleId, i);
                
                // 添加到内容节点
                this.puzzleContent.addChild(puzzleItem);
                this.puzzleItems.push(puzzleItem);
                successCount++;
                
                console.log(`[UISelectDifAndPuzzle] 拼图项 ${puzzleId} 创建成功`);
            } else {
                console.error(`[UISelectDifAndPuzzle] 拼图项 ${puzzleId} 实例化失败`);
            }
        }
        
        console.log(`[UISelectDifAndPuzzle] 拼图列表初始化完成！成功创建 ${successCount}/${displayablePuzzleIds.length} 个拼图项`);
    }

    /**
     * 设置拼图项的显示和事件
     */
    private async setupPuzzleItem(puzzleItem: Node, puzzleId: number, index: number): Promise<void> {
        console.log(`[UISelectDifAndPuzzle] 开始设置拼图项 ${puzzleId} (索引: ${index})`);
        
        const gameData = GameDataPuzzle.instance;
        if (!gameData) {
            console.error(`[UISelectDifAndPuzzle] GameDataPuzzle实例未找到，无法设置拼图项 ${puzzleId}`);
            return;
        }
        
        const status = gameData.getPuzzleStatus(puzzleId);
        console.log(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 当前状态: ${status}`);
        
        // 查找拼图项的子节点
        const btnPuzzle = puzzleItem.getComponent(Button);
        const sprPuzzle = puzzleItem.getChildByName('sprPuzzle')?.getComponent(Sprite);
        const sprLocked = puzzleItem.getChildByName('sprLocked');
        const sprUnfinished = puzzleItem.getChildByName('sprUnfinished');
        const btnLookPuzzle = puzzleItem.getChildByName('btnLookPuzzle')?.getComponent(Button);
        
        console.log(`[UISelectDifAndPuzzle] 拼图项 ${puzzleId} 子节点检查:`);
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
                    console.log(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 图片设置成功`);
                } else {
                    console.warn(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 图片资源未找到`);
                }
            }
        }
        
        // 根据拼图状态设置UI显示
        switch (status) {
            case PuzzleStatus.LOCKED:
                // 锁定状态：显示锁定图标，隐藏其他
                if (sprLocked) sprLocked.active = true;
                if (sprUnfinished) sprUnfinished.active = false;
                if (btnLookPuzzle) btnLookPuzzle.node.active = false;
                console.log(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 设置为锁定状态显示`);
                break;
                
            case PuzzleStatus.UNLOCKED:
                // 解锁但未完成状态：显示未完成图标，隐藏其他
                if (sprLocked) sprLocked.active = false;
                if (sprUnfinished) sprUnfinished.active = true;
                if (btnLookPuzzle) btnLookPuzzle.node.active = false;
                console.log(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 设置为未完成状态显示`);
                break;
                
            case PuzzleStatus.COMPLETED:
                // 已完成状态：隐藏状态图标，显示查看按钮
                if (sprLocked) sprLocked.active = false;
                if (sprUnfinished) sprUnfinished.active = false;
                if (btnLookPuzzle) btnLookPuzzle.node.active = true;
                console.log(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 设置为已完成状态显示`);
                break;
                
            default:
                console.warn(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 状态未知: ${status}`);
                break;
        }
        
        // 绑定主按钮点击事件
        if (btnPuzzle) {
            btnPuzzle.node.on(Button.EventType.CLICK, () => {
                this.onPuzzleItemClick(puzzleId);
            }, this);
            console.log(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 主按钮点击事件绑定成功`);
        } else {
            console.error(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} Button组件未找到，无法绑定点击事件`);
        }
        
        // 绑定查看按钮点击事件（仅对已完成的拼图）
        if (btnLookPuzzle && status === PuzzleStatus.COMPLETED) {
            btnLookPuzzle.node.on(Button.EventType.CLICK, () => {
                this.onLookPuzzleClick(puzzleId);
            }, this);
            console.log(`[UISelectDifAndPuzzle] 拼图 ${puzzleId} 查看按钮点击事件绑定成功`);
        }
        
        console.log(`[UISelectDifAndPuzzle] 拼图项 ${puzzleId} 设置完成`);
    }

    /**
     * 清理拼图项
     */
    private clearPuzzleItems(): void {
        console.log('[UISelectDifAndPuzzle] 开始清理拼图项');
        
        // 移除事件监听并销毁节点
        for (const item of this.puzzleItems) {
            if (item && item.isValid) {
                const btn = item.getComponent(Button);
                if (btn) {
                    btn.node.off(Button.EventType.CLICK);
                }
                
                const btnLook = item.getChildByName('btnLookPuzzle')?.getComponent(Button);
                if (btnLook) {
                    btnLook.node.off(Button.EventType.CLICK);
                }
                
                item.destroy();
            }
        }
        
        // 清空数组
        this.puzzleItems.length = 0;
        
        console.log('[UISelectDifAndPuzzle] 拼图项清理完成');
    }

    /**
     * 暂停当前组的下载任务
     */
    private pauseCurrentGroupDownload(): void {
        if (this.currentGroupId !== -1) {
            const gameData = GameDataPuzzle.instance;
            if (gameData) {
                console.log(`[UISelectDifAndPuzzle] 暂停拼图组 ${this.currentGroupId} 的下载任务`);
                gameData.pauseGroupDownload(this.currentGroupId);
            }
        }
        this.isDownloading = false;
    }

    /**
     * 继续当前组的下载任务
     */
    private resumeCurrentGroupDownload(): void {
        if (this.currentGroupId !== -1) {
            const gameData = GameDataPuzzle.instance;
            if (gameData) {
                console.log(`[UISelectDifAndPuzzle] 继续拼图组 ${this.currentGroupId} 的下载任务`);
                gameData.resumeGroupDownload(this.currentGroupId);
            }
        }
    }

    /**
     * 设置当前拼图组索引
     */
    public setCurrentGroupIndex(groupIndex: number): void {
        console.log(`[UISelectDifAndPuzzle] 设置当前拼图组索引: ${groupIndex}`);
        this.currentGroupIndex = groupIndex;
    }

    /**
     * 获取当前拼图组索引
     */
    public getCurrentGroupIndex(): number {
        return this.currentGroupIndex;
    }
}