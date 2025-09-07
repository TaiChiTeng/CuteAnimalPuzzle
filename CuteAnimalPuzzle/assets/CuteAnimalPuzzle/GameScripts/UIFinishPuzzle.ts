import { _decorator, Component, Node, Button, Sprite, SpriteFrame, sys } from 'cc';
import { GameDataPuzzle } from './GameDataPuzzle';
import { UIManager } from './UIManager';
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
    private spriteFrameFilePath: string = null;

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
        
        // 分享到微信好友
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
                this.spriteFrameFilePath = this.getCurrentPuzzleImagePath();
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
     * 获取当前拼图图片的文件路径
     * @returns {string} 返回当前拼图SpriteFrame的资源路径
     */
    public getCurrentPuzzleImagePath(): string {
        try {
            const gameData = GameDataPuzzle.instance;
            if (!gameData) {
                console.error('[UIFinishPuzzle] GameDataPuzzle实例不存在');
                return '';
            }

            const spriteFrame = gameData.getPuzzleSpriteFrame(this.currentPuzzleId);
            if (!spriteFrame) {
                console.error('[UIFinishPuzzle] 无法获取拼图SpriteFrame，puzzleId:', this.currentPuzzleId);
                return '';
            }

            // 获取SpriteFrame的资源路径
            const texture = spriteFrame.texture;
            if (texture && texture.nativeUrl) {
                console.log('[UIFinishPuzzle] 获取到拼图图片路径:', texture.nativeUrl);
                return texture.nativeUrl;
            } else if (texture && texture._nativeAsset) {
                // 尝试获取原生资源路径
                const nativeUrl = texture._nativeAsset.nativeUrl || texture._nativeAsset.url;
                if (nativeUrl) {
                    console.log('[UIFinishPuzzle] 获取到拼图图片原生路径:', nativeUrl);
                    return nativeUrl;
                }
            }

            // 如果无法获取直接路径，返回资源UUID
            if (spriteFrame._uuid) {
                console.log('[UIFinishPuzzle] 返回拼图图片UUID:', spriteFrame._uuid);
                return spriteFrame._uuid;
            }

            console.warn('[UIFinishPuzzle] 无法获取拼图图片路径');
            return '';
        } catch (error) {
            console.error('[UIFinishPuzzle] 获取拼图图片路径时发生错误:', error);
            return '';
        }
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
                            // 授权成功，开始保存图片到用户手机系统相册
                            this.saveToPhotosAlbum(this.spriteFrameFilePath);
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
                    // 已授权，直接保存图片到用户手机系统相册
                    this.saveToPhotosAlbum(this.spriteFrameFilePath);
                }
            },
            fail: (error) => {
                console.error('获取设置失败:', error);
                this.showMessage('获取权限设置失败');
            }
        });
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
            // this.showMessage('分享面板已打开');
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