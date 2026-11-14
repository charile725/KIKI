import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowLeft,
  Search,
  Sparkles,
  Send,
  SlidersHorizontal,
  X,
  Heart,
  Ruler,
  Check,
  ChevronDown,
} from "lucide-react";
import { useApp } from "../context";
import { api } from "../lib/api";
import type { RecommendationResult } from "../../shared/types";
import { errorText, recommendationSchema } from "../../shared/validation";
import {
  ErrorBox,
  ModeBadge,
  money,
  ProductCard,
  Skeleton,
  Spinner,
} from "../components/UI";

function StyleAgent() {
  const { db, session, profile, avatar, products, config } = useApp();
  const results = useRef<HTMLDivElement>(null);
  const [prompt, setPrompt] = useState(""),
    [question, setQuestion] = useState(""),
    [result, setResult] = useState<RecommendationResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!result || !window.matchMedia("(max-width:720px)").matches) return;
    const timer = setTimeout(
      () =>
        results.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      100,
    );
    return () => clearTimeout(timer);
  }, [result]);
  async function ask(value: string) {
    setError("");
    try {
      recommendationSchema.parse({ prompt: value });
      if (!session || !db)
        throw new Error("登入後，穿搭助理就能從商品庫為你配對。");
      setBusy(true);
      setQuestion(value);
      setResult(null);
      const response = await api<RecommendationResult>("/api/recommend", {
        body: { prompt: value },
        db,
      });
      setResult(response);
      setPrompt("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const suggestions = [
    "上台報告適合的外套",
    "幫我搭一套韓系穿搭",
    "我喜歡微寬鬆，預算 2000 元以下",
  ];
  return (
    <section className="style-agent" id="style-agent">
      <div className="agent-top">
        <div className="agent-symbol">
          <Sparkles size={23} />
        </div>
        <div>
          <span className="eyebrow">KIKI STYLE COMPANION</span>
          <h2>今天，想成為哪一種自己？</h2>
        </div>
        <ModeBadge mode={config?.recommendationMode} />
      </div>
      <p className="agent-intro">
        告訴我你的場合、心情或喜歡的輪廓，一起從現有商品找到穿搭靈感。
      </p>
      <div className="agent-context">
        <span className="status-dot" />
        {profile?.personalize ? (
          <>
            已授權參考：{profile.fit_preference}
            {avatar ? ` · ${avatar.height} cm / ${avatar.weight} kg` : ""}
          </>
        ) : (
          "依本次需求與商品資料推薦 · 未使用私人身形"
        )}{" "}
        <Link to="/wardrobe">
          調整授權 <ArrowUpRight size={11} />
        </Link>
      </div>
      <div className="prompt-chips">
        {suggestions.map((s) => (
          <button key={s} onClick={() => void ask(s)} disabled={busy}>
            {s}
            <ArrowUpRight size={13} />
          </button>
        ))}
      </div>
      <form
        className="agent-input"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          (e.currentTarget as HTMLFormElement).querySelector("input")?.blur();
          void ask(prompt);
        }}
      >
        <Sparkles size={19} />
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="例如：明天要提案，想穿得俐落但不要太正式…"
          aria-label="向穿搭助理描述需求"
          maxLength={500}
          disabled={busy}
        />
        <button
          aria-label="送出穿搭需求"
          disabled={busy || prompt.trim().length < 2}
        >
          {busy ? <Spinner label="配對中" /> : <Send size={19} />}
        </button>
      </form>
      {!session && (
        <p className="agent-login">
          <Link to="/auth?redirect=%2Fproducts%3Fagent%3D1">
            登入後開啟我的推薦 <ArrowUpRight size={13} />
          </Link>
        </p>
      )}
      {config?.recommendationMode !== "ai" && (
        <p className="agent-mode-hint">
          Demo：依標籤、版型、庫存與預算進行規則配對，未呼叫語言模型。
        </p>
      )}
      {error && <ErrorBox message={error} />}{" "}
      {(busy || result) && (
        <div className="agent-results" ref={results}>
          <div className="agent-question">
            <span>YOU</span>
            <p>{question}</p>
          </div>
          {busy ? (
            <>
              <p className="agent-working">
                <Spinner label="正在比對現有商品與尺寸資料" />
              </p>
              <div className="recommend-grid">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="recommend-skeleton" />
                ))}
              </div>
            </>
          ) : (
            result && (
              <>
                <div className="agent-answer">
                  <Sparkles size={18} />
                  <p>{result.message}</p>
                  <ModeBadge mode={result.mode} />
                </div>
                <div className="recommend-grid">
                  {result.recommendations.map((r) => {
                    const product = products.find((p) => p.id === r.product_id);
                    return product ? (
                      <ProductCard
                        key={r.product_id}
                        product={product}
                        reason={r.reason}
                        compact
                      />
                    ) : null;
                  })}
                </div>
                <p className="fine-print">
                  推薦只根據現有商品資料，不保證實際尺碼或舒適度。
                  {result.mode === "ai"
                    ? "AI 理由可能出錯，商品卡片與尺碼表為準。"
                    : ""}
                </p>
              </>
            )
          )}
        </div>
      )}
    </section>
  );
}
export default function CatalogPage() {
  const { products, error, catalogSource } = useApp();
  const [params] = useSearchParams();
  const agent = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState("全部"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("curated");
  const [showAgent, setShowAgent] = useState(
    () =>
      params.get("agent") === "1" ||
      !window.matchMedia("(max-width:720px)").matches,
  );
  useEffect(() => {
    if (params.get("agent")) {
      setShowAgent(true);
      const timer = setTimeout(
        () =>
          agent.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        100,
      );
      return () => clearTimeout(timer);
    }
    if (window.matchMedia("(max-width:720px)").matches) setShowAgent(false);
  }, [params]);
  const filtered = useMemo(() => {
    const list = products.filter(
      (p) =>
        (category === "全部" || p.category === category) &&
        [p.name, p.category, p.fit, ...p.tags].some((t) =>
          t.toLowerCase().includes(search.toLowerCase()),
        ),
    );
    return sort === "low"
      ? list.sort((a, b) => a.price - b.price)
      : sort === "high"
        ? list.sort((a, b) => b.price - a.price)
        : list;
  }, [products, category, search, sort]);
  return (
    <div className="page catalog-page">
      <div className="page-heading catalog-heading">
        <div>
          <div className="eyebrow">EXPLORE YOUR EVERYDAY / COLLECTION 2026</div>
          <h1>穿上喜歡的自己。</h1>
          <p>從一件好單品開始，慢慢找到你的風格。</p>
        </div>
        <button
          className={`btn ${showAgent ? "btn-soft" : "btn-dark"}`}
          onClick={() => setShowAgent(!showAgent)}
        >
          <Sparkles size={17} />
          {showAgent ? "收合穿搭助理" : "開啟穿搭助理"}
          {showAgent ? <ChevronDown size={16} /> : <ArrowUpRight size={16} />}
        </button>
      </div>
      <div ref={agent} className="agent-anchor" hidden={!showAgent}>
        <StyleAgent />
      </div>
      <div className="catalog-toolbar">
        <div className="category-tabs" aria-label="商品分類">
          {["全部", ...new Set(products.map((p) => p.category))].map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
              {c === "全部" && <small>{products.length}</small>}
            </button>
          ))}
        </div>
        <div className="catalog-controls">
          <label className="search-box">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋風格、商品"
              aria-label="搜尋商品"
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="清除搜尋">
                <X size={14} />
              </button>
            )}
          </label>
          <label className="sort-select">
            <SlidersHorizontal size={15} />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="商品排序"
            >
              <option value="curated">精選排序</option>
              <option value="low">價格由低到高</option>
              <option value="high">價格由高到低</option>
            </select>
          </label>
        </div>
      </div>
      <div className="catalog-count">
        <span>{filtered.length} 件風格選品</span>
        <span>
          展示商品 · 示範庫存
          {catalogSource === "preview-fixtures" ? " · 尚未連線 Supabase" : ""}
        </span>
      </div>
      {error ? (
        <ErrorBox message={error} />
      ) : !catalogSource ? (
        <div className="product-grid">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="product-skeleton" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="product-grid">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Search size={32} />
          <h2>還沒找到這個風格</h2>
          <p>換個關鍵字，或讓穿搭助理給你一些靈感。</p>
          <button
            className="btn btn-outline"
            onClick={() => {
              setSearch("");
              setCategory("全部");
            }}
          >
            清除篩選
          </button>
        </div>
      )}
    </div>
  );
}
export function ProductPage() {
  const { id } = useParams();
  const { products, catalogSource, toggleFavorite, favorites, toast } =
    useApp();
  const product = products.find((p) => p.id === id);
  const [size, setSize] = useState(""),
    [color, setColor] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setSize("");
    setColor("");
  }, [id]);
  if (!catalogSource)
    return (
      <div className="page loading-page">
        <Spinner label="載入商品資料" />
        <Skeleton className="large-skeleton" />
      </div>
    );
  if (!product)
    return (
      <div className="page empty-state">
        <h1>找不到這件商品</h1>
        <Link className="btn btn-dark" to="/products">
          回到選品
        </Link>
      </div>
    );
  const selectedSize =
      size || product.sizes.find((s) => s.stock > 0)?.label || "",
    selectedColor = color || product.color;
  async function favorite() {
    if (!product || busy) return;
    setBusy(true);
    try {
      await toggleFavorite(product.id);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page product-page">
      <Link className="text-link back-link" to="/products">
        <ArrowLeft size={15} />
        返回所有商品
      </Link>
      <div className="product-detail">
        <div className="detail-visual">
          <span>THE KIKI EVERYDAY EDIT</span>
          <img src={product.image} alt={product.name} />
          <small>{product.color} · 商品圖片為示意素材，其他色以色票為準</small>
        </div>
        <section className="detail-copy">
          <div className="eyebrow">{product.subtitle}</div>
          <h1>{product.name}</h1>
          <p className="detail-price">
            {money(product.price)} <span>TWD</span>
          </p>
          <p>{product.description}</p>
          <div className="detail-select">
            <label>
              顏色 <strong>{selectedColor}</strong>
            </label>
            <div className="color-options">
              {product.colors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.name)}
                  style={{ background: c.hex }}
                  className={selectedColor === c.name ? "selected" : ""}
                  aria-label={c.name}
                  aria-pressed={selectedColor === c.name}
                >
                  {selectedColor === c.name && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>
          <div className="detail-select">
            <label>
              尺寸 <strong>{selectedSize}</strong>
            </label>
            <div className="size-options">
              {product.sizes.map((s) => (
                <button
                  key={s.label}
                  disabled={!s.stock}
                  className={selectedSize === s.label ? "selected" : ""}
                  onClick={() => setSize(s.label)}
                >
                  {s.label}
                  {!s.stock && <small>缺貨</small>}
                </button>
              ))}
            </div>
          </div>
          <div className="detail-cta">
            <Link
              className="btn btn-dark"
              to={`/fitting/${product.id}?size=${encodeURIComponent(selectedSize)}&color=${encodeURIComponent(selectedColor)}`}
            >
              在我的分身上試穿 <ArrowUpRight size={18} />
            </Link>
            <button
              className="btn btn-outline"
              onClick={() => void favorite()}
              disabled={busy}
              aria-label="收藏商品"
              aria-pressed={favorites.includes(product.id)}
            >
              <Heart
                size={20}
                fill={favorites.includes(product.id) ? "currentColor" : "none"}
              />
            </button>
          </div>
          <div className="product-info">
            <div>
              <span>版型</span>
              <strong>{product.fit}</strong>
            </div>
            <div>
              <span>材質</span>
              <strong>{product.material}</strong>
            </div>
            <div>
              <span>商品類別</span>
              <strong>{product.category}</strong>
            </div>
          </div>
          <details className="size-table" open>
            <summary>
              <Ruler size={17} />
              商品尺寸表 <ChevronDown size={15} />
            </summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>尺寸</th>
                    <th>胸圍 cm</th>
                    <th>衣長 cm</th>
                    <th>示範庫存</th>
                  </tr>
                </thead>
                <tbody>
                  {product.sizes.map((s) => (
                    <tr key={s.label}>
                      <th>{s.label}</th>
                      <td>{s.chest}</td>
                      <td>{s.length}</td>
                      <td>{s.stock > 0 ? `${s.stock} 件` : "缺貨"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>數值為服裝尺寸，非人體尺寸。請依實際穿著需求與商品資訊評估。</p>
          </details>
        </section>
      </div>
    </div>
  );
}
