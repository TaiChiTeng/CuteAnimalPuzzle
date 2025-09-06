import { _decorator, Component, Node, Button } from 'cc';
import { GameDataPuzzle } from './GameDataPuzzle';
import { UIManager } from './UIManager';
import { PuzzleAudio } from './PuzzleAudio';
const { ccclass, property } = _decorator;

@ccclass('UIMainMenu')
export class UIMainMenu extends Component {
    @property(Button)
    public btnPlay: Button = null;

    @property(Button)
    public btnAudio: Button = null;

    private uiManager: UIManager = null;
    private puzzleAudio: PuzzleAudio = null;

    start() {
        this.uiManager = this.getComponent(UIManager) || this.node.parent?.getComponent(UIManager);
        this.puzzleAudio = this.getComponent(PuzzleAudio) || this.node.parent?.getComponent(PuzzleAudio);
        
        // 绑定按钮事件
        this.btnPlay?.node.on(Button.EventType.CLICK, this.onPlayButtonClick, this);
        this.btnAudio?.node.on(Button.EventType.CLICK, this.onAudioButtonClick, this);
    }

    onDestroy() {
        // 移除事件监听
        this.btnPlay?.node.off(Button.EventType.CLICK, this.onPlayButtonClick, this);
        this.btnAudio?.node.off(Button.EventType.CLICK, this.onAudioButtonClick, this);
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
     * 音频按钮点击事件
     */
    private onAudioButtonClick(): void {
        console.log('[UIMainMenu] 点击音频按钮');
        if (this.puzzleAudio) {
            this.puzzleAudio.onClickAudio();
        } else {
            console.error('[UIMainMenu] PuzzleAudio组件未找到');
        }
    }

    /**
     * 界面显示时调用
     */
    public onShow(): void {
        // 更新音频按钮状态
        if (this.puzzleAudio) {
            this.puzzleAudio.updateAudioButtonState();
        }
    }

    update(deltaTime: number) {
        
    }
}