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
        
        // 在微信小游戏环境中保存图片到相册
        this.savePuzzleImageToAlbum();
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
     * 保存拼图图片到手机相册
     */
    private savePuzzleImageToAlbum(): void {
        // 检查是否在微信小游戏环境
        if (typeof wx !== 'undefined') {
            this.saveImageInWechat();
        } else {
            console.log('当前不在微信小游戏环境，无法保存到相册');
            this.showMessage('当前环境不支持保存到相册');
        }
    }

    /**
     * 在微信环境中保存图片
     */
    private saveImageInWechat(): void {
        try {
            // 首先需要将Canvas内容转换为临时文件
            const canvas = document.querySelector('canvas');
            if (!canvas) {
                console.error('找不到Canvas元素');
                this.showMessage('保存失败：找不到画布');
                return;
            }

            // 将Canvas转换为DataURL
            const dataURL = canvas.toDataURL('image/png');
            
            // 将DataURL转换为ArrayBuffer
            const base64Data = dataURL.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // 写入临时文件
            const fs = wx.getFileSystemManager();
            const tempFilePath = wx.env.USER_DATA_PATH + '/puzzle_' + Date.now() + '.png';
            
            fs.writeFile({
                filePath: tempFilePath,
                data: bytes.buffer,
                encoding: 'binary',
                success: () => {
                    // 保存到相册
                    wx.saveImageToPhotosAlbum({
                        filePath: tempFilePath,
                        success: () => {
                            console.log('图片保存到相册成功');
                            this.showMessage('图片已保存到相册');
                        },
                        fail: (error) => {
                            console.error('保存到相册失败:', error);
                            if (error.errMsg.includes('auth deny')) {
                                this.showMessage('请授权访问相册后重试');
                            } else {
                                this.showMessage('保存失败，请重试');
                            }
                        }
                    });
                },
                fail: (error) => {
                    console.error('写入临时文件失败:', error);
                    this.showMessage('保存失败，请重试');
                }
            });
        } catch (error) {
            console.error('保存图片过程中发生错误:', error);
            this.showMessage('保存失败，请重试');
        }
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