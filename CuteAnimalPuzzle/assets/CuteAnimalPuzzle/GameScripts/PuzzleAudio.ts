import { _decorator, Component, Node, AudioClip } from 'cc';
import { AudioMgr } from './AudioMgr';
import { GameDataPuzzle } from './GameDataPuzzle';
const { ccclass, property } = _decorator;

/**
 * 拼图音频管理器
 * 1. 播放背景音乐
 * 2. 播放音效
 * 3. 根据游戏状态控制音频
 * 4. 切换音效开关
 */
@ccclass('PuzzleAudio')
export class PuzzleAudio extends Component {
    
    // 背景音乐配置
    @property([AudioClip])
    public backgroundMusics: AudioClip[] = [];
    
    // 音效配置
    @property(AudioClip)
    public buttonClickSound: AudioClip = null;
    
    @property(AudioClip)
    public puzzlePlaceCorrectSound: AudioClip = null;
    
    @property(AudioClip)
    public puzzleCompleteSound: AudioClip = null;
    
    // 单例实例
    private static _instance: PuzzleAudio = null;
    
    // 当前播放的背景音乐索引
    private currentBgMusicIndex: number = 0;
    
    // 音频管理器
    private audioMgr: AudioMgr = null;
    
    // 是否启用循环播放
    private isLoopEnabled: boolean = true;
    
    // 上一帧的播放状态
    private wasPlaying: boolean = false;
    
    private musicCDTime: number = 1.0;

    public static get instance(): PuzzleAudio {
        return PuzzleAudio._instance;
    }
    
    start() {
        // 设置单例
        PuzzleAudio._instance = this;
        
        // 获取音频管理器实例
        this.audioMgr = AudioMgr.inst;
        
        // 开始播放背景音乐
        this.playBackgroundMusic();
        
        console.log('[PuzzleAudio] 音频管理器初始化完成');
    }
    
    /**
     * 播放背景音乐
     */
    public playBackgroundMusic(): void {
        if (!this.isSoundEnabled()) {
            console.log('[PuzzleAudio] 音效已关闭，不播放背景音乐');
            return;
        }
        
        if (this.backgroundMusics.length === 0) {
            console.warn('[PuzzleAudio] 没有配置背景音乐');
            return;
        }
        
        const bgMusic = this.backgroundMusics[this.currentBgMusicIndex];
        if (bgMusic) {
            this.audioMgr.play(bgMusic, 0.5); // 背景音乐音量设为0.5
            this.wasPlaying = true; // 标记为正在播放
            console.log('[PuzzleAudio] 播放背景音乐:', this.currentBgMusicIndex, '/', this.backgroundMusics.length);
        }
    }
    
    /**
     * 停止背景音乐
     */
    public stopBackgroundMusic(): void {
        this.audioMgr.stop();
        this.wasPlaying = false;
        console.log('[PuzzleAudio] 停止背景音乐');
    }
    
    /**
     * 切换到下一首背景音乐
     */
    public switchToNextBackgroundMusic(): void {
        if (this.backgroundMusics.length <= 1) {
            return;
        }
        
        this.currentBgMusicIndex = (this.currentBgMusicIndex + 1) % this.backgroundMusics.length;
        this.playBackgroundMusic();
        console.log('[PuzzleAudio] 手动切换到背景音乐:', this.currentBgMusicIndex);
    }
    
    /**
     * 自动切换到下一首背景音乐（循环播放）
     */
    private autoSwitchToNextBackgroundMusic(): void {
        if (!this.isLoopEnabled || this.backgroundMusics.length <= 1) {
            return;
        }
        
        this.currentBgMusicIndex = (this.currentBgMusicIndex + 1) % this.backgroundMusics.length;
        this.playBackgroundMusic();
        console.log('[PuzzleAudio] 自动循环切换到背景音乐:', this.currentBgMusicIndex);
    }
    
    /**
     * 设置是否启用循环播放
     */
    public setLoopEnabled(enabled: boolean): void {
        this.isLoopEnabled = enabled;
        console.log('[PuzzleAudio] 循环播放设置:', enabled);
    }
    
    /**
     * 获取循环播放状态
     */
    public getLoopEnabled(): boolean {
        return this.isLoopEnabled;
    }
    
    /**
     * 播放按钮点击音效
     */
    public playButtonClickSound(): void {
        if (!this.isSoundEnabled()) {
            return;
        }
        
        if (this.buttonClickSound) {
            this.audioMgr.playOneShot(this.buttonClickSound, 0.8);
            console.log('[PuzzleAudio] 播放按钮点击音效');
        }
    }
    
    /**
     * 播放拼图放入正确位置音效
     */
    public playPuzzlePlaceCorrectSound(): void {
        if (!this.isSoundEnabled()) {
            return;
        }
        
        if (this.puzzlePlaceCorrectSound) {
            this.audioMgr.playOneShot(this.puzzlePlaceCorrectSound, 1.0);
            console.log('[PuzzleAudio] 播放拼图放入正确位置音效');
        }
    }
    
    /**
     * 播放拼图完成音效
     */
    public playPuzzleCompleteSound(): void {
        if (!this.isSoundEnabled()) {
            return;
        }
        
        if (this.puzzleCompleteSound) {
            this.audioMgr.playOneShot(this.puzzleCompleteSound, 1.0);
            console.log('[PuzzleAudio] 播放拼图完成音效');
        }
    }
    
    /**
     * 设置背景音乐音量
     */
    public setBackgroundMusicVolume(volume: number): void {
        this.audioMgr.setVolume(volume);
    }
    
    /**
     * 暂停背景音乐
     */
    public pauseBackgroundMusic(): void {
        this.audioMgr.pause();
        this.wasPlaying = false;
        console.log('[PuzzleAudio] 暂停背景音乐');
    }
    
    /**
     * 恢复背景音乐
     */
    public resumeBackgroundMusic(): void {
        if (this.isSoundEnabled()) {
            this.audioMgr.resume();
            this.wasPlaying = true;
            console.log('[PuzzleAudio] 恢复背景音乐');
        }
    }
    
    /**
     * 处理音效开关状态变化
     */
    public onSoundStateChanged(enabled: boolean): void {
        if (enabled) {
            // 音效开启，播放背景音乐
            this.playBackgroundMusic();
        } else {
            // 音效关闭，停止背景音乐
            this.stopBackgroundMusic();
        }
        console.log('[PuzzleAudio] 音效状态变化:', enabled);
    }
    
    /**
     * 检查当前音效是否开启
     */
    private isSoundEnabled(): boolean {
        const gameData = GameDataPuzzle.instance;
        return gameData ? gameData.getSoundEnabled() : true;
    }
    
    update(deltaTime: number) {
        // 检查背景音乐循环播放
        this.checkBackgroundMusicLoop();
    }
    
    /**
     * 检查背景音乐循环播放
     */
    private checkBackgroundMusicLoop(): void {
        if (!this.isLoopEnabled || !this.isSoundEnabled() || this.backgroundMusics.length <= 1) {
            return;
        }
        
        const audioSource = this.audioMgr.audioSource;
        if (!audioSource) {
            return;
        }
        
        const isCurrentlyPlaying = audioSource.playing;
        
        // 如果上一帧在播放，但这一帧不在播放了，说明音乐播放结束
        if (this.wasPlaying && !isCurrentlyPlaying) {
            console.log('[PuzzleAudio] 检测到背景音乐播放结束，准备切换下一首');
            // 延迟1秒后切换，避免频繁切换
            this.scheduleOnce(() => {
                // 再次确认确实停止了播放
                if (!audioSource.playing && this.isSoundEnabled()) {
                    this.autoSwitchToNextBackgroundMusic();
                }
            }, this.musicCDTime);
        }
        
        this.wasPlaying = isCurrentlyPlaying;
    }
    
    onDestroy() {
        // 清理单例引用
        if (PuzzleAudio._instance === this) {
            PuzzleAudio._instance = null;
        }
    }
}


