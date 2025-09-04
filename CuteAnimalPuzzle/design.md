游戏引擎：Cocos Creator 3.8.6
代码语言：TypeScript
目标平台：微信小游戏

界面：UIManager挂载在Canvas上，负责管理所有界面的显示和隐藏
    UIMainMenu：主菜单界面
        按钮：开始游戏，点击后打开选择拼图和难度界面
        按钮：开启/关闭声音，每次更改要存档
    UISelectPuzzle：选择拼图和难度界面
        初始化：要根据存档数据来初始化可选拼图列表
        按钮：返回主菜单
        按钮：开启/关闭声音，每次更改要存档
        拼图难度切换：
            切换按钮：设置难度为9张拼图
            切换按钮：设置难度为16张拼图
            切换按钮：设置难度为25张拼图
        滚动列表：可选拼图列表
            列表项：拼图
                按钮：选择拼图，按钮子节点sprPuzzle展示对应的拼图
    UISolvePuzzle：解决拼图界面
        初始化：要根据UISelectPuzzle选择的拼图来初始化，要根据难度来初始化拼图切片列表
        按钮：返回选择拼图和难度界面
        按钮：开启/关闭声音，每次更改要存档
        按钮：提示，点击显示拼图提示图片
        网格：每张拼图切片的正确位置，根据UISelectPuzzle切换按钮生成N张拼图切片，每个切片的正确位置
        拼图提示图片：根据UISelectPuzzle选择的拼图来显示，默认隐藏
        拼图切片可拖拽区域：拖拽拼图切片离开拼图切片列表后，可以在该区域内拖动和松开
        滚动列表：拼图切片列表
            列表项：拼图切片，根据UISelectPuzzle切换按钮生成N张拼图切片
                拼图切片：
                    初始在拼图切片列表中，按下拼图切片可以抓起它：创建一个拖拽副本，列表暂时删除它
                    拖拽副本：
                        可以在拼图切片可拖拽区域内拖动
                        松开时，根据当前鼠标位置或触摸位置来判断：
                            如果在拼图切片列表的范围内，放回列表里：列表插入到距离当前鼠标位置或触摸位置最近的位置
                            如果不在拼图切片列表的范围内，不放回列表
                                如果在正确位置，则自动插入到正确位置，插入后会检查是否所有拼图切片都在正确位置，如果是则更新存档并打开完成拼图界面
                                如果不在正确位置，则停留在松开位置
        上面的描述，Claude没法完成好的，拆解需求，UISolvePuzzle.ts：
            （1）创建一个类似国际象棋棋盘黑白相间的网格，网格的边长为660，根据拼图难度，
                难度为9张拼图时，网格为3x3
                难度为16张拼图时，网格为4x4
                难度为25张拼图时，网格为5x5
                父节点puzzleGrid，预制体gridPiecePrefab，用gridSlots[]来存储网格的每个插槽
            （2）创建一个正确拼图正确位置的网格，网格的边长也是660，也是根据拼图难度，父节点puzzleAnswers，预制体gridPieceAnswerPrefab
                测试实现的临时需求：点击gridSlots[i]就创建正确的拼图切片
            （3）创建一个拖拽区域dragArea，拖拽区域的边长为720（稍微大一点），根据拼图难度，父节点dragArea，预制体dragPiecePrefab
                测试实现的临时需求：在dragArea区域按下鼠标就创建dragPiecePrefab并可以拖动它，限制它在dragArea区域内，当且仅当松开鼠标时销毁它
            （4）感觉需要整合需求了：（1）（2）（3）都完成正确，再想一下先：
                （4.1）当拼图切片列表的切片被按下时，像（3）那样创建一个拖拽副本，图片是切片的图片（不是固定puzzlePieces[0]了），列表暂时删除它
                （4.2）修改（3），当拖拽副本被松开时，判断是否在正确位置
                        如果是则类似（2）那样在正确位置创建gridPieceAnswerPrefab，销毁拖拽副本，然后检查是否所有拼图切片都在正确位置，如果是则更新存档并打开完成拼图界面
                        如果不是正确位置
                            如果是在拼图切片列表的范围内，根据最近的位置插入回列表，销毁拖拽副本
                            如果不是在拼图切片列表的范围内，则创建一个未拼好的拼图切片(也是用预制体dragPiecePrefab)，停留在松开位置，添加进dragPieceSlots[]来存储，销毁拖拽副本
        上面（4）的描述，Claude竟然还是没法完成好，实在垃圾，再重新拆解需求：
                （1）在dragArea区域按下鼠标/屏幕触摸不再创建拖拽副本dragPiecePrefab，改为
                （2）当拼图切片列表的切片PuzzlePiece[i]被按下时，再以dragArea为父节点创建一个拖拽副本dragPiecePrefab，dragPiecePrefab图片改用PuzzlePiece[i]的图片（不是固定puzzlePieces[0]了），然后列表要暂时删除PuzzlePiece[i]
                （3）也是限制dragPiecePrefab在dragArea区域内，当且仅当松开鼠标/不再屏幕触摸时，将PuzzlePiece[i]添加回列表PuzzlePiece[]，并销毁dragPiecePrefab
        又没完成好，原来是自动切到Claude-3.7-Sonnet去了，实在是垃圾，回滚下，Claude-4-Sonnet完成得很好嘛！
        接下来，噢，手机的触摸不对：

手机上触摸PuzzlePiece[i]且按下时，还没松开的：[UISolvePuzzle] 从拼图切片1创建了拖拽预制体，尺寸：180
game.js? [sm]:17 [UISolvePuzzle] 恢复了拼图切片1到列表
game.js? [sm]:17 [UISolvePuzzle] 销毁了拖拽预制体

**问题分析**：
- 手机上触摸拼图切片时，即使未松开也会立即触发恢复和销毁逻辑
- 原因是ScrollView的触摸事件与拼图切片的触摸事件产生冲突

**解决方案**：
将事件监听从节点级别改为全局输入级别，避免ScrollView干扰：

1. **修改触摸事件监听**：
   - `onPieceTouchStart`方法中，将`this.node.on`改为`input.on`
   - `onGlobalTouchEnd`方法中，将`this.node.off`改为`input.off`

2. **修改鼠标事件监听**（保持一致性）：
   - `onPieceMouseDown`方法中，将`this.node.on`改为`input.on`
   - `onGlobalMouseUp`方法中，将`this.node.off`改为`input.off`

**技术细节**：
- 使用`input.on(Input.EventType.TOUCH_MOVE/TOUCH_END)`替代`node.on(Node.EventType.TOUCH_MOVE/TOUCH_END)`
- 使用`input.on(Input.EventType.MOUSE_MOVE/MOUSE_UP)`替代`node.on(Node.EventType.MOUSE_MOVE/MOUSE_UP)`
- 保留了事件传播阻止逻辑`event.propagationStopped = true`

现在手机上触摸拼图切片时，不会再出现未松开就触发恢复逻辑的问题。

        
    UIFinishPuzzle：完成拼图界面
        按钮：返回选择拼图和难度界面
        按钮：保存拼图图片到手机相册
        按钮：分享到微信好友（已实现）

数据：PuzzleResourceManager也挂载在Canvas上，负责管理所有拼图的资源
    存档数据：
        游戏是否开启了声音
        未开放的拼图：记录未开放的拼图id，界面UISelectPuzzle的列表不显示这些拼图
        未解锁的拼图：记录未解锁的拼图id，界面UISelectPuzzle的列表显示这些拼图，这些拼图的按钮要显示未解锁的标志sprLocked
        已解锁未完成的拼图：记录已解锁的拼图id，界面UISelectPuzzle的列表显示这些拼图，这些拼图的按钮要显示未完成的标志sprUnfinished
        已完成的拼图：记录已完成的拼图id，界面UISelectPuzzle的列表显示这些拼图，这些拼图的按钮还要显示查看按钮btnLookPuzzle，点击查看按钮后打开完成拼图界面
    找不到存档数据时，要按默认配置初始化各拼图的状态

默认配置
    可以在Cocos Creator里边，把所有拼图照片逐张拖进SpriteFrame[]，还需要有可以配置它的初始状态PuzzleStatus[]。
    然后代码直接按id1～N来处理。
