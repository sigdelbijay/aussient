/** Social links the admin can set in Settings, in the order the footer shows them. */
export const SOCIALS = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
  pinterest: "Pinterest",
  threads: "Threads",
} as const;

export type SocialKey = keyof typeof SOCIALS;
