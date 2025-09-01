import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {
    
    @property(Node)
    public UIMainMenu: Node = null;

    @property(Node)
    public UISelectPuzzle: Node = null;
    @property(Node)
    public UISolvePuzzle: Node = null;
    start() {

    }

    update(deltaTime: number) {
        
    }

    // 显示主菜单，隐藏其他界面
    public showMainMenuOnly(): void {
        this.UIMainMenu.active = true;
        this.UISelectPuzzle.active = false;
        this.UISolvePuzzle.active = false;
        // 播放主菜单动画
        // if (this.animMainMenu) {
            // this.animMainMenu.play('AnimShowMainMenu');
        // }
    }

    // 显示选择拼图和难度界面，隐藏其他界面
    public showSelectPuzzleOnly(): void {
        this.UISelectPuzzle.active = true;
        this.UIMainMenu.active = false;
        this.UISolvePuzzle.active = false;
        // 播放主菜单动画
        // if (this.animMainMenu) {
            // this.animMainMenu.play('AnimShowMainMenu');
        // }
    }
    // 显示解决拼图界面，隐藏其他界面
    public showSolvePuzzleOnly(): void {
        this.UISolvePuzzle.active = true;
        this.UIMainMenu.active = false;
        this.UISelectPuzzle.active = false;
    }

}


