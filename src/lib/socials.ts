/** Social links the admin can set in Settings, in the order the footer shows them. */
export const SOCIALS = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  pinterest: "Pinterest",
} as const;

export type SocialKey = keyof typeof SOCIALS;

/** Aussient's own profiles: used by the seed, and in the footer if Settings has none saved. */
export const DEFAULT_SOCIALS: Partial<Record<SocialKey, string>> = {
  facebook: "https://www.facebook.com/aussient",
  instagram: "https://www.instagram.com/aussientptyltd/",
  youtube: "https://www.youtube.com/@aussient",
  linkedin: "https://www.linkedin.com/company/aussient-pty-ltd",
  tiktok: "https://www.tiktok.com/@aussient",
};
