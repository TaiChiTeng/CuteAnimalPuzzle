import { _decorator, Component, Node, Button } from 'cc';
import { GameDataPuzzle } from './GameDataPuzzle';
import { UIManager } from './UIManager';
const { ccclass, property } = _decorator;

@ccclass('UIMainMenu')
export class UIMainMenu extends Component {
    @property(Button)
    public btnPlay: Button = null;

    private uiManager: UIManager = null;

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

    }

    update(deltaTime: number) {
        
    }
}