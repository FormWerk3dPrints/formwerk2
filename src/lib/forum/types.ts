export type ForumTagType = 'geral' | 'product' | 'category' | 'kit';

export interface ForumTag {
  type: ForumTagType;
  refId: string;   // 'geral' for type='geral'
  label: string;
}

export interface ForumPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorInstitution: string;
  authorAvatarUrl: string | null;
  title: string;
  body: string;
  imageUrls: string[];
  videoUrl: string | null;
  tags: ForumTag[];
  tagKeys: string[];  // e.g. ['geral', 'product:slug', 'category:id']
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  createdAt: string;  // ISO
  updatedAt: string;
}

export interface ForumComment {
  id: string;
  postId: string;
  parentCommentId: string | null;
  authorUid: string;
  authorName: string;
  authorInstitution: string;
  authorAvatarUrl: string | null;
  body: string;
  likeCount: number;
  dislikeCount: number;
  replyCount: number;
  createdAt: string;
}

export type VoteValue = 'like' | 'dislike';
export type FilterSort = 'padrao' | 'novos' | 'em-alta' | 'all-time';
