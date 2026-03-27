// ProductComment.ts
export interface ProductComment {
  id?: string; // Firestore document ID (optional, for editing/removal)
  name: string;
  role: string;
  comment: string;
  date: Date;
  profilePicture?: string; // URL da imagem de perfil (opcional)
}
