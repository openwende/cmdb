import type { Options } from 'react-markdown';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';

/**
 * AI 面板里所有 Markdown 渲染共用的 remark 插件（回答正文、知识库原文气泡）。
 *
 * remark-cjk-friendly：CommonMark 的定界符规则把全角标点当作标点，`**` 内侧是
 * 全角标点、外侧紧挨汉字时（`**主机状态：**故障`、`这是**（故障）**主机`）不被
 * 识别为粗体，星号原样显示；这个插件放宽了 CJK 文字旁边的判断。
 * 按插件文档放在 remark-gfm 之后；它不处理 GFM 删除线 `~~`。
 */
export const BASE_REMARK_PLUGINS: NonNullable<Options['remarkPlugins']> = [
  remarkGfm,
  remarkCjkFriendly,
];
