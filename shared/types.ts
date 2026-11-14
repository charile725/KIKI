export const fits = ["貼身", "合身", "微寬鬆", "Oversized"] as const;
export type Fit = (typeof fits)[number];
export interface ProductSize {
  label: string;
  chest: number;
  length: number;
  waist?: number;
  stock: number;
}
export interface Product {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  price: number;
  image: string;
  color: string;
  color_hex: string;
  colors: { name: string; hex: string }[];
  fit: Fit;
  sizes: ProductSize[];
  tags: string[];
  description: string;
  material: string;
}
export interface Body {
  height: number;
  weight: number;
  shoulder?: number;
  chest?: number;
  waist?: number;
  hip?: number;
}
export interface Profile {
  user_id: string;
  display_name: string;
  fit_preference: Fit;
  personalize: boolean;
  external_ai_consent: boolean;
}
export interface Avatar extends Body {
  id: string;
  user_id: string;
  front_path: string;
  side_path: string;
  created_at: string;
}
export interface Tryon {
  id: string;
  user_id: string;
  avatar_id: string;
  product_id: string;
  size: string;
  color: string;
  status: "processing" | "completed" | "failed";
  mode: "demo" | "ai";
  result_path: string | null;
  error: string | null;
  created_at: string;
}
export interface Outfit {
  id: string;
  user_id: string;
  tryon_id: string;
  name: string;
  created_at: string;
}
export interface Recommendation {
  product_id: string;
  reason: string;
}
export interface RecommendationResult {
  mode: "demo" | "ai";
  message: string;
  recommendations: Recommendation[];
}
export interface AppConfig {
  supabaseUrl: string;
  supabaseKey: string;
  configured: boolean;
  recommendationMode: "demo" | "ai";
  tryonMode: "demo" | "ai";
}
