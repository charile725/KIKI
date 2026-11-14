import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  ScanLine,
  Heart,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Check,
  ShieldCheck,
  Shirt,
  MoveUpRight,
} from "lucide-react";
import { useApp } from "./context";
import MobileNavigation, {
  useMobileKeyboard,
} from "./components/MobileNavigation";
import {
  ErrorBox,
  ModeBadge,
  ProductCard,
  Skeleton,
  Spinner,
} from "./components/UI";
const AuthPage = lazy(() => import("./pages/Auth"));
const AvatarPage = lazy(() => import("./pages/Avatar"));
const CatalogPage = lazy(() => import("./pages/Catalog"));
const ProductPage = lazy(() =>
  import("./pages/Catalog").then((module) => ({ default: module.ProductPage })),
);
const FittingPage = lazy(() => import("./pages/Fitting"));
const WardrobePage = lazy(() => import("./pages/Wardrobe"));

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, userLoading, session, userError, refresh } = useApp();
  const location = useLocation();
  if (loading || userLoading)
    return (
      <div className="page loading-page">
        <Spinner label="正在讀取你的風格資料" />
        <Skeleton className="large-skeleton" />
      </div>
    );
  if (!session)
    return (
      <Navigate
        to={`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (userError)
    return (
      <div className="page">
        <ErrorBox
          message="個人資料載入失敗，請確認 Supabase Migration 與網路連線。"
          retry={() => void refresh().catch(() => {})}
        />
      </div>
    );
  return children;
}
function Header() {
  const { session, profile, db, toast } = useApp();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <header className="header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="KIKI 首頁">
          kiki<span>✳</span>
          <small>YOUR STYLE, REIMAGINED.</small>
        </Link>
        <nav className={open ? "nav open" : "nav"} aria-label="主選單">
          <NavLink to="/products">探索商品</NavLink>
          <NavLink to="/avatar">
            AI 分身工作室 <span className="tiny-new">NEW</span>
          </NavLink>
          <NavLink to="/wardrobe">我的衣櫃</NavLink>
        </nav>
        <div className="header-actions">
          <Link
            className="closet-icon icon-btn"
            to="/wardrobe"
            aria-label="個人收藏"
          >
            <Heart size={20} />
          </Link>
          {session ? (
            <>
              <Link to="/wardrobe" className="user-pill">
                <i>{profile?.display_name.slice(0, 1) || "K"}</i>
                <span>{profile?.display_name || "我的帳號"}</span>
              </Link>
              <button
                className="icon-btn logout"
                aria-label="登出"
                onClick={async () => {
                  const result = await db?.auth.signOut();
                  if (result?.error) toast("登出失敗，請重試。");
                  else toast("已安全登出");
                }}
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <Link className="login-link" to="/auth">
              登入 / 註冊 <ArrowUpRight size={15} />
            </Link>
          )}
          <button
            className="icon-btn mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label={open ? "關閉選單" : "開啟選單"}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
function Home() {
  const { products, avatar, session } = useApp();
  return (
    <>
      <section className="hero page">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" /> A NEW WAY TO FIND YOUR FIT
          </div>
          <h1>
            先試穿，
            <br />再<span className="serif-word">心動</span>
            <span className="heading-dot">。</span>
          </h1>
          <p>
            讓風格，先與你相遇。
            <br />
            建立專屬 AI 分身，探索更像你的每一種可能。
          </p>
          <div className="hero-ctas">
            <Link
              className="btn btn-dark"
              to={session ? (avatar ? "/products" : "/avatar") : "/auth"}
            >
              {avatar ? "探索我的風格" : "建立我的 AI 分身"}
              <ArrowUpRight size={19} />
            </Link>
            <Link className="text-link" to="/products">
              先逛逛商品 <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-proof">
            <div className="mini-avatars">
              <span>K</span>
              <span>I</span>
              <span>KI</span>
            </div>
            <div>
              <strong>一個分身，無限種風格</strong>
              <small>YOUR NEXT LOOK STARTS HERE</small>
            </div>
            <span className="proof-star">✳</span>
          </div>
        </div>
        <div className="hero-image">
          <img
            src="/images/hero.jpg"
            alt="時尚選品與自由探索穿搭的日常靈感"
            fetchPriority="high"
          />
          <div className="image-shade" />
          <div className="image-corner">
            KIKI STUDIO
            <br />
            <span>COLLECTION / 2026</span>
          </div>
          <div className="scan-corner top-left" />
          <div className="scan-corner bottom-right" />
          <div className="floating-fit">
            <div className="fit-icon">
              <ScanLine size={24} />
            </div>
            <div>
              <small>MADE FOR YOUR EVERYDAY</small>
              <strong>你的風格，你來定義</strong>
            </div>
            <span className="round-check">
              <Check size={16} />
            </span>
          </div>
          <div className="image-label">
            LESS GUESSING.
            <br />
            <em>MORE YOU.</em>
          </div>
          <span className="vertical-label">A PERSONAL STYLE EXPERIENCE</span>
          <div className="hero-image-badge">
            <Sparkles size={14} /> AI FITTING EXPERIENCE
          </div>
        </div>
      </section>
      <div className="feature-strip">
        <div>
          <ScanLine size={18} /> 專屬數位分身
        </div>
        <span>✳</span>
        <div>
          <Shirt size={18} /> 虛擬試穿體驗
        </div>
        <span>✳</span>
        <div>
          <Sparkles size={18} /> 個人化穿搭靈感
        </div>
        <span>✳</span>
        <div>
          <ShieldCheck size={18} /> 私人照片安全儲存
        </div>
      </div>
      <section className="page collection-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THE EVERYDAY EDIT / 01</div>
            <h2>為日常，選一點不一樣。</h2>
            <p>剛剛好的輪廓、舒服的質地，和不費力的你。</p>
          </div>
          <Link className="text-link" to="/products">
            探索全部商品 <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className="home-products">
          {products.length
            ? products
                .slice(0, 4)
                .map((p) => <ProductCard key={p.id} product={p} />)
            : Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="product-skeleton" />
              ))}
        </div>
      </section>
      <section className="page">
        <div className="studio-banner">
          <div className="banner-orbit">
            <ScanLine />
            <span>YOU</span>
          </div>
          <div>
            <div className="eyebrow">MEET YOUR DIGITAL SELF</div>
            <h2>
              試著穿上，
              <br />
              還沒遇見的自己。
            </h2>
            <p>3 個步驟，建立分身。把「適不適合」變成一場風格探索。</p>
          </div>
          <Link className="btn btn-dark" to="/avatar">
            進入分身工作室 <MoveUpRight size={18} />
          </Link>
        </div>
      </section>
      <section className="page journey">
        <div className="eyebrow">YOUR STYLE JOURNEY</div>
        <h2>從認識自己，到找到喜歡。</h2>
        <div className="journey-grid">
          {[
            ["01", "建立你的分身", "上傳照片、設定身形，留住你的獨特輪廓。"],
            [
              "02",
              "找到風格靈感",
              "告訴穿搭助理你的場合，從商品庫發現好選擇。",
            ],
            ["03", "試穿並收藏", "在照片上探索搭配，把喜歡的樣子存進衣櫃。"],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span>{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
              <ChevronRight size={20} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
function Footer() {
  return (
    <footer>
      <div className="page footer-main">
        <div>
          <Link className="brand" to="/">
            kiki<span>✳</span>
          </Link>
          <p>
            一點科技，一點直覺。
            <br />
            更多你自己的樣子。
          </p>
        </div>
        <div className="footer-links">
          <Link to="/products">探索商品</Link>
          <Link to="/avatar">分身工作室</Link>
          <Link to="/wardrobe">我的衣櫃</Link>
        </div>
        <div>
          <ModeBadge />{" "}
          <p className="disclaimer">
            展示商品與庫存僅供 Demo。
            <br />
            試穿視覺不代表實際尺寸、舒適度或合身保證。
          </p>
        </div>
      </div>
      <div className="page footer-bottom">
        <span>© 2026 KIKI STUDIO</span>
        <span>YOUR STYLE. YOUR SPACE. YOUR RULES.</span>
        <span>MADE TO BE YOU ↗</span>
      </div>
    </footer>
  );
}
export default function App() {
  const { error, config } = useApp();
  const location = useLocation();
  useMobileKeyboard();
  const onboarding =
    location.pathname === "/avatar" || location.pathname === "/auth";
  const fitting = location.pathname.startsWith("/fitting/");
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  return (
    <div
      className={`app-shell${onboarding ? " is-onboarding" : ""}${fitting ? " is-fitting" : ""}`}
    >
      <a className="skip-link" href="#main">
        跳至主要內容
      </a>
      <div className="announcement">
        你的風格探索，從這裡開始。 <span>MEET YOUR DIGITAL SELF</span>
        <ArrowUpRight size={12} />
      </div>
      <Header />
      <main id="main">
        {error && (
          <div className="page global-error">
            <ErrorBox message={error} retry={() => window.location.reload()} />
          </div>
        )}
        {config && !config.configured && (
          <div className="preview-bar">
            本機預覽 · 尚未連接 Supabase，會員與私人資料功能待設定{" "}
            <Link to="/auth">
              查看設定說明 <ArrowUpRight size={12} />
            </Link>
          </div>
        )}
        <Suspense
          fallback={
            <div className="page loading-page">
              <Spinner label="正在開啟你的風格空間" />
              <Skeleton className="large-skeleton" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/products" element={<CatalogPage />} />
            <Route path="/products/:id" element={<ProductPage />} />
            <Route
              path="/avatar"
              element={
                <RequireAuth>
                  <AvatarPage />
                </RequireAuth>
              }
            />
            <Route
              path="/fitting/:id"
              element={
                <RequireAuth>
                  <FittingPage />
                </RequireAuth>
              }
            />
            <Route
              path="/wardrobe"
              element={
                <RequireAuth>
                  <WardrobePage />
                </RequireAuth>
              }
            />
            <Route
              path="*"
              element={
                <div className="page empty-state">
                  <span>404 / LOST IN STYLE</span>
                  <h1>這個頁面還沒上架</h1>
                  <Link className="btn btn-dark" to="/products">
                    回到商品頁 <ArrowRight size={18} />
                  </Link>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      {!onboarding && <MobileNavigation />}
    </div>
  );
}
