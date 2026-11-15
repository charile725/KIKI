import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { AppConfig, Avatar, Product, Profile } from "../shared/types";
import { api } from "./lib/api";
import { ensure } from "./lib/data";
import { errorText } from "../shared/validation";

interface AppState {
  config: AppConfig | null;
  db: SupabaseClient | null;
  session: Session | null;
  profile: Profile | null;
  avatar: Avatar | null;
  loading: boolean;
  userLoading: boolean;
  products: Product[];
  catalogSource: string;
  catalogError: string;
  favorites: string[];
  error: string;
  userError: string;
  refresh: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  toast: (message: string) => void;
}
const Context = createContext<AppState | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null),
    [db, setDb] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [avatar, setAvatar] = useState<Avatar | null>(null);
  const [products, setProducts] = useState<Product[]>([]),
    [catalogSource, setCatalogSource] = useState(""),
    [catalogError, setCatalogError] = useState(""),
    [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true),
    [userLoading, setUserLoading] = useState(true),
    [error, setError] = useState(""),
    [userError, setUserError] = useState("");
  const [notice, setNotice] = useState("");
  const activeUser = useRef<string | undefined>(undefined);
  const toast = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(id);
  }, [notice]);
  const refreshCatalog = useCallback(async () => {
    setCatalogError("");
    try {
      const result = await api<{ products: Product[]; source: string }>(
        "/api/products",
      );
      setProducts(result.products);
      setCatalogSource(result.source);
    } catch (e) {
      setCatalogError(errorText(e));
    }
  }, []);
  useEffect(() => {
    let live = true;
    api<AppConfig>("/api/config")
      .then((c) => {
        if (!live) return;
        setConfig(c);
        if (c.configured) setDb(createClient(c.supabaseUrl, c.supabaseKey));
        else setUserLoading(false);
      })
      .catch((e) => {
        if (live) {
          setError(errorText(e));
          setUserLoading(false);
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    void refreshCatalog();
    return () => {
      live = false;
    };
  }, [refreshCatalog]);
  useEffect(() => {
    if (!db) return;
    let live = true;
    db.auth.getSession().then(({ data, error }) => {
      if (live) {
        if (error) setUserError("登入狀態讀取失敗，請重新登入。");
        activeUser.current = data.session?.user.id;
        setSession(data.session);
        if (!data.session) setUserLoading(false);
      }
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, s) => {
      if (live) {
        if (activeUser.current !== s?.user.id) {
          setProfile(null);
          setAvatar(null);
          setFavorites([]);
          setUserError("");
          setUserLoading(!!s);
        }
        activeUser.current = s?.user.id;
        setSession(s);
        if (!s) {
          setProfile(null);
          setAvatar(null);
          setFavorites([]);
          setUserLoading(false);
        }
      }
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, [db]);
  const userId = session?.user.id;
  const refresh = useCallback(async (): Promise<void> => {
    if (!db || !userId) return;
    const [p, a, f] = await Promise.all([
      db.from("kiki_profiles").select("*").eq("user_id", userId).maybeSingle(),
      db.from("kiki_avatars").select("*").eq("user_id", userId).maybeSingle(),
      db.from("kiki_favorites").select("product_id").eq("user_id", userId),
    ]);
    ensure(p.error);
    ensure(a.error);
    ensure(f.error);
    if (activeUser.current !== userId) return;
    if (!p.data) {
      const { error } = await db.from("kiki_profiles").insert({
        user_id: userId,
        display_name: session?.user.user_metadata.display_name || "風格探索者",
      });
      ensure(error);
      return refresh();
    }
    setProfile(p.data as Profile);
    setAvatar(a.data as Avatar | null);
    setFavorites((f.data || []).map((x) => x.product_id));
    setUserError("");
  }, [db, userId, session?.user.user_metadata.display_name]);
  useEffect(() => {
    if (!db || !userId) return;
    let live = true;
    setUserLoading(true);
    refresh()
      .catch((e) => {
        if (live) setUserError(errorText(e));
      })
      .finally(() => {
        if (live) setUserLoading(false);
      });
    return () => {
      live = false;
    };
  }, [db, userId, refresh]);
  const toggleFavorite = async (id: string) => {
    if (!db || !userId) throw new Error("請先登入，即可收藏商品。");
    const has = favorites.includes(id);
    const { error } = has
      ? await db
          .from("kiki_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("product_id", id)
      : await db
          .from("kiki_favorites")
          .upsert({ user_id: userId, product_id: id });
    ensure(error);
    if (activeUser.current !== userId) return;
    setFavorites((prev) =>
      has ? prev.filter((x) => x !== id) : [...new Set([...prev, id])],
    );
    toast(has ? "已移除收藏" : "已加入個人衣櫃");
  };
  return (
    <Context.Provider
      value={{
        config,
        db,
        session,
        profile,
        avatar,
        loading,
        userLoading,
        products,
        catalogSource,
        catalogError,
        favorites,
        error,
        userError,
        refresh,
        refreshCatalog,
        toggleFavorite,
        toast,
      }}
    >
      {children}
      {notice && (
        <div className="toast" role="status">
          <span className="status-dot" />
          {notice}
          <button aria-label="關閉通知" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useApp() {
  const app = useContext(Context);
  if (!app) throw new Error("Missing AppProvider");
  return app;
}
