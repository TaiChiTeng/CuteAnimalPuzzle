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
            console.log('[UIMainMenu] 准备切换到拼图组选择界面');
            this.uiManager.showSelectPuzzleGroupOnly();
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
                console.error('[UIMainMenu] GameDataPuzzle实例不存在');
                this.onLoadingComplete();
                return;
            }

            // 更新进度条到50%（仅初始化基础数据，不下载图片）
            if (this.LoadPuzzleBar) {
                this.LoadPuzzleBar.progress = 0.5;
            }

            console.log('[UIMainMenu] 基础拼图数据初始化完成，图片将在选择拼图组时下载');
            
            // 更新进度条到100%
            if (this.LoadPuzzleBar) {
                this.LoadPuzzleBar.progress = 1.0;
            }

            console.log('[UIMainMenu] 拼图数据加载完成');
            
            // 延迟一下让用户看到进度条完成
            setTimeout(() => {
                this.onLoadingComplete();
            }, 500);
        } catch (error) {
            console.error('[UIMainMenu] 加载拼图数据失败:', error);
            this.onLoadingComplete();
        }
    }

    /**
     * @deprecated 此方法已废弃，图片下载逻辑已移至UISelectDifAndPuzzle界面
     * 加载动态拼图图片
     */
    private async loadDynamicPuzzleImages(): Promise<void> {
        // 此方法已废弃，不再在主菜单界面下载所有拼图图片
        // 图片下载逻辑已移至UISelectDifAndPuzzle界面，按需下载指定拼图组的图片
        console.log('[UIMainMenu] loadDynamicPuzzleImages方法已废弃，图片将在选择拼图组时按需下载');
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