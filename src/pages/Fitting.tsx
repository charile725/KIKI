import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Bookmark,
  Check,
  Shirt,
  ScanLine,
  AlertCircle,
} from "lucide-react";
import { useApp } from "../context";
import { api } from "../lib/api";
import { ensure } from "../lib/data";
import type { Product, Tryon } from "../../shared/types";
import { errorText } from "../../shared/validation";
import {
  ErrorBox,
  ModeBadge,
  money,
  PrivateImage,
  Spinner,
} from "../components/UI";

export default function FittingPage() {
  const { id } = useParams();
  const app = useApp();
  const product = app.products.find((p) => p.id === id);
  if (!app.catalogSource)
    return (
      <div className="page loading-page">
        <Spinner label="載入商品與分身" />
      </div>
    );
  if (!app.avatar)
    return (
      <Navigate
        to={`/avatar?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (!product)
    return (
      <div className="page empty-state">
        <h1>找不到試穿商品</h1>
        <Link to="/products" className="btn btn-dark">
          重新選擇商品
        </Link>
      </div>
    );
  return <FittingStudio key={product.id} product={product} />;
}
function FittingStudio({ product }: { product: Product }) {
  const { db, session, avatar, profile, config, products, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [size, setSize] = useState(
    product.sizes.find((s) => s.label === params.get("size") && s.stock > 0)
      ?.label ||
      product.sizes.find((s) => s.stock > 0)?.label ||
      "",
  );
  const [color, setColor] = useState(
    product.colors.find((c) => c.name === params.get("color"))?.name ||
      product.color,
  );
  const [job, setJob] = useState<Tryon | null>(null),
    [status, setStatus] = useState<
      "idle" | "generating" | "completed" | "failed"
    >("idle"),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false),
    [name, setName] = useState(`${product.name} · 我的日常`);
  const initialized = useRef(false),
    mounted = useRef(true),
    inFlight = useRef(false);
  const [compare, setCompare] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function generate() {
    if (!db || !session || !avatar || inFlight.current) return;
    inFlight.current = true;
    setError("");
    setStatus("generating");
    setSaved(false);
    setJob(null);
    try {
      const result = await api<Tryon>("/api/tryons", {
        body: {
          request_id: crypto.randomUUID(),
          product_id: product.id,
          size,
          color,
        },
        db,
      });
      if (!mounted.current) return;
      setJob(result);
      if (result.status === "failed")
        throw new Error(result.error || "試穿未完成，請重試。");
      if (result.status !== "completed")
        throw new Error("試穿仍在處理中，請稍後於衣櫃查看。");
      setStatus("completed");
      setParams({ look: result.id }, { replace: true });
    } catch (e) {
      if (mounted.current) {
        setStatus("failed");
        setError(errorText(e));
      }
    } finally {
      inFlight.current = false;
    }
  }
  useEffect(() => {
    if (initialized.current || !db || !session) return;
    initialized.current = true;
    const look = params.get("look");
    if (look) {
      setStatus("generating");
      db.from("kiki_tryons")
        .select("*")
        .eq("id", look)
        .eq("user_id", session.user.id)
        .eq("product_id", product.id)
        .maybeSingle()
        .then(async ({ data, error }) => {
          if (!mounted.current) return;
          try {
            ensure(error);
            if (!data)
              throw new Error("找不到這個私人試穿紀錄，或你沒有存取權限。");
            setJob(data as Tryon);
            setSize(data.size);
            setColor(data.color);
            setStatus(
              data.status === "completed"
                ? "completed"
                : data.status === "failed"
                  ? "failed"
                  : "idle",
            );
            if (data.status === "failed")
              setError(data.error || "上次生成失敗，可重新生成。");
            if (data.status === "processing")
              setError("此試穿尚未完成。若服務曾中斷，請重新生成。");
            const { data: outfit } = await db
              .from("kiki_outfits")
              .select("name")
              .eq("tryon_id", look)
              .maybeSingle();
            if (mounted.current && outfit) {
              setSaved(true);
              setName(outfit.name);
            }
          } catch (e) {
            setStatus("failed");
            setError(errorText(e));
          }
        });
    } else if (config?.tryonMode !== "ai" || profile?.external_ai_consent) {
      void generate();
    }
    // 初次進入只啟動一次；之後變更顏色、尺寸需手動重新生成。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, session]);
  async function save() {
    if (!db || !session || !job || saving) return;
    if (!name.trim()) {
      setError("請為這套穿搭取個名字。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error } = await db.from("kiki_outfits").upsert(
        {
          user_id: session.user.id,
          tryon_id: job.id,
          name: name.trim().slice(0, 60),
        },
        { onConflict: "user_id,tryon_id" },
      );
      ensure(error);
      setSaved(true);
      toast("穿搭已保存，去衣櫃看看吧。");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  const changed = job && (job.size !== size || job.color !== color);
  return (
    <div className="page fitting-page">
      <div className="fitting-heading">
        <div>
          <Link className="text-link back-link" to="/products">
            <ArrowLeft size={15} />
            回到選品
          </Link>
          <div className="eyebrow">YOUR PERSONAL FITTING ROOM</div>
          <h1>讓喜歡，先穿上身。</h1>
        </div>
        <ModeBadge mode={job?.mode || config?.tryonMode} />
      </div>
      <div className="fitting-layout">
        <section className="fitting-canvas-panel">
          <div className="fitting-canvas-head">
            <span>
              <ScanLine size={17} /> MY DIGITAL FITTING
            </span>
            <button
              className={compare ? "active" : ""}
              onClick={() => setCompare(!compare)}
              disabled={status !== "completed"}
            >
              {" "}
              {compare ? "只看試穿" : "對照原始照片"}
            </button>
          </div>
          <div className={`fitting-stage ${compare ? "compare" : ""}`}>
            {compare && avatar && (
              <figure>
                <PrivateImage path={avatar.front_path} alt="原始正面照片" />
                <figcaption>原始照片</figcaption>
              </figure>
            )}
            <figure>
              {status === "completed" && job?.result_path ? (
                <>
                  <PrivateImage
                    path={job.result_path}
                    alt={`${product.name} 的${job.mode === "demo" ? "Demo 示意合成" : "AI 試穿"}結果`}
                  />
                  <figcaption>
                    {job.mode === "demo"
                      ? "DEMO / 照片與商品示意疊合"
                      : "AI 生成試穿 · 僅供視覺參考"}
                  </figcaption>
                </>
              ) : (
                <div className="fitting-placeholder">
                  {status === "generating" ? (
                    <>
                      <div className="generation-orbit">
                        <Shirt size={54} />
                        <i />
                      </div>
                      <h2>
                        {config?.tryonMode === "ai"
                          ? "正在生成試穿影像"
                          : "正在製作 Demo 示意合成"}
                      </h2>
                      <p>讀取私人照片，結合選定的服裝素材。</p>
                      <div
                        className="indeterminate-progress"
                        role="progressbar"
                        aria-label="試穿處理中"
                      />
                      <div className="generation-steps">
                        <span>
                          <Check size={13} />
                          商品已選定
                        </span>
                        <span className="active">
                          <Spinner label="影像處理中" />
                        </span>
                        <span>完成</span>
                      </div>
                    </>
                  ) : status === "failed" ? (
                    <>
                      <AlertCircle size={46} />
                      <h2>這次試穿沒有完成</h2>
                      <p>確認連線與分身照片後，再試一次。</p>
                      <button
                        className="btn btn-dark"
                        onClick={() => void generate()}
                      >
                        <RefreshCw size={17} />
                        重新試穿
                      </button>
                    </>
                  ) : (
                    <>
                      <ScanLine size={62} />
                      <h2>準備好看見新的自己？</h2>
                      <p>選擇尺寸與顏色後開始試穿。</p>
                    </>
                  )}
                </div>
              )}
            </figure>
          </div>
          <div className="simulation-note">
            <Sparkles size={15} />
            <p>
              {(job?.mode || config?.tryonMode) === "ai"
                ? "AI 圖像結果只供造型參考，不代表實際合身。"
                : "Demo 模擬：將本人照片與商品示意圖疊合，沒有 AI 生成、姿態辨識或服裝變形。"}
              身形輪廓數值不控制這張影像。
              {(job?.mode || config?.tryonMode) === "demo"
                ? "示意素材固定使用主色與比例，尺寸與其他色票僅保存為穿搭選項，不改變圖片。"
                : ""}
            </p>
          </div>
        </section>
        <aside className="fitting-sidebar">
          <div className="fitting-product">
            <img src={product.image} alt={product.name} />
            <div>
              <span>{product.subtitle}</span>
              <h2>{product.name}</h2>
              <strong>{money(product.price)}</strong>
              <small>{product.fit}版型</small>
            </div>
          </div>
          <label className="field-label">
            尺寸<span>服裝尺寸，非人體量測</span>
          </label>
          <div className="size-options">
            {product.sizes.map((s) => (
              <button
                key={s.label}
                disabled={!s.stock || status === "generating"}
                className={size === s.label ? "selected" : ""}
                onClick={() => setSize(s.label)}
              >
                {s.label}
                {!s.stock && <small>缺貨</small>}
              </button>
            ))}
          </div>
          <label className="field-label">
            顏色<span>{color}</span>
          </label>
          <div className="color-options">
            {product.colors.map((c) => (
              <button
                key={c.name}
                aria-label={c.name}
                style={{ background: c.hex }}
                className={color === c.name ? "selected" : ""}
                onClick={() => setColor(c.name)}
                disabled={status === "generating"}
              >
                {color === c.name && <Check size={14} />}
              </button>
            ))}
          </div>
          <div className="fitting-personal">
            <span className="status-dot" />
            <strong>沿用你的私人分身</strong>
            <small>
              {avatar?.height} cm · {avatar?.weight} kg ·{" "}
              {profile?.fit_preference}
            </small>
            <Link
              to={`/avatar?next=${encodeURIComponent(`/fitting/${product.id}`)}`}
            >
              調整分身 <ArrowUpRight size={13} />
            </Link>
          </div>
          {config?.tryonMode === "ai" && !profile?.external_ai_consent && (
            <ErrorBox message="正式 AI 試穿需要外部資料傳送授權，請到個人衣櫃開啟。" />
          )}
          {error && <ErrorBox message={error} />}
          <button
            className="btn btn-dark full"
            onClick={() => void generate()}
            disabled={
              status === "generating" ||
              !size ||
              (config?.tryonMode === "ai" && !profile?.external_ai_consent)
            }
          >
            {status === "generating" ? (
              <Spinner label="試穿處理中" />
            ) : (
              <>
                <RefreshCw size={16} />
                {changed
                  ? "以新選項重新生成"
                  : job
                    ? "重新生成試穿"
                    : config?.tryonMode === "ai"
                      ? "生成 AI 試穿"
                      : "生成 Demo 試穿"}
              </>
            )}
          </button>
          {status === "completed" && (
            <div className="save-outfit">
              <label>
                為這個樣子取個名字
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSaved(false);
                  }}
                  maxLength={60}
                  placeholder="例如：星期一的提案穿搭"
                />
              </label>
              {changed && (
                <p className="fine-print">
                  你已切換選項。保存時會使用這張結果的原選項：{job?.size}／
                  {job?.color}。
                </p>
              )}
              <button
                className={`btn ${saved ? "btn-saved" : "btn-soft"} full`}
                onClick={() => void save()}
                disabled={saving || saved}
              >
                {saving ? (
                  <Spinner label="儲存中" />
                ) : saved ? (
                  <>
                    <Check size={17} />
                    已保存至個人衣櫃
                  </>
                ) : (
                  <>
                    <Bookmark size={17} />
                    保存這套穿搭
                  </>
                )}
              </button>
              {saved && (
                <Link className="text-link" to="/wardrobe">
                  打開我的衣櫃 <ArrowUpRight size={15} />
                </Link>
              )}
            </div>
          )}
          <div className="switch-product">
            <h3>也試試這一件</h3>
            <div>
              {products
                .filter((p) => p.id !== product.id)
                .slice(0, 3)
                .map((p) => (
                  <Link key={p.id} to={`/fitting/${p.id}`} title={p.name}>
                    <img src={p.image} alt={p.name} />
                    <span>{p.name}</span>
                  </Link>
                ))}
            </div>
          </div>
        </aside>
      </div>
      <div
        className="mobile-fitting-action"
        role="region"
        aria-label="手機試穿操作"
      >
        <div>
          <strong>
            {saved
              ? "已收藏這套穿搭"
              : status === "completed"
                ? "喜歡這個樣子嗎？"
                : status === "generating"
                  ? "正在準備你的新造型"
                  : "再試一次，找到喜歡"}
          </strong>
          <span>
            {status === "completed" && job
              ? `${job.size} · ${job.color}`
              : product.name}
          </span>
        </div>
        {saved ? (
          <Link className="btn btn-dark" to="/wardrobe">
            前往我的衣櫃
            <ArrowUpRight size={17} />
          </Link>
        ) : status === "completed" ? (
          <button
            className="btn btn-dark"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? (
              <Spinner label="儲存中" />
            ) : (
              <>
                <Bookmark size={17} />
                收藏這套穿搭
              </>
            )}
          </button>
        ) : (
          <button
            className="btn btn-dark"
            onClick={() => void generate()}
            disabled={
              status === "generating" ||
              !size ||
              (config?.tryonMode === "ai" && !profile?.external_ai_consent)
            }
          >
            {status === "generating" ? (
              <Spinner label="試穿處理中" />
            ) : (
              <>
                <RefreshCw size={16} />
                開始試穿
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
