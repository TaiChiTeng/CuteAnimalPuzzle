import { _decorator, Component, Node, Button, Sprite, SpriteFrame, sys } from 'cc';
import { GameDataPuzzle } from './GameDataPuzzle';
import { UIManager } from './UIManager';
import { PuzzleResourceManager } from './PuzzleResourceManager';
const { ccclass, property } = _decorator;

@ccclass('UIFinishPuzzle')
export class UIFinishPuzzle extends Component {
    @property(Button)
    public btnBack: Button = null;

    @property(Button)
    public btnSave: Button = null;

    @property(Button)
    public btnShare: Button = null;

    @property(Sprite)
    public completedPuzzleImage: Sprite = null;

    // 拼图资源管理器将自动处理资源

    private uiManager: UIManager = null;
    private currentPuzzleId: number = 1;

    start() {
        this.uiManager = this.getComponent(UIManager) || this.node.parent?.getComponent(UIManager);
        
        // 初始时隐藏分享和保存按钮
        this.hideActionButtons();
        
        // 绑定按钮事件
        this.btnBack?.node.on(Button.EventType.CLICK, this.onBackButtonClick, this);
        this.btnSave?.node.on(Button.EventType.CLICK, this.onSaveButtonClick, this);
        this.btnShare?.node.on(Button.EventType.CLICK, this.onShareButtonClick, this);
    }

    onDestroy() {
        // 移除事件监听
        this.btnBack?.node.off(Button.EventType.CLICK, this.onBackButtonClick, this);
        this.btnSave?.node.off(Button.EventType.CLICK, this.onSaveButtonClick, this);
        this.btnShare?.node.off(Button.EventType.CLICK, this.onShareButtonClick, this);
    }

    /**
     * 返回按钮点击事件
     */
    private onBackButtonClick(): void {
        console.log('[UIFinishPuzzle] 点击返回选择拼图界面按钮');
        
        if (this.uiManager) {
            console.log('[UIFinishPuzzle] 准备切换到选择拼图界面');
            this.uiManager.showSelectPuzzleOnly();
        } else {
            console.error('[UIFinishPuzzle] UIManager未初始化，无法切换界面');
        }
    }

    /**
     * 保存图片按钮点击事件
     */
    private onSaveButtonClick(): void {
        console.log('[UIFinishPuzzle] 点击保存拼图图片按钮');
        console.log('[UIFinishPuzzle] 当前拼图ID:', this.currentPuzzleId);
        
        // 先向用户说明权限用途，然后申请权限并保存
        this.requestSavePermissionAndSave();
    }

    /**
     * 分享按钮点击事件
     */
    private onShareButtonClick(): void {
        console.log('[UIFinishPuzzle] 点击分享到微信好友按钮');
        console.log('[UIFinishPuzzle] 当前拼图ID:', this.currentPuzzleId);
        
        // 分享到微信好友（设计文档中提到已实现）
        this.shareToWechatFriends();
    }

    /**
     * 界面显示时调用
     */
    public onShow(): void {
        const gameData = GameDataPuzzle.instance;
        if (gameData) {
            this.currentPuzzleId = gameData.getSelectedPuzzleId();
            this.setupCompletedPuzzleImage();
        }
        
        // 如果首次加载时图片设置失败，延迟重试
        this.scheduleOnce(() => {
            this.retrySetupIfNeeded();
        }, 0.1);
    }

    /**
     * 设置完成的拼图图片
     */
    private setupCompletedPuzzleImage(): void {
        const sprite = this.completedPuzzleImage.getComponent(Sprite);
        const gameData = GameDataPuzzle.instance;
        
        if (sprite && gameData) {
            const spriteFrame = gameData.getPuzzleSpriteFrame(this.currentPuzzleId);
            
            if (spriteFrame) {
                sprite.spriteFrame = spriteFrame;
                // 设置完成拼图图片后，显示分享和保存按钮
                this.showActionButtons();
                console.log('[UIFinishPuzzle] 成功设置拼图图片并显示按钮');
            } else {
                console.warn('[UIFinishPuzzle] 无法获取拼图图片，puzzleId:', this.currentPuzzleId);
            }
        } else {
            console.warn('[UIFinishPuzzle] sprite或gameData为空');
        }
    }
    
    /**
     * 重试设置图片（用于处理首次加载时的时序问题）
     */
    private retrySetupIfNeeded(): void {
        // 检查按钮是否已经显示，如果没有则重试
        if (this.btnShare?.node && !this.btnShare.node.active) {
            console.log('[UIFinishPuzzle] 按钮未显示，重试设置图片');
            this.setupCompletedPuzzleImage();
            
            // 如果仍然失败，强制显示按钮
            if (this.btnShare?.node && !this.btnShare.node.active) {
                console.log('[UIFinishPuzzle] 重试后仍失败，强制显示按钮');
                this.showActionButtons();
            }
        }
    }

    /**
     * 根据拼图ID获取对应的图片索引
     */
    private getPuzzleIndexById(puzzleId: string): number {
        // 这里应该根据实际的拼图ID映射规则来实现
        // 暂时使用简单的映射逻辑
        const puzzleIds = [
            'puzzle_cat_01',
            'puzzle_dog_01', 
            'puzzle_rabbit_01',
            'puzzle_panda_01',
            'puzzle_fox_01',
            'puzzle_bear_01'
        ];
        
        return puzzleIds.indexOf(puzzleId);
    }

    /**
     * 显示操作按钮（分享和保存）
     */
    private showActionButtons(): void {
        if (this.btnShare?.node) {
            this.btnShare.node.active = true;
        }
        if (this.btnSave?.node) {
            this.btnSave.node.active = true;
        }
    }

    /**
     * 隐藏操作按钮（分享和保存）
     */
    private hideActionButtons(): void {
        if (this.btnShare?.node) {
            this.btnShare.node.active = false;
        }
        if (this.btnSave?.node) {
            this.btnSave.node.active = false;
        }
    }

    /**
     * 请求保存权限并保存图片
     */
    private requestSavePermissionAndSave(): void {
        // 检查是否在微信小游戏环境
        if (typeof wx === 'undefined') {
            console.log('当前不在微信小游戏环境，无法保存到相册');
            this.showMessage('当前环境不支持保存到相册');
            return;
        }

        // 首先向用户说明权限用途
        wx.showModal({
            title: '保存图片',
            content: '需要访问您的相册权限，用于保存完成的拼图图片到手机相册中，方便您随时查看和分享。',
            confirmText: '同意',
            cancelText: '取消',
            success: (modalRes) => {
                if (modalRes.confirm) {
                    // 用户同意，开始检查和申请权限
                    this.checkAndRequestAlbumPermission();
                } else {
                    // 用户取消，关闭弹窗（什么都不做）
                    console.log('用户取消保存图片');
                }
            }
        });
    }

    /**
     * 检查并申请相册权限
     */
    private checkAndRequestAlbumPermission(): void {
        wx.getSetting({
            success: (res) => {
                if (!res.authSetting['scope.writePhotosAlbum']) {
                    // 未授权，请求权限
                    wx.authorize({
                        scope: 'scope.writePhotosAlbum',
                        success: () => {
                            // 授权成功，开始保存图片
                            this.downloadAndSaveCurrentPuzzleImage();
                        },
                        fail: () => {
                            // 授权失败，引导用户去设置页面开启
                            wx.showModal({
                                title: '权限申请',
                                content: '保存图片需要相册权限，请在设置中开启相册权限',
                                confirmText: '去设置',
                                cancelText: '取消',
                                success: (modalRes) => {
                                    if (modalRes.confirm) {
                                        wx.openSetting({});
                                    }
                                }
                            });
                        }
                    });
                } else {
                    // 已授权，直接保存图片
                    this.downloadAndSaveCurrentPuzzleImage();
                }
            },
            fail: (error) => {
                console.error('获取设置失败:', error);
                this.showMessage('获取权限设置失败');
            }
        });
    }

    /**
     * 下载并保存当前拼图图片
     */
    private downloadAndSaveCurrentPuzzleImage(): void {
        try {
            const gameData = GameDataPuzzle.instance;
            if (!gameData) {
                this.showMessage('获取拼图数据失败');
                return;
            }

            const spriteFrame = gameData.getPuzzleSpriteFrame(this.currentPuzzleId);
            if (!spriteFrame || !spriteFrame.texture) {
                this.showMessage('获取拼图图片失败');
                return;
            }

            // 对于Cocos Creator的纹理，直接使用Canvas截图方案
            // 因为Cocos Creator的texture对象没有直接的image.src属性
            this.saveImageWithCanvas();
        } catch (error) {
            console.error('处理拼图图片失败:', error);
            this.showMessage('保存失败，请重试');
        }
    }



    /**
     * 使用Canvas截图保存本地图片
     */
    private saveImageWithCanvas(): void {
        try {
            // 创建一个临时Canvas来绘制拼图图片
            const canvas = wx.createCanvas();
            const ctx = canvas.getContext('2d', {}) as any;
            
            const gameData = GameDataPuzzle.instance;
            const spriteFrame = gameData.getPuzzleSpriteFrame(this.currentPuzzleId);
            
            if (!spriteFrame || !spriteFrame.texture) {
                this.showMessage('获取拼图图片失败');
                return;
            }

            const texture = spriteFrame.texture;
            canvas.width = texture.width;
            canvas.height = texture.height;

            // 由于Cocos Creator的纹理系统与微信小游戏Canvas不兼容
            // 这里改用一个简化的方案：直接提示用户或使用其他方式
            console.warn('Cocos Creator纹理无法直接绘制到微信Canvas');
            this.showMessage('当前版本暂不支持本地图片保存，请联系开发者');
            
            // 备选方案：如果有网络图片URL，可以尝试下载
            // 这里可以根据实际需求添加获取网络图片URL的逻辑
        } catch (error) {
            console.error('Canvas截图过程中发生错误:', error);
            this.showMessage('保存失败，请重试');
        }
    }

    /**
     * 保存图片到相册
     */
    private saveToPhotosAlbum(filePath: string): void {
        wx.saveImageToPhotosAlbum({
            filePath: filePath,
            success: () => {
                console.log('图片保存到相册成功');
                this.showMessage('图片已保存到相册');
            },
            fail: (error) => {
                console.error('保存到相册失败:', error);
                if (error.errMsg && error.errMsg.includes('auth deny')) {
                    this.showMessage('请授权访问相册后重试');
                } else if (error.errMsg && error.errMsg.includes('invalid file type')) {
                    this.showMessage('图片格式不支持，保存失败');
                } else {
                    this.showMessage('保存失败，请重试');
                }
            }
        });
    }



    /**
     * 分享到微信好友
     */
    private shareToWechatFriends(): void {
        // 检查是否在微信小游戏环境
        if (typeof wx !== 'undefined') {
            wx.shareAppMessage({
                title: '我完成了一个可爱动物拼图！',
                imageUrl: '' // 这里可以设置分享图片
            });
            console.log('已触发分享');
            this.showMessage('分享面板已打开');
        } else {
            console.log('当前不在微信小游戏环境，无法分享');
            this.showMessage('当前环境不支持分享功能');
        }
    }

    /**
     * 显示提示信息
     */
    private showMessage(message: string): void {
        // 这里可以实现一个简单的提示框
        // 或者使用现有的UI提示组件
        console.log('提示信息:', message);
        
        // 如果在微信环境，可以使用微信的提示API
        if (typeof wx !== 'undefined') {
            wx.showToast({
                title: message,
                icon: 'none',
                duration: 1500
            });
        }
    }

    update(deltaTime: number) {
        
    }
}