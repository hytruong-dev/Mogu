/**
 * User-Agent dùng chung cho mọi request tới Wikimedia / Wikidata / Openverse / Open Food Facts.
 *
 * Wikimedia yêu cầu UA có thông tin liên hệ (URL hoặc email); UA chung chung sẽ bị
 * rate-limit 429 với retry-after=600s (xem https://meta.wikimedia.org/wiki/User-Agent_policy).
 */
export const INGREDIENT_HTTP_USER_AGENT =
  process.env.INGREDIENT_HTTP_USER_AGENT?.trim() ||
  'MoguIngredientBot/1.1 (https://mogu.app; contact: dev@mogu.app) node-fetch';
