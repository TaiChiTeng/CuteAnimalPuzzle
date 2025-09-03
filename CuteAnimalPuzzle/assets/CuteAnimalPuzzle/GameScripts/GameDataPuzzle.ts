import { _decorator, Component, sys, SpriteFrame, Enum } from 'cc';
const { ccclass, property } = _decorator;

// 拼图状态枚举
export enum PuzzleStatus {
    UNAVAILABLE = 0,  // 未开放
    LOCKED = 1,       // 未解锁
    UNLOCKED = 2,     // 已解锁未完成
    COMPLETED = 3     // 已完成
}

// 拼图难度枚举
export enum PuzzleDifficulty {
    EASY = 9,     // 9张拼图
    MEDIUM = 16,  // 16张拼图
    HARD = 25     // 25张拼图
}

// 存档数据接口
interface SaveData {
    soundEnabled: boolean;                    // 游戏是否开启了声音
    puzzleStatus: { [puzzleId: string]: PuzzleStatus }; // 拼图状态映射
    currentDifficulty: PuzzleDifficulty;     // 当前选择的难度
    selectedPuzzleId: string;                // 当前选择的拼图ID
}

@ccclass('GameDataPuzzle')
export class GameDataPuzzle extends Component {
    private static _instance: GameDataPuzzle = null;
    private _saveData: SaveData = null;
    private readonly SAVE_KEY = 'CuteAnimalPuzzle_SaveData';
    
    // 拼图配置数据结构
    @property({ type: [SpriteFrame], displayName: "拼图图片列表" })
    public puzzleSpriteFrames: SpriteFrame[] = [];
    
    @property({ type: [Enum(PuzzleStatus)], displayName: "拼图初始状态" })
    public puzzleInitialStatus: PuzzleStatus[] = [];

    public static get instance(): GameDataPuzzle {
        return GameDataPuzzle._instance;
    }

    onLoad() {
        if (GameDataPuzzle._instance === null) {
            GameDataPuzzle._instance = this;
            this.loadSaveData();
        } else {
            this.destroy();
        }
    }

    start() {
        // 初始化默认数据
        this.initDefaultData();
    }

    /**
     * 初始化默认数据
     */
    private initDefaultData(): void {
        console.log('[GameDataPuzzle] puzzleInitialStatus数据:', this.puzzleInitialStatus);
        if (!this._saveData) {
            this._saveData = {
                soundEnabled: true,
                puzzleStatus: {},
                currentDifficulty: PuzzleDifficulty.EASY,
                selectedPuzzleId: ''
            };
            
            // 初始化拼图状态，使用配置的初始状态数组
            const totalPuzzles = this.puzzleSpriteFrames.length;
            for (let i = 1; i <= totalPuzzles; i++) {
                const puzzleId = i.toString();
                const arrayIndex = i - 1; // 数组索引从0开始
                if (arrayIndex < this.puzzleInitialStatus.length) {
                    this._saveData.puzzleStatus[puzzleId] = this.puzzleInitialStatus[arrayIndex];
                } else {
                    // 如果没有配置初始状态，默认第一个解锁，其他锁定
                    this._saveData.puzzleStatus[puzzleId] = i === 1 ? PuzzleStatus.UNLOCKED : PuzzleStatus.LOCKED;
                }
            }
            
            this.saveData();
        }
    }

    /**
     * 加载存档数据
     */
    private loadSaveData(): void {
        console.log('[GameDataPuzzle] 开始加载存档数据');
        try {
            const saveDataStr = sys.localStorage.getItem(this.SAVE_KEY);
            if (saveDataStr) {
                this._saveData = JSON.parse(saveDataStr);
                console.log('[GameDataPuzzle] 存档数据加载成功:', this._saveData);
            } else {
                console.log('[GameDataPuzzle] 未找到存档数据，将使用默认数据');
            }
        } catch (error) {
            console.error('[GameDataPuzzle] 加载存档数据失败:', error);
            this._saveData = null;
        }
    }

    /**
     * 保存存档数据
     */
    public saveData(): void {
        console.log('[GameDataPuzzle] 开始保存存档数据:', this._saveData);
        try {
            const saveDataStr = JSON.stringify(this._saveData);
            sys.localStorage.setItem(this.SAVE_KEY, saveDataStr);
            console.log('[GameDataPuzzle] 存档数据保存成功');
        } catch (error) {
            console.error('[GameDataPuzzle] 保存存档数据失败:', error);
        }
    }

    // ========== 声音设置相关 ==========
    
    /**
     * 获取声音开启状态
     */
    public getSoundEnabled(): boolean {
        return this._saveData?.soundEnabled ?? true;
    }

    /**
     * 设置声音开启状态
     */
    public setSoundEnabled(enabled: boolean): void {
        if (this._saveData) {
            this._saveData.soundEnabled = enabled;
            this.saveData();
        }
    }

    // ========== 拼图状态相关 ==========
    
    /**
     * 获取拼图状态
     */
    public getPuzzleStatus(puzzleId: number): PuzzleStatus {
        const key = puzzleId.toString();
        return this._saveData?.puzzleStatus[key] ?? this.getInitialPuzzleStatus(puzzleId);
    }

    /**
     * 设置拼图状态
     */
    public setPuzzleStatus(puzzleId: number, status: PuzzleStatus): void {
        if (this._saveData) {
            const key = puzzleId.toString();
            this._saveData.puzzleStatus[key] = status;
            this.saveData();
        }
    }

    /**
     * 完成拼图，解锁下一个拼图
     */
    public completePuzzle(puzzleId: number): void {
        console.log('[GameDataPuzzle] 完成拼图:', puzzleId);
        if (this._saveData) {
            // 设置当前拼图为已完成
            this.setPuzzleStatus(puzzleId, PuzzleStatus.COMPLETED);
            console.log('[GameDataPuzzle] 拼图', puzzleId, '状态已设置为完成');
            
            // 解锁下一个拼图
            const nextPuzzleId = puzzleId + 1;
            if (nextPuzzleId <= this.getTotalPuzzleCount()) {
                if (this.getPuzzleStatus(nextPuzzleId) === PuzzleStatus.LOCKED) {
                    this.setPuzzleStatus(nextPuzzleId, PuzzleStatus.UNLOCKED);
                    console.log('[GameDataPuzzle] 下一个拼图', nextPuzzleId, '已解锁');
                }
            } else {
                console.log('[GameDataPuzzle] 已完成所有拼图！');
            }
        } else {
            console.error('[GameDataPuzzle] 存档数据未初始化，无法完成拼图');
        }
    }

    /**
     * 获取可用的拼图ID列表
     */
    public getAvailablePuzzleIds(): number[] {
        return Array.from({ length: this.getTotalPuzzleCount() }, (_, i) => i + 1);
    }
    
    /**
     * 获取拼图总数
     */
    public getTotalPuzzleCount(): number {
        return this.puzzleSpriteFrames.length;
    }
    
    /**
     * 获取拼图的SpriteFrame
     */
    public getPuzzleSpriteFrame(puzzleId: number): SpriteFrame | null {
        const index = puzzleId - 1; // 转换为数组索引
        return this.puzzleSpriteFrames[index] || null;
    }
    
    /**
     * 获取拼图的初始状态
     */
    private getInitialPuzzleStatus(puzzleId: number): PuzzleStatus {
        const index = puzzleId - 1; // 转换为数组索引
        return this.puzzleInitialStatus[index] || PuzzleStatus.LOCKED;
    }

    // ========== 难度设置相关 ==========
    
    /**
     * 获取当前难度
     */
    public getCurrentDifficulty(): PuzzleDifficulty {
        return this._saveData?.currentDifficulty ?? PuzzleDifficulty.EASY;
    }

    /**
     * 设置当前难度
     */
    public setCurrentDifficulty(difficulty: PuzzleDifficulty): void {
        if (this._saveData) {
            this._saveData.currentDifficulty = difficulty;
            this.saveData();
        }
    }

    // ========== 选择拼图相关 ==========
    
    /**
     * 获取当前选择的拼图ID
     */
    public getSelectedPuzzleId(): number {
        return parseInt(this._saveData?.selectedPuzzleId) || 1;
    }

    /**
     * 设置当前选择的拼图ID
     */
    public setSelectedPuzzleId(puzzleId: number): void {
        if (this._saveData) {
            this._saveData.selectedPuzzleId = puzzleId.toString();
            this.saveData();
        }
    }

    /**
     * 获取拼图的网格尺寸（根据难度）
     */
    public getPuzzleGridSize(difficulty?: PuzzleDifficulty): { rows: number, cols: number } {
        const diff = difficulty ?? this.getCurrentDifficulty();
        switch (diff) {
            case PuzzleDifficulty.EASY:
                return { rows: 3, cols: 3 };
            case PuzzleDifficulty.MEDIUM:
                return { rows: 4, cols: 4 };
            case PuzzleDifficulty.HARD:
                return { rows: 5, cols: 5 };
            default:
                return { rows: 3, cols: 3 };
        }
    }

    update(deltaTime: number) {
        
    }
}


