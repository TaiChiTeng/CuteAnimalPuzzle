import { _decorator, Component, Node, Button, ProgressBar } from 'cc';
import { GameDataPuzzle } from './GameDataPuzzle';
import { UIManager } from './UIManager';
const { ccclass, property } = _decorator;

@ccclass('UIMainMenu')
export class UIMainMenu extends Component {
    @property(Button)
    public btnPlay: Button = null;

    @property(ProgressBar)
    public LoadPuzzleBar: ProgressBar = null;

    private uiManager: UIManager = null;
    private isFirstShow: boolean = true;
    private isLoading: boolean = false;

    start() {
        this.uiManager = this.getComponent(UIManager) || this.node.parent?.getComponent(UIManager);
        
        // 绑定按钮事件
        this.btnPlay?.node.on(Button.EventType.CLICK, this.onPlayButtonClick, this);
    }

    onDestroy() {
        // 移除事件监听
        this.btnPlay?.node.off(Button.EventType.CLICK, this.onPlayButtonClick, this);
    }

    /**
     * 开始游戏按钮点击事件
     */
    private onPlayButtonClick(): void {
        console.log('[UIMainMenu] 点击开始游戏按钮');
        console.log('[UIMainMenu] UIManager实例状态:', this.uiManager ? '已初始化' : '未初始化');
        
        if (this.uiManager) {
            console.log('[UIMainMenu] 准备切换到选择拼图界面');
            this.uiManager.showSelectPuzzleOnly();
        } else {
            console.error('[UIMainMenu] UIManager未初始化，无法切换界面');
        }
    }

    /**
     * 界面显示时调用
     */
    public onShow(): void {
        if (this.isFirstShow) {
            this.isFirstShow = false;
            this.startLoadingPuzzleData();
        }
    }

    /**
     * 开始加载拼图数据
     */
    private startLoadingPuzzleData(): void {
        if (this.isLoading) return;
        
        this.isLoading = true;
        console.log('[UIMainMenu] 开始加载拼图数据');
        
        // 隐藏开始按钮，显示进度条
        if (this.btnPlay) {
            this.btnPlay.node.active = false;
        }
        if (this.LoadPuzzleBar) {
            this.LoadPuzzleBar.node.active = true;
            this.LoadPuzzleBar.progress = 0;
        }
        
        // 开始实际加载拼图数据
        this.loadPuzzleData();
    }

    /**
     * 加载拼图数据
     */
    private async loadPuzzleData(): Promise<void> {
        try {
            const gameData = GameDataPuzzle.instance;
            if (!gameData) {
                console.error('[UIMainMenu] GameDataPuzzle实例未初始化');
                this.onLoadingComplete();
                return;
            }

            // 更新进度条到10%
            if (this.LoadPuzzleBar) {
                this.LoadPuzzleBar.progress = 0.1;
            }

            // 初始化拼图数据
            await gameData.initializePuzzleData();
            
            // 更新进度条到50%
            if (this.LoadPuzzleBar) {
                this.LoadPuzzleBar.progress = 0.5;
            }

            // 加载动态图片资源
            await this.loadDynamicPuzzleImages();
            
            // 更新进度条到100%
            if (this.LoadPuzzleBar) {
                this.LoadPuzzleBar.progress = 1.0;
            }

            console.log('[UIMainMenu] 拼图数据加载完成');
            this.onLoadingComplete();
        } catch (error) {
            console.error('[UIMainMenu] 拼图数据加载失败:', error);
            this.onLoadingComplete();
        }
    }

    /**
     * 加载动态拼图图片
     */
    private async loadDynamicPuzzleImages(): Promise<void> {
        const gameDataInstance = GameDataPuzzle.instance;
        if (!gameDataInstance) return;

        const allGroupIds = gameDataInstance.getAllGroupIds();
        let loadedGroups = 0;
        const totalGroups = allGroupIds.length;

        console.log(`[UIMainMenu] 开始预加载 ${totalGroups} 个拼图组的图片`);

        for (const groupId of allGroupIds) {
            try {
                // 使用新的预加载方法，带进度回调
                await gameDataInstance.preloadGroupImages(groupId, (current, total) => {
                    // 计算当前组内的进度
                    const groupProgress = current / total;
                    // 计算总体进度 (50% + 50% * (已完成组数 + 当前组进度) / 总组数)
                    const totalProgress = 0.5 + (0.5 * (loadedGroups + groupProgress) / totalGroups);
                    
                    if (this.LoadPuzzleBar) {
                        this.LoadPuzzleBar.progress = Math.min(totalProgress, 1.0);
                    }
                    
                    console.log(`[UIMainMenu] 拼图组 ${groupId} 加载进度: ${current}/${total}, 总进度: ${Math.round(totalProgress * 100)}%`);
                });
                
                loadedGroups++;
                console.log(`[UIMainMenu] 拼图组 ${groupId} 预加载完成 (${loadedGroups}/${totalGroups})`);
            } catch (error) {
                console.error(`[UIMainMenu] 预加载拼图组 ${groupId} 失败:`, error);
                loadedGroups++; // 即使失败也要继续下一组
            }
            
            // 更新进度条到当前组完成状态
            if (this.LoadPuzzleBar) {
                this.LoadPuzzleBar.progress = 0.5 + (0.5 * loadedGroups / totalGroups);
            }
        }
        
        console.log('[UIMainMenu] 所有拼图组预加载完成');
    }

    /**
     * 加载完成
     */
    private onLoadingComplete(): void {
        console.log('[UIMainMenu] 拼图数据加载完成');
        
        this.isLoading = false;
        
        // 隐藏进度条，显示开始按钮
        if (this.LoadPuzzleBar) {
            this.LoadPuzzleBar.node.active = false;
        }
        if (this.btnPlay) {
            this.btnPlay.node.active = true;
        }
        
        // 这里可以添加实际的拼图数据加载逻辑
        // 例如：GameDataPuzzle.instance.loadPuzzleData();
    }

    update(deltaTime: number) {
        
    }
}