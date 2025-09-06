import { _decorator, AudioClip, AudioSource, Component, Button, Sprite, sys } from 'cc';

import { AudioMgr } from './AudioMgr';
import { GameDataPuzzle } from './GameDataPuzzle';
const { ccclass, property } = _decorator;

@ccclass("PuzzleSound")
export class PuzzleSound {
    @property(AudioClip)
    clip : AudioClip = null;
}

@ccclass("PuzzleMusic")
export class PuzzleMusic {
    @property(AudioClip)
    clip : AudioClip = null;
}


@ccclass('PuzzleAudio')
export class PuzzleAudio extends Component {

    private static _instance: PuzzleAudio = null;

    @property([PuzzleMusic])
    bgMusics : PuzzleMusic[] = [];

    @property([PuzzleSound])
    PuzzleSounds : PuzzleSound[] = [];

    @property(Button)
    public btnAudio: Button = null;

    audioConfig = {isAudioOn: true}

    currMusic: PuzzleMusic = null;
    currSound: PuzzleSound = null;

    musicAudioSource: AudioSource = null;

    public static getInstance(): PuzzleAudio {
        return PuzzleAudio._instance;
    }

    resumeMusic(force: boolean) {
        if (!this.audioConfig.isAudioOn) {
            return;
        }
        if (force) {
            let time = this.musicAudioSource.currentTime;
            this.musicAudioSource.play();
            this.musicAudioSource.currentTime = time;
        }
        else if (!this.musicAudioSource.playing) {
            this.musicAudioSource.play();
        }
    }

    loopMusic() {
        console.log("[PuzzleAudio] loopMusic 开始播放背景音乐");
        console.log("[PuzzleAudio] 音频开关状态:", this.audioConfig.isAudioOn);
        console.log("[PuzzleAudio] bgMusics数组长度:", this.bgMusics.length);
        
        if (this.bgMusics.length === 0) {
            console.log("[PuzzleAudio] 错误：bgMusics数组为空，无法播放背景音乐");
            return;
        }
        
        // let music = this.bgMusics[Math.floor(Math.random() * this.bgMusics.length)];
        let music = this.bgMusics[0];
        console.log("[PuzzleAudio] 选择的音乐:", music);
        console.log("[PuzzleAudio] 音乐clip:", music.clip);
        
        if (!music.clip) {
            console.log("[PuzzleAudio] 错误：音乐clip为空");
            return;
        }
        
        this.musicAudioSource.clip = music.clip;
        this.musicAudioSource.volume = 0.4 * (this.audioConfig.isAudioOn ? 1.0 : 0.0);
        console.log("[PuzzleAudio] 设置音量:", this.musicAudioSource.volume);
        this.musicAudioSource.play();
        console.log("[PuzzleAudio] 调用play()方法完成");
        this.currMusic = music;
        this.scheduleOnce(()=>{
            this.loopMusic();
        }, music.clip.getDuration())
    }

    playPuzzleSound() {
        console.log("[PuzzleAudio] playPuzzleSound 开始播放音效");
        console.log("[PuzzleAudio] 音频开关状态:", this.audioConfig.isAudioOn);
        console.log("[PuzzleAudio] PuzzleSounds数组长度:", this.PuzzleSounds.length);
        
        if (!this.audioConfig.isAudioOn) {
            console.log("[PuzzleAudio] 音频已关闭，不播放音效");
            return;
        }
        
        if (this.PuzzleSounds.length === 0) {
            console.log("[PuzzleAudio] 错误：PuzzleSounds数组为空，无法播放音效");
            return;
        }
        
        // let sound = this.PuzzleSounds[Math.floor(Math.random() * this.PuzzleSounds.length)];
        let sound = this.PuzzleSounds[0];
        console.log("[PuzzleAudio] 选择的音效:", sound);
        console.log("[PuzzleAudio] 音效clip:", sound.clip);
        
        if (!sound.clip) {
            console.log("[PuzzleAudio] 错误：音效clip为空");
            return;
        }
        
        console.log("[PuzzleAudio] AudioMgr实例:", AudioMgr.inst);
        AudioMgr.inst.playOneShot(sound.clip, 1.0);
        console.log("[PuzzleAudio] 音效播放调用完成");
    }

    async loadConfig() {
        console.log("[PuzzleAudio] loadConfig 开始加载音频配置");
        try {
            const gameData = GameDataPuzzle.instance;
            if (gameData) {
                this.audioConfig.isAudioOn = gameData.getSoundEnabled();
                console.log("[PuzzleAudio] 从GameDataPuzzle读取到音频配置:", this.audioConfig);
            } else {
                console.warn("[PuzzleAudio] GameDataPuzzle实例未找到，使用默认值");
                this.audioConfig.isAudioOn = true;
            }
        } catch (error) {
            console.error("[PuzzleAudio] 加载音频配置失败，使用默认值:", error);
            this.audioConfig.isAudioOn = true;
        }
    }

    async saveConfig() {
        try {
            const gameData = GameDataPuzzle.instance;
            if (gameData) {
                gameData.setSoundEnabled(this.audioConfig.isAudioOn);
                console.log("[PuzzleAudio] 音频配置已保存到GameDataPuzzle");
            } else {
                console.error("[PuzzleAudio] GameDataPuzzle实例未找到，无法保存音频配置");
            }
        } catch (error) {
            console.error("[PuzzleAudio] 保存音频配置失败:", error);
        }
    }

    onClickAudio() {
        console.log("[PuzzleAudio] onClickAudio 切换音频开关");
        console.log("[PuzzleAudio] 切换前状态:", this.audioConfig.isAudioOn);
        this.audioConfig.isAudioOn = !this.audioConfig.isAudioOn;
        console.log("[PuzzleAudio] 切换后状态:", this.audioConfig.isAudioOn);
        
        if(this.audioConfig.isAudioOn){
            console.log("[PuzzleAudio] 声音已开启");
        } else{
            console.log("[PuzzleAudio] 声音已关闭");
        }

        // 获取按钮的Sprite组件
        const btnSprite = this.btnAudio.node.getComponent(Sprite);
        if (!btnSprite) {
            console.warn('[UISetting] 音频按钮未找到Sprite组件');
            return;
        }

        this.updateAudioButtonState();

        // 异步保存配置
        this.saveConfig().catch(error => {
            console.error("[PuzzleAudio] 保存音频配置时出错:", error);
        });
        
        // 处理音频开关状态变化
        if (this.musicAudioSource) {
            if (this.audioConfig.isAudioOn) {
                // 声音开启时，检查背景音乐是否正在播放
                if (!this.musicAudioSource.playing) {
                    console.log("[PuzzleAudio] 声音开启且背景音乐未播放，开始播放背景音乐");
                    this.loopMusic();
                } else {
                    // 如果已经在播放，只需要恢复音量
                    this.musicAudioSource.volume = 0.4;
                    console.log("[PuzzleAudio] 声音开启，恢复背景音乐音量:", this.musicAudioSource.volume);
                }
            } else {
                // 声音关闭时，将音量设为0但不停止播放
                this.musicAudioSource.volume = 0.0;
                console.log("[PuzzleAudio] 声音关闭，设置背景音乐音量为0");
            }
        } else {
            console.log("[PuzzleAudio] 警告：musicAudioSource为空");
        }
    }

    updateAudioButtonState(button?: Button) {
        const targetButton = button || this.btnAudio;
        if (!targetButton) {
            console.warn('[PuzzleAudio] 音频按钮未找到');
            return;
        }

        // 获取按钮的Sprite组件
        const btnSprite = targetButton.node.getComponent(Sprite);
        if (!btnSprite) {
            console.warn('[PuzzleAudio] 音频按钮未找到Sprite组件');
            return;
        }

        // 根据音频开关状态设置按钮灰度
        if (this.audioConfig.isAudioOn) {
            btnSprite.grayscale = false;
            console.log('[PuzzleAudio] 音频已开启，取消按钮灰度');
        } else {
            btnSprite.grayscale = true;
            console.log('[PuzzleAudio] 音频已关闭，设置按钮灰度');
        }
    }

    onLoad() {
        PuzzleAudio._instance = this;
    }

    async start() {
        console.log("[PuzzleAudio] start 开始初始化音频管理器");
        console.log("[PuzzleAudio] bgMusics数组:", this.bgMusics);
        console.log("[PuzzleAudio] PuzzleSounds数组:", this.PuzzleSounds);
        
        this.musicAudioSource = this.node.addComponent(AudioSource);
        console.log("[PuzzleAudio] 创建AudioSource组件:", this.musicAudioSource);
        
        // 异步加载配置
        await this.loadConfig();
        console.log("[PuzzleAudio] 配置加载完成，检查音频开关状态，确认是否开始播放背景音乐");
        
        // 更新按钮状态
        this.updateAudioButtonState();
        
        // 根据音频开关状态决定是否播放背景音乐
        if(this.audioConfig.isAudioOn){
            this.loopMusic();
        }
    }

    onDestroy() {
        if (PuzzleAudio._instance === this) {
            PuzzleAudio._instance = null;
        }
    }

}


