export interface Artwork {
  id: string;
  title: string;
  author: string;
  authorAvatar: string;
  image: string;
  description: string;
  downloads: string;
  forks: string;
  views: string;
  hearts: string;
  tags: string[];
  openChallenges: string[];
  type: 'Original' | 'Remix';
  parentArtworkId?: string;
  parentAuthor?: string;
  resolution?: string;
  // Crop focus point (0-100 percentages) for when this image is shown
  // cropped, e.g. in gallery cards. Defaults to 50/50 (centered).
  focalX?: number;
  focalY?: number;
  timeAgo: string;
  createdAt?: string;
  // Real-backend fields (absent on the static demo seed artworks)
  ownerId?: string;
  imagePath?: string;
  sourceFilePath?: string;
  sourceFileName?: string;
  isDemo?: boolean;
}

export interface CreatorProfile {
  username: string;
  displayName: string;
  avatar: string;
  isVerified: boolean;
  bio: string;
  remixesCount: string;
  downloadsCount: string;
  creationsCount: string;
}

// A real, logged-in user's profile row from the `profiles` table.
export interface Profile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  credits: number;
  createdAt: string;
}
