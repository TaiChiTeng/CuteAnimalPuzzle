import { _decorator, Component, Node, Button } from 'cc';
import { GameDataPuzzle } from './GameDataPuzzle';
import { UIManager } from './UIManager';
const { ccclass, property } = _decorator;

@ccclass('UIMainMenu')
export class UIMainMenu extends Component {
    @property(Button)
    public btnPlay: Button = null;

    @property(Button)
    public btnSound: Button = null;

    @property(Node)
    public soundOnIcon: Node = null;

    @property(Node)
    public soundOffIcon: Node = null;

    private uiManager: UIManager = null;

    start() {
        this.uiManager = this.getComponent(UIManager) || this.node.parent?.getComponent(UIManager);
        
        // 绑定按钮事件
        this.btnPlay?.node.on(Button.EventType.CLICK, this.onPlayButtonClick, this);
        this.btnSound?.node.on(Button.EventType.CLICK, this.onSoundButtonClick, this);
        
        // 初始化声音按钮状态
        this.updateSoundButtonState();
    }

    onDestroy() {
        // 移除事件监听
        this.btnPlay?.node.off(Button.EventType.CLICK, this.onPlayButtonClick, this);
        this.btnSound?.node.off(Button.EventType.CLICK, this.onSoundButtonClick, this);
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
     * 声音开关按钮点击事件
     */
    private onSoundButtonClick(): void {
        console.log('[UIMainMenu] 点击声音开关按钮');
        
        const gameData = GameDataPuzzle.instance;
        if (gameData) {
            const currentSoundState = gameData.getSoundEnabled();
            console.log('[UIMainMenu] 当前声音状态:', currentSoundState);
            gameData.setSoundEnabled(!currentSoundState);
            this.updateSoundButtonState();
            console.log('[UIMainMenu] 声音开关状态已更改为:', !currentSoundState);
        } else {
            console.error('[UIMainMenu] GameDataPuzzle实例未找到');
        }
    }

    /**
     * 更新声音按钮状态显示
     */
    private updateSoundButtonState(): void {
        const gameData = GameDataPuzzle.instance;
        if (gameData) {
            const soundEnabled = gameData.getSoundEnabled();
            
            if (this.soundOnIcon) {
                this.soundOnIcon.active = soundEnabled;
            }
            
            if (this.soundOffIcon) {
                this.soundOffIcon.active = !soundEnabled;
            }
        }
    }

    /**
     * 界面显示时调用
     */
    public onShow(): void {
        this.updateSoundButtonState();
    }

    update(deltaTime: number) {
        
    }
}