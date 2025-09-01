import { _decorator, AssetManager, assetManager, Component, director, ProgressBar, sys } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Loading')
export class Loading extends Component {

    @property(ProgressBar)
    loadingProgress : ProgressBar = null;

    @property
    loadTime: number = 1.0;

    start() {
        this.loadingProgress.progress = 0.0;
        assetManager.loadBundle("CuteAnimalPuzzle", (err, bundle : AssetManager.Bundle) => {
            this.loadingProgress.progress = 1.0;
            bundle.loadScene("PuzzleGame", (err, scene) => {
                director.runScene(scene);
            });
        });
        if (sys.platform == "WECHAT_GAME") {
            wx.showShareMenu({menus: ['shareAppMessage', 'shareTimeline']});
            wx.onShareAppMessage(function () {
                return {
                    title: "一起玩吧！"
                };
            });
            wx.onShareTimeline(function () {
                return {
                    title: "一起玩吧！"
                };
            });
        }
    }

    update(deltaTime: number) {
        this.loadingProgress.progress = Math.min(1, this.loadingProgress.progress + deltaTime / this.loadTime);
    }
}


