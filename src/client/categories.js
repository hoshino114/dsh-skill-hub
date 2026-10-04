/**
 * Unified skill categories across the three marketplaces.
 *
 * Every host uses its own vocabulary — ClawHub ships English slugs
 * (`lifestyle`, `research`, `operations`), ModelScope its L1 catalogue ids
 * (`ai-media`, `developer-tools`, `skill-management`), the QwenPaw plaza
 * Chinese names (`工程开发`, `其它`) — so the panel maps them onto one small
 * chip set and filters the merged result list client-side.
 */

export const CATEGORIES = [
  {
    key: "dev",
    zh: "工程开发",
    en: "Engineering",
    match: ["developer", "engineering", "development", "programming", "code", "devops", "dev-tool", "工程", "开发", "编程"],
  },
  {
    key: "research",
    zh: "数据研究",
    en: "Research",
    match: ["research", "knowledge", "science", "data", "study", "analysis", "研究", "知识", "数据", "科学"],
  },
  {
    key: "office",
    zh: "文档办公",
    en: "Office",
    match: ["productivity", "office", "document", "docs", "writing", "efficiency", "文档", "办公", "效率", "写作"],
  },
  {
    key: "media",
    zh: "设计创作",
    en: "Design & Media",
    match: ["ai-media", "media", "design", "creative", "image", "video", "audio", "lifestyle", "art", "设计", "创作", "媒体", "生活", "艺术"],
  },
  {
    key: "automation",
    zh: "自动化集成",
    en: "Automation",
    match: ["automation", "integration", "operations", "tools", "workflow", "agent", "自动化", "集成", "运维", "工具", "智能体"],
  },
  {
    key: "product",
    zh: "产品管理",
    en: "Product",
    match: ["product", "management", "business", "finance", "enterprise", "产品", "管理", "商业", "金融", "企业"],
  },
  {
    key: "marketing",
    zh: "营销增长",
    en: "Marketing",
    match: ["marketing", "seo", "social", "communication", "growth", "sales", "营销", "增长", "社交", "沟通", "销售"],
  },
  {
    key: "security",
    zh: "安全合规",
    en: "Security",
    match: ["security", "safety", "privacy", "compliance", "安全", "合规", "隐私"],
  },
];

/** Fallback bucket for everything the table does not classify. */
export const OTHER_CATEGORY = { key: "other", zh: "其他", en: "Other", match: [] };

/** All chip definitions in display order (without the "all" chip). */
export const ALL_CATEGORIES = [...CATEGORIES, OTHER_CATEGORY];

/**
 * Classify one marketplace item.
 * @param {{ categories?: string[], category?: string }} item normalized skill
 * @returns {string} category key
 */
export function categoryOf(item) {
  const raw = [...(item?.categories ?? []), item?.category]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  for (const entry of CATEGORIES) {
    if (raw.some((value) => entry.match.some((needle) => value.includes(needle)))) return entry.key;
  }
  return OTHER_CATEGORY.key;
}

/** Localized label for one category key. */
export function categoryLabel(key, lang) {
  const entry = ALL_CATEGORIES.find((candidate) => candidate.key === key);
  if (entry === undefined) return key;
  return (lang === "en" ? entry.en : entry.zh) ?? entry.zh;
}
