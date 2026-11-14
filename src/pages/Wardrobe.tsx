import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  SlidersHorizontal,
  Heart,
  Bookmark,
  ScanLine,
  Trash2,
  ShieldCheck,
  Shirt,
  RefreshCw,
  Check,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { useApp } from "../context";
import { fits, type Fit, type Outfit, type Tryon } from "../../shared/types";
import { deletePrivateData, ensure, updateProfile, bucket } from "../lib/data";
import { errorText } from "../../shared/validation";
import {
  ErrorBox,
  Modal,
  ModeBadge,
  PrivateImage,
  ProductCard,
  Skeleton,
  Spinner,
} from "../components/UI";
export default function WardrobePage() {
  const [settingsOpen, setSettingsOpen] = useState(
    () => !window.matchMedia("(max-width:720px)").matches,
  );
  const { db, session, avatar, profile, products, favorites, refresh, toast } =
    useApp();
  const [tab, setTab] = useState<"outfits" | "favorites" | "history">(
      "outfits",
    ),
    [outfits, setOutfits] = useState<Outfit[]>([]),
    [tryons, setTryons] = useState<Tryon[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const [fit, setFit] = useState<Fit>(profile?.fit_preference || "微寬鬆"),
    [personalize, setPersonalize] = useState(profile?.personalize || false),
    [external, setExternal] = useState(profile?.external_ai_consent || false);
  const load = useCallback(async () => {
    if (!db || !session) return;
    setLoading(true);
    try {
      const [o, t] = await Promise.all([
        db
          .from("kiki_outfits")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false }),
        db
          .from("kiki_tryons")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false }),
      ]);
      ensure(o.error);
      ensure(t.error);
      setOutfits(o.data as Outfit[]);
      setTryons(t.data as Tryon[]);
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [db, session]);
  useEffect(() => {
    void load();
  }, [load]);
  async function savePreferences() {
    if (!db || !session) return;
    setBusy(true);
    setError("");
    try {
      await updateProfile(db, session.user.id, {
        fit_preference: fit,
        personalize,
        external_ai_consent: external,
      });
      await refresh();
      toast("穿著偏好與授權已更新");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function removeOutfit(outfit: Outfit) {
    if (!db || busy) return;
    setBusy(true);
    try {
      const { error } = await db
        .from("kiki_outfits")
        .delete()
        .eq("id", outfit.id);
      ensure(error);
      setOutfits((prev) => prev.filter((o) => o.id !== outfit.id));
      toast("已移除穿搭收藏，試穿紀錄仍保留");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function removeTryon(t: Tryon) {
    if (!db || busy) return;
    setBusy(true);
    try {
      if (t.result_path) {
        const { error } = await db.storage.from(bucket).remove([t.result_path]);
        ensure(error);
      }
      const { error } = await db.from("kiki_tryons").delete().eq("id", t.id);
      ensure(error);
      await load();
      toast("已刪除試穿圖片與相關收藏");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function removePrivate() {
    if (!db || !session) return;
    setBusy(true);
    setError("");
    try {
      await deletePrivateData(db, session.user.id);
      await refresh();
      await load();
      setPersonalize(false);
      setExternal(false);
      setConfirmDelete(false);
      toast("個人照片、分身與試穿成果已刪除");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const favoriteProducts = products.filter((p) => favorites.includes(p.id));
  const processing = tryons.some(
    (t) =>
      t.status === "processing" &&
      Date.now() - new Date(t.created_at).getTime() < 120000,
  );
  function ResultCard({ tryon, outfit }: { tryon: Tryon; outfit?: Outfit }) {
    const product = products.find((p) => p.id === tryon.product_id);
    return (
      <article className="look-card">
        <div className="look-image">
          {tryon.result_path ? (
            <PrivateImage
              path={tryon.result_path}
              alt={outfit?.name || product?.name || "私人試穿成果"}
            />
          ) : (
            <div className="look-no-image">
              <Shirt size={38} />
              <span>
                {tryon.status === "processing" ? "上次處理未完成" : "生成失敗"}
              </span>
            </div>
          )}
          <ModeBadge mode={tryon.mode} />
          <button
            className="delete-look icon-btn"
            onClick={() =>
              void (outfit ? removeOutfit(outfit) : removeTryon(tryon))
            }
            disabled={
              busy ||
              (tryon.status === "processing" &&
                Date.now() - new Date(tryon.created_at).getTime() < 120000)
            }
            aria-label={
              outfit ? `刪除穿搭收藏${outfit.name}` : `刪除試穿${product?.name}`
            }
            title={outfit ? "移除收藏（保留試穿紀錄）" : "刪除圖片與相關收藏"}
          >
            <Trash2 size={17} />
          </button>
        </div>
        <div className="look-meta">
          <span>
            {new Date(tryon.created_at).toLocaleDateString("zh-TW")} ·{" "}
            {tryon.size} / {tryon.color}
          </span>
          <h3>{outfit?.name || product?.name || "試穿紀錄"}</h3>
          {tryon.error && <p className="look-error">{tryon.error}</p>}
          <div>
            <Link
              className="text-link"
              to={`/fitting/${tryon.product_id}${tryon.status === "completed" ? `?look=${tryon.id}` : ""}`}
            >
              {tryon.status === "completed" ? "查看試穿" : "重新試穿"}
              <ArrowUpRight size={15} />
            </Link>
            <Link
              className="text-link muted"
              to={`/fitting/${tryon.product_id}`}
            >
              再次試穿 <RefreshCw size={13} />
            </Link>
          </div>
        </div>
      </article>
    );
  }
  return (
    <div className="page wardrobe-page">
      <div className="page-heading wardrobe-heading">
        <div>
          <div className="eyebrow">YOUR PERSONAL STYLE SPACE</div>
          <h1>
            {profile?.display_name} 的衣櫃
            <span className="heading-dot">。</span>
          </h1>
          <p>喜歡的輪廓、心動的單品，都好好收在這裡。</p>
        </div>
        <Link className="btn btn-dark" to="/products">
          繼續探索風格 <ArrowUpRight size={18} />
        </Link>
      </div>
      {error && <ErrorBox message={error} retry={() => void load()} />}
      <div className="wardrobe-layout">
        <aside className="wardrobe-profile">
          <div className="wardrobe-avatar">
            <span className="eyebrow">MY DIGITAL SELF</span>
            {avatar ? (
              <PrivateImage path={avatar.front_path} alt="我的分身正面照片" />
            ) : (
              <div className="no-avatar">
                <ScanLine size={55} />
                <h3>你的分身，等你啟動。</h3>
                <p>先建立分身，就能開始試穿。</p>
              </div>
            )}
            {avatar && (
              <div className="avatar-stats">
                <span>
                  {avatar.height}
                  <small>cm</small>
                </span>
                <i />
                <span>
                  {avatar.weight}
                  <small>kg</small>
                </span>
                <i />
                <span>{profile?.fit_preference}</span>
              </div>
            )}
            <Link className="btn btn-outline full" to="/avatar">
              <SlidersHorizontal size={16} />
              {avatar ? "更新照片與身形" : "建立我的分身"}
            </Link>
          </div>
          <details
            className="wardrobe-settings"
            open={settingsOpen}
            onToggle={(e) => setSettingsOpen(e.currentTarget.open)}
          >
            <summary>
              <SlidersHorizontal size={17} />
              穿著偏好與隱私設定
              <ChevronDown size={17} />
            </summary>
            <div className="wardrobe-preferences">
              <div className="eyebrow">FIT PREFERENCE</div>
              <h3>你喜歡的自在感</h3>
              <div className="preference-buttons">
                {fits.map((f) => (
                  <button
                    key={f}
                    className={fit === f ? "selected" : ""}
                    onClick={() => setFit(f)}
                  >
                    {f === fit && <Check size={12} />} {f}
                  </button>
                ))}
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={personalize}
                  onChange={(e) => setPersonalize(e.target.checked)}
                />
                <span>推薦可參考我的身形與偏好</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={external}
                  onChange={(e) => setExternal(e.target.checked)}
                />
                <span>
                  同意使用外部 AI 服務
                  <p>
                    正式 AI
                    模式時，試穿會傳送照片與商品；推薦只在上方個人化授權開啟時傳送身形與偏好。可隨時撤回；已送出至供應商的資料需依供應商政策處理。
                  </p>
                </span>
              </label>
              <button
                className="btn btn-soft full"
                onClick={() => void savePreferences()}
                disabled={busy}
              >
                {busy ? <Spinner label="儲存中" /> : "儲存偏好與授權"}
              </button>
            </div>
            <div className="wardrobe-privacy">
              <ShieldCheck size={19} />
              <h3>你的資料，由你保管</h3>
              <p>
                照片採私人權限存取，不使用公開圖片網址。你可以重新上傳，也可以刪除照片與分身。
              </p>
              <button
                className="danger-link"
                onClick={() => setConfirmDelete(true)}
                disabled={busy || processing}
              >
                <Trash2 size={14} />
                刪除照片與分身資料
              </button>
              {processing && <p>試穿處理中，請稍後重新整理再刪除。</p>}
            </div>
          </details>
        </aside>
        <section className="wardrobe-content">
          <div className="wardrobe-tabs">
            {(
              [
                ["outfits", "我的穿搭", Bookmark, outfits.length],
                ["favorites", "喜歡的商品", Heart, favoriteProducts.length],
                ["history", "試穿紀錄", ScanLine, tryons.length],
              ] as const
            ).map(([id, label, Icon, count]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
              >
                <Icon size={17} />
                {label}
                <small>{count}</small>
              </button>
            ))}
            <button
              className="icon-btn refresh-wardrobe"
              aria-label="重新整理衣櫃"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {loading ? (
            <div className="looks-grid">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="look-skeleton" />
              ))}
            </div>
          ) : tab === "favorites" ? (
            favoriteProducts.length ? (
              <div className="wardrobe-products">
                {favoriteProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <Empty
                title="先收藏一點心動。"
                description="在商品卡片點擊愛心，喜歡的單品就會出現在這裡。"
              />
            )
          ) : tab === "outfits" ? (
            outfits.length ? (
              <div className="looks-grid">
                {outfits.map((o) => {
                  const t = tryons.find((t) => t.id === o.tryon_id);
                  return t ? (
                    <ResultCard key={o.id} tryon={t} outfit={o} />
                  ) : null;
                })}
              </div>
            ) : (
              <Empty
                title="第一套喜歡的樣子，還在路上。"
                description="試穿後點擊「保存這套穿搭」，讓靈感成為你的收藏。"
              />
            )
          ) : tryons.length ? (
            <div className="looks-grid">
              {tryons.map((t) => (
                <ResultCard key={t.id} tryon={t} />
              ))}
            </div>
          ) : (
            <Empty
              title="來試一件，認識不一樣的你。"
              description="每次試穿都會記錄在這裡，也能隨時再次試穿。"
            />
          )}
          <div className="wardrobe-bottom-note">
            <ShieldCheck size={14} />
            你的收藏與照片，與帳號安全連結。
          </div>
        </section>
      </div>
      {confirmDelete && (
        <Modal
          title="刪除你的私人分身資料？"
          onClose={() => {
            if (!busy) setConfirmDelete(false);
          }}
        >
          <div className="delete-warning">
            <AlertTriangle size={30} />
            <p>
              這會永久刪除你的正面照、側面照、身形數據、全部試穿圖片與保存穿搭，並關閉個人化與外部
              AI 授權。
            </p>
            <p>
              帳號、暱稱、穿著偏好與商品愛心收藏會保留。刪除後可重新建立分身。
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
            >
              保留我的分身
            </button>
            <button
              className="btn btn-danger"
              onClick={() => void removePrivate()}
              disabled={busy}
            >
              {busy ? (
                <Spinner label="正在刪除私人資料" />
              ) : (
                <>
                  <Trash2 size={16} />
                  確認刪除
                </>
              )}
            </button>
          </div>
          {error && <ErrorBox message={error} />}
        </Modal>
      )}
    </div>
  );
}
function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state wardrobe-empty">
      <div className="empty-orbit">
        <Shirt size={42} />
      </div>
      <div className="eyebrow">A LITTLE SPACE FOR YOUR STYLE</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="btn btn-dark" to="/products">
        去發現喜歡的單品 <ArrowUpRight size={17} />
      </Link>
    </div>
  );
}
