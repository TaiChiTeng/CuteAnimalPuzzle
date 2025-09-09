拼图数据增加组的概念

UISelectPuzzle.ts
    （1）增加puzzleGroupScrollView
        拼图组的滚动视图，如果拼图数据只有1个组，就不用展示puzzleGroupScrollView，直接显示puzzleScrollView；
        如果拼图数据有多个组，就展示puzzleGroupScrollView，先隐藏puzzleScrollView；
        每个拼图组的内容itemPuzzleGroupPrefab都实例化后放在puzzleGroupScrollView的content节点下；
        点击itemPuzzleGroupPrefab，隐藏puzzleGroupScrollView，展示puzzleScrollView；
    （2）增加itemPuzzleGroupPrefab
        拼图组的内容itemPuzzleGroupPrefab，点击切换展示
        隐藏puzzleGroupScrollView，根据根据itemPuzzleGroupPrefab的索引，puzzleScrollView展示对应的拼图组；
        itemPuzzleGroupPrefab里边有3张图片，分别展示对应拼图组的第1，2，3张图片
    （3）返回按钮要改变功能
        点击返回按钮时，判断puzzleScrollView是否正在显示
        如果puzzleScrollView正在显示，则隐藏puzzleScrollView，显示puzzleGroupScrollView
        如果puzzleGroupScrollView正在显示，则返回UIMainMenu
    （4）onShow()要改
        每次显示UISelectPuzzle时，要判断puzzleData是否有多个组
        如果有多个组，就展示puzzleGroupScrollView，先隐藏puzzleScrollView；
        如果只有1个组，就隐藏puzzleGroupScrollView，直接显示puzzleScrollView；
    （5）initializePuzzleList()要增加传入参数，itemPuzzleGroupPrefab的索引，默认用0
        每次初始化puzzleScrollView时，要根据itemPuzzleGroupPrefab的索引，初始化对应的拼图组；

GameDataPuzzle.ts
    （1）拼图配置数据增加puzzleGroupID
        每个拼图有一个puzzleGroupID，用来标识这个拼图属于哪个组；
            @property({ type: [number], displayName: "拼图组ID" })
            public puzzleGroupID: number[] = [];
    （2）兼容旧数据
        旧数据如果没有puzzleGroupID或者puzzleGroupID没有配置的拼图，默认取0，即该拼图都在第0组；
    （3）拼图配置数据增加url
        每个拼图有一个url，用来动态下载和加载拼图的图片，当且仅当puzzleSpriteFrames没有配置时，才会使用url加载图片；
            @property({ type: [string], displayName: "拼图URL" })
            public puzzleURL: string[] = [];
        如果puzzleSpriteFrames没有配置，puzzleURL也没有配置或者下载失败或加载失败，则强行设置该拼图的状态是UNAVAILABLE。
