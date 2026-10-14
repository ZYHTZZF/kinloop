# 落实功能4「回忆触发」的详细开发计划

本计划严格落实前序分析，明确到**具体文件、具体代码结构以及具体改动方式**。确保对共享文件的修改可控，且保证改动后 build 通过。

## 一、后端具体落地方案（独立 API 与 Service）

### 1. 新增文件：`server/services/memory/memoryTriggerService.mjs`
*   **开发细节**：
    *   暴露出一个 `analyzeAndTriggerMemory(messageText, userId, familyId)` 方法。
    *   **原理**：在真实的 AI 接入前，我们会在此使用简单的正则/大模型（目前可先用轻量 Prompt 或关键词匹配）提取诸如“老地方”、“上次”、“记得”等往事特征词。
    *   查库：导入已有的 `memoryRepository.mjs`，通过基础的遍历或过滤查找相关的 `memory_entries`（如果有关键词命中）。
    *   返回值：返回一个对象 `{ triggered: true, memory: { id, title, summary, date } }`，如果没有触发则返回 `{ triggered: false }`。

### 2. 新增文件：`server/routes/memoryTriggerRoutes.mjs`
*   **开发细节**：
    *   使用 `express.Router()`。
    *   定义 `POST /trigger` 接口。
    *   接收请求体：`{ messageId, text, userId, familyId }`。
    *   调用 `memoryTriggerService.analyzeAndTriggerMemory`，并将结果以 JSON 格式返回给前端。

### 3. 修改共享文件：`server/index.mjs`
*   **修改步骤**：
    1.  文件顶部引入：`import memoryTriggerRoutes from './routes/memoryTriggerRoutes.mjs';`
    2.  在路由注册区（大约在已有 `app.use('/api/...'` 周围），新增一行：`app.use('/api/memories', memoryTriggerRoutes);` (挂载为 `/api/memories/trigger`)。
*   **影响**：纯新增路由，零影响已有 API。

---

## 二、前端具体落地方案（独立 UI 与副作用 Hook）

### 4. 新增逻辑 Hook：`src/utils/hooks/useMemoryTrigger.ts`
*   **开发细节**：
    *   接收 `message` (包含 id, content) 作为参数。
    *   使用 `useEffect` 监听，仅对**最近的新消息**（非历史旧消息批量拉取时）发起对 `/api/memories/trigger` 的异步请求。
    *   维护本地 state `const [memoryData, setMemoryData] = useState(null)`。
    *   如果请求返回了需要触发的回忆，保存到 state 中，供 UI 渲染。

### 5. 新增辅助区容器与样式：`src/components/chat/MessageAuxArea.tsx` & `.module.css`
*   **开发细节**：
    *   定义 `<MessageAuxArea message={message} />` 组件。
    *   在内部调用 `useMemoryTrigger(message)`。
    *   **样式**：使用已有全局 CSS 变量。
        *   背景色：`backgroundColor: 'var(--bg-secondary)'` (或者淡灰色)。
        *   字体：`color: 'var(--text-secondary)'`, `fontSize: '0.85rem'`。
        *   边距与圆角：`borderRadius: '8px'`, `marginTop: '4px'`。
    *   **效果**：如果没有任何辅助信息（如 memoryData 为 null），组件返回 `null`，不占任何空间；如果有，则渲染 `<MemoryTriggerCard />`。

### 6. 新增独立回忆卡片：`src/components/chat/MemoryTriggerCard.tsx`
*   **开发细节**：
    *   接收 `memoryData` 作为 props。
    *   展示内容：“💡 提到老地方了，上次你们一起去是在去年秋天” (根据后端返回文字直接渲染)。
    *   带有“展开查看”的小交互逻辑。

### 7. 修改共享文件：`src/components/chat/ChatMessage.tsx`
*   **修改步骤**：
    1.  在文件顶部引入：`import { MessageAuxArea } from './MessageAuxArea';`
    2.  在 `ChatMessage` 件的渲染结构末尾（消息气泡 `message-bubble` 这个 div 的**下方或内部末尾**，具体位置看气泡的 flex 布局），插入 `<MessageAuxArea message={message} />`。
*   **修改示例（伪代码对照）**：
    ```tsx
    // 改动前：
    <div className={styles.messageBubble}>
       {renderMessageContent()}
       {renderStatus()}
    </div>
    
    // 改动后：
    <div className={styles.messageWrapper}>
       <div className={styles.messageBubble}>
          {renderMessageContent()}
          {renderStatus()}
       </div>
       {/* 唯一侵入的改动，统筹功能3/4/5的辅助区域插槽 */}
       <MessageAuxArea message={message} />
    </div>
    ```
*   **影响**：做到了绝对解耦。主列表、发消息逻辑无须更改，仅在此处增加了对新插槽的渲染，不破坏原有样式，保证 Build 通过且界面一致。

---

## 三、验证与保障规范
1.  **不碰现有设计**：完全依赖全局 `.css` 中的 `var(--text-...)` 和组件局部的 module，不引入第三方 UI 库。
2.  **一次只做一件事**：此次 Commit 仅仅包含“回忆触发”从后到前的闭环，顺手把 `MessageAuxArea` 空壳留给其他功能，坚决不重构原来的 WebSocket 发消息逻辑。
3.  **构建验证**：完成上述所有步骤后，执行 `npm run build` 和 `npm run lint` 以确保无类型与语法错误。