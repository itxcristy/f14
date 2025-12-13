export type UserRole = 'admin' | 'uploader' | 'user';

export interface UserProfile {
  id: string;
  email: string | null;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploaderPermission {
  id: string;
  user_id: string;
  category_id: string | null;
  imam_id: string | null;
  created_at: string;
  category?: Category;
  imam?: Imam;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  created_at: string;
}

export interface Imam {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  order_index: number;
  created_at: string;
}

export interface Piece {
  id: string;
  title: string;
  category_id: string;
  imam_id: string | null;
  reciter: string | null;
  language: string;
  text_content: string;
  audio_url: string | null;
  video_url: string | null;
  image_url: string | null;
  tags: string[];
  view_count: number;
  created_at: string;
  updated_at: string;
  category?: Category;
  imam?: Imam;
}

export interface SiteSettings {
  id: string;
  site_name: string;
  site_tagline: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export type EventType = 'birthday' | 'death' | 'martyrdom' | 'other';

export interface AhlulBaitEvent {
  id: string;
  imam_id: string;
  event_type: EventType;
  event_date: string;
  event_name: string;
  description: string | null;
  is_annual: boolean;
  created_at: string;
  updated_at: string;
  imam?: Imam;
}
