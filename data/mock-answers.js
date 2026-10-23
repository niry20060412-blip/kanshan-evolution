/**
 * 后端本地兜底数据（兼容入口）
 *
 * 真正的语料现在只有一份，放在 public/js/local-knowledge.js，
 * 这样前端静态部署时也能拿到同一套内容，不会出现「后端有内容、静态站空白」。
 * 本文件只做转出，保持 server/index.js 的原有引用不变。
 */

export {
  LOCAL_ANSWERS as MOCK_ANSWERS,
  LOCAL_HOT as MOCK_HOT,
  pickLocalAnswer as pickMockAnswer
} from '../public/js/local-knowledge.js';
