游戏引擎：Cocos Creator 3.8.6
代码语言：TypeScript
目标平台：微信小游戏

拼图数据需要增加组的概念，需要支持动态下载和加载图片，因为微信小游戏包大小限制，不能把所有的图片都打包到小游戏包中，需要动态下载和加载图片。

实现图片下载与管理逻辑​​
•编写一个函数，接收图片URL，调用 wx.downloadFile进行下载。
•将下载成功后的临时文件路径存储起来，并更新关卡数据。
•处理好网络错误和权限提示。
注意事项
•​​网络问题​​：下载图片是核心环节，务必处理好弱网环境下的提示和重试机制。
•​​资源缓存​​：考虑对已下载的图片进行缓存，避免玩家重复下载消耗流量。你可以将 wx.downloadFile下载的文件保存到更持久的小游戏文件系统 (wx.fileSystem) 中，而不是每次都重新下载。
用户体验​​：
•在下载较大图片时，给用户清晰的进度提示（wx.downloadFile支持监听下载进度）。
•提前告知用户下载需要消耗流量。

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
    （6）新增labelWait和Waitime=2秒，每次打开UISelectPuzzle界面，如果限定时间Waitime结束，才根据最新的加载进度，即拼图数据判断拼图数据有几个组。比如，有2个组，其中1个组的所有图片都加载失败，按拼图数据只1个组处理。
    （7）增加难度切换按钮父节点的配置，它和puzzleGroupScrollView同时显示和隐藏

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
        如果有图片，则应该设置该图片的状态为
            （3.1）检查存档，如果有存档，根据存档记录，如果是UNAVAILABLE，则设置为UNLOCKED，并且更新存档记录也为UNLOCKED；否则取存档记录的拼图状态
            （3.2）如果没有存档，则根据puzzleInitialStatus设置拼图状态
    （4）每次完成拼图，解锁新拼图，需要改为
        （4.1）只解锁同组里边第一个LOCKED的拼图

UIMainMenu.ts
    （1）增加进度条LoadPuzzleBar，调整在首次打开UIManiMenu时加载拼图数据，加载时隐藏开始按钮和展示进度条，加载完成后，隐藏进度条和显示开始按钮；
