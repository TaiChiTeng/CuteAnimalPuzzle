import { _decorator, Component, Prefab, Node } from 'cc';
import { UIMainMenu } from './UIMainMenu';
import { UISelectPuzzle } from './UISelectPuzzle';
import { UISolvePuzzle } from './UISolvePuzzle';
import { UIFinishPuzzle } from './UIFinishPuzzle';
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

    start() {
        // 获取UI组件引用
        this.uiMainMenu = this.UIMainMenu?.getComponent(UIMainMenu);
        this.uiSelectPuzzle = this.UISelectPuzzle?.getComponent(UISelectPuzzle);
        this.uiSolvePuzzle = this.UISolvePuzzle?.getComponent(UISolvePuzzle);
        this.uiFinishPuzzle = this.UIFinishPuzzle?.getComponent(UIFinishPuzzle);
        
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
    }  

}


