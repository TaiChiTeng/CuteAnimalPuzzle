import { _decorator, Component, Prefab, Node, Button } from 'cc';
import { UIMainMenu } from './UIMainMenu';
import { UISelectPuzzle } from './UISelectPuzzle';
import { UISolvePuzzle } from './UISolvePuzzle';
import { UIFinishPuzzle } from './UIFinishPuzzle';
import { GameDataPuzzle } from './GameDataPuzzle';
const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {
    
    // 主菜单界面
    // UIMainMenu/btnPlay：点击打开选择拼图和难度界面
    @property(Node)
    public UIMainMenu: Node = null;
    
    private uiMainMenu: UIMainMenu = null;

    // 拼图预制体
    // itemSelectPuzzle/sprPuzzle：拼图图片
    @property(Prefab)
    public itemSelectPuzzle: Prefab = null; 

    // 选择拼图和难度界面
    // UISelectPuzzle/btnBack：点击返回主菜单界面
    // UISelectPuzzle/ToggleGroup/Toggle1：点击标记为9张拼图难度
    // UISelectPuzzle/ToggleGroup/Toggle2：点击标记为16张拼图难度
    // UISelectPuzzle/ToggleGroup/Toggle3：点击标记为25张拼图难度
    // UISelectPuzzle/ScrollView/view/content/itemSelectPuzzleX~itemSelectPuzzleY：点击根据拼图和难度，打开解决拼图界面
    @property(Node)
    public UISelectPuzzle: Node = null;
    
    private uiSelectPuzzle: UISelectPuzzle = null;

    // 解决拼图界面
    // UISolvePuzzle/btnBack：点击返回选择拼图和难度界面
    @property(Node)
    public UISolvePuzzle: Node = null;
    
    private uiSolvePuzzle: UISolvePuzzle = null;

    @property(Node)
    public UIFinishPuzzle: Node = null;
    
    private uiFinishPuzzle: UIFinishPuzzle = null;

    // 声音控制按钮和图标 - 在各个界面中统一管理
    @property(Button)
    public btnSoundMainMenu: Button = null;

    @property(Node)
    public soundOnIconMainMenu: Node = null;

    @property(Node)
    public soundOffIconMainMenu: Node = null;

    @property(Button)
    public btnSoundSelectPuzzle: Button = null;

    @property(Node)
    public soundOnIconSelectPuzzle: Node = null;

    @property(Node)
    public soundOffIconSelectPuzzle: Node = null;

    @property(Button)
    public btnSoundSolvePuzzle: Button = null;

    @property(Node)
    public soundOnIconSolvePuzzle: Node = null;

    @property(Node)
    public soundOffIconSolvePuzzle: Node = null;

    start() {
        // 获取UI组件引用
        this.uiMainMenu = this.UIMainMenu?.getComponent(UIMainMenu);
        this.uiSelectPuzzle = this.UISelectPuzzle?.getComponent(UISelectPuzzle);
        this.uiSolvePuzzle = this.UISolvePuzzle?.getComponent(UISolvePuzzle);
        this.uiFinishPuzzle = this.UIFinishPuzzle?.getComponent(UIFinishPuzzle);
        
        // 绑定声音按钮事件
        this.initializeSoundButtons();
        
        // 初始化界面
        this.showMainMenuOnly();
    }

    update(deltaTime: number) {
        
    }

    // 显示主菜单，隐藏其他界面
    public showMainMenuOnly(): void {
        this.UIMainMenu.active = true;
        this.UISelectPuzzle.active = false;
        this.UISolvePuzzle.active = false;
        this.UIFinishPuzzle.active = false;
        
        // 调用界面显示回调
        if (this.uiMainMenu) {
            this.uiMainMenu.onShow();
        }
        
        // 更新声音按钮状态
        this.updateAllSoundButtonStates();
    }

    // 显示选择拼图和难度界面，隐藏其他界面
    public showSelectPuzzleOnly(): void {
        this.UISelectPuzzle.active = true;
        this.UIMainMenu.active = false;
        this.UISolvePuzzle.active = false;
        this.UIFinishPuzzle.active = false;
        
        // 调用界面显示回调
        if (this.uiSelectPuzzle) {
            this.uiSelectPuzzle.onShow();
        }
        
        // 更新声音按钮状态
        this.updateAllSoundButtonStates();
    }
    // 显示解决拼图界面，隐藏其他界面
    public showSolvePuzzleOnly(): void {
        this.UISolvePuzzle.active = true;
        this.UIMainMenu.active = false;
        this.UISelectPuzzle.active = false;
        this.UIFinishPuzzle.active = false;
        
        // 调用界面显示回调
        if (this.uiSolvePuzzle) {
            this.uiSolvePuzzle.onShow();
        }
        
        // 更新声音按钮状态
        this.updateAllSoundButtonStates();
    }

    // 显示完成拼图界面，隐藏其他界面
    public showFinishPuzzleOnly(): void {
        this.UIFinishPuzzle.active = true;
        this.UISolvePuzzle.active = false;
        this.UIMainMenu.active = false;
        this.UISelectPuzzle.active = false;
        
        // 调用界面显示回调
        if (this.uiFinishPuzzle) {
            this.uiFinishPuzzle.onShow();
        }
        
        // 更新声音按钮状态
        this.updateAllSoundButtonStates();
    }

    /**
     * 初始化所有界面的声音按钮事件
     */
    private initializeSoundButtons(): void {
        // 主菜单声音按钮
        this.btnSoundMainMenu?.node.on(Button.EventType.CLICK, this.onSoundButtonClick, this);
        
        // 选择拼图界面声音按钮
        this.btnSoundSelectPuzzle?.node.on(Button.EventType.CLICK, this.onSoundButtonClick, this);
        
        // 解决拼图界面声音按钮
        this.btnSoundSolvePuzzle?.node.on(Button.EventType.CLICK, this.onSoundButtonClick, this);
    }

    /**
     * 声音开关按钮点击事件 - 统一处理所有界面的声音按钮
     */
    private onSoundButtonClick(): void {
        console.log('[UIManager] 点击声音开关按钮');
        
        const gameData = GameDataPuzzle.instance;
        if (gameData) {
            const currentSoundState = gameData.getSoundEnabled();
            console.log('[UIManager] 当前声音状态:', currentSoundState);
            gameData.setSoundEnabled(!currentSoundState);
            this.updateAllSoundButtonStates();
            console.log('[UIManager] 声音开关状态已更改为:', !currentSoundState);
        } else {
            console.error('[UIManager] GameDataPuzzle实例未找到');
        }
    }

    /**
     * 更新所有界面的声音按钮状态显示
     */
    private updateAllSoundButtonStates(): void {
        const gameData = GameDataPuzzle.instance;
        if (!gameData) return;
        
        const soundEnabled = gameData.getSoundEnabled();
        
        // 更新主菜单声音按钮状态
        this.updateSoundButtonState(this.soundOnIconMainMenu, this.soundOffIconMainMenu, soundEnabled);
        
        // 更新选择拼图界面声音按钮状态
        this.updateSoundButtonState(this.soundOnIconSelectPuzzle, this.soundOffIconSelectPuzzle, soundEnabled);
        
        // 更新解决拼图界面声音按钮状态
        this.updateSoundButtonState(this.soundOnIconSolvePuzzle, this.soundOffIconSolvePuzzle, soundEnabled);
    }

    /**
     * 更新单个界面的声音按钮状态
     */
    private updateSoundButtonState(soundOnIcon: Node, soundOffIcon: Node, soundEnabled: boolean): void {
        if (soundOnIcon) {
            soundOnIcon.active = soundEnabled;
        }
        
        if (soundOffIcon) {
            soundOffIcon.active = !soundEnabled;
        }
    }

    /**
     * 获取声音开关状态 - 供其他组件调用
     */
    public getSoundEnabled(): boolean {
        const gameData = GameDataPuzzle.instance;
        return gameData ? gameData.getSoundEnabled() : true;
    }

    /**
     * 设置声音开关状态 - 供其他组件调用
     */
    public setSoundEnabled(enabled: boolean): void {
        const gameData = GameDataPuzzle.instance;
        if (gameData) {
            gameData.setSoundEnabled(enabled);
            this.updateAllSoundButtonStates();
        }
    }

}


