import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

@ccclass('wxManager')
export class wxManager extends Component {
    
    // 分享配置（可选：可改为从服务器动态获取）
    private shareConfig = {
        title: "快来一起玩吧！",    // 分享标题
        imageUrl: "",                         // 分享图 URL（留空使用游戏截图）
        query: "inviter=cocoPark" // 默认邀请码
    }


    onLoad() {
        if (typeof wx !== 'undefined') {
            wx.showShareMenu({
                withShareTicket: true, // 如需获取群聊标识需开启
                menus: ['shareAppMessage', 'shareTimeline'] // 同时启用wx好友和朋友圈分享
            });
        }

        // 监听分享失败事件
        wx.onShareAppMessage(() => this.handleShareFailure());
    }

    // 按钮点击触发的分享方法
    public onShareButtonClick() {
        if (typeof wx === 'undefined') return;

        // 触发分享
        wx.shareAppMessage({
            title: this.shareConfig.title,
            imageUrl: this.shareConfig.imageUrl,
            query: this.shareConfig.query,
            success: () => {
                console.log("分享成功");
                // 这里可以添加分享成功后的游戏逻辑（如发放奖励）
            },
            fail: (err) => {
                console.error("分享失败:", err);
                // 处理分享失败情况
            }
        });
    }

    // 处理用户点击右上角分享的情况
    private handleShareFailure() {
        return {
            title: this.shareConfig.title,
            imageUrl: this.shareConfig.imageUrl,
            query: this.shareConfig.query
        };
    }
}