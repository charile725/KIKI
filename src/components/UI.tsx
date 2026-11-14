import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Heart,
  Loader2,
  X,
  Sparkles,
  Settings2,
  AlertCircle,
} from "lucide-react";
import type { Product } from "../../shared/types";
import { errorText } from "../../shared/validation";
import { useApp } from "../context";
import { bucket } from "../lib/data";

export const money = (price: number) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(price);
export function ModeBadge({
  mode = "demo",
  children,
}: {
  mode?: "demo" | "ai";
  children?: ReactNode;
}) {
  return (
    <span className={`mode-badge ${mode}`}>
      <span />
      {children || (mode === "demo" ? "DEMO 模式" : "AI 服務")}
    </span>
  );
}
export function Spinner({ label = "處理中" }: { label?: string }) {
  return (
    <span className="spinner">
      <Loader2 size={17} />
      {label}
    </span>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
      {retry && <button onClick={retry}>重試</button>}
    </div>
  );
}
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-label="載入中" />;
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="關閉視窗">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function SetupNotice() {
  return (
    <div className="setup-notice">
      <Settings2 size={18} />
      <div>
        <strong>先連接你的 Supabase 測試專案</strong>
        <p>
          目前可以探索展示商品。會員、分身與衣櫃需先設定 <code>.env</code>{" "}
          並執行 Migration；完整步驟請參閱專案
          README。此處不會建立假帳號或假裝儲存成功。
        </p>
      </div>
    </div>
  );
}
export function PrivateImage({
  path,
  alt,
  className = "",
  onLoad,
}: {
  path: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
}) {
  const { db, session } = useApp();
  const [url, setUrl] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    let objectUrl = "";
    setUrl("");
    setError(false);
    if (db && path)
      db.storage
        .from(bucket)
        .download(path)
        .then(({ data, error }) => {
          if (!live) return;
          if (error || !data) {
            setError(true);
            return;
          }
          objectUrl = URL.createObjectURL(data);
          setUrl(objectUrl);
        });
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [db, path, session?.user.id]);
  if (error)
    return (
      <div className={`image-error ${className}`} role="status">
        <AlertCircle />
        <span>
          圖片無法讀取
          <br />
          請重新整理或更新分身
        </span>
      </div>
    );
  return url ? (
    <img className={className} src={url} alt={alt} onLoad={onLoad} />
  ) : (
    <Skeleton className={`private-skeleton ${className}`} />
  );
}
export function ProductCard({
  product,
  reason,
  compact = false,
}: {
  product: Product;
  reason?: string;
  compact?: boolean;
}) {
  const { favorites, toggleFavorite, toast } = useApp();
  const [busy, setBusy] = useState(false);
  async function favorite() {
    if (busy) return;
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
    <article className={`product-card ${compact ? "compact" : ""}`}>
      <div className="product-visual">
        <Link to={`/products/${product.id}`} aria-label={`查看${product.name}`}>
          <img
            src={product.image}
            alt={`${product.color} ${product.name}`}
            loading="lazy"
          />
        </Link>
        <span className="product-fit">{product.fit}</span>
        <button
          className={`favorite ${favorites.includes(product.id) ? "selected" : ""}`}
          onClick={favorite}
          disabled={busy}
          aria-label={`${favorites.includes(product.id) ? "取消收藏" : "收藏"}${product.name}`}
          aria-pressed={favorites.includes(product.id)}
        >
          <Heart
            size={18}
            fill={favorites.includes(product.id) ? "currentColor" : "none"}
          />
        </button>
        <Link className="quick-try" to={`/fitting/${product.id}`}>
          在我的分身上試穿 <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="product-meta">
        <span>
          {product.category} / {product.subtitle}
        </span>
        <div>
          <Link to={`/products/${product.id}`}>
            <h3>{product.name}</h3>
          </Link>
          <strong>{money(product.price)}</strong>
        </div>
        <div className="swatches">
          {product.colors.map((c) => (
            <i key={c.name} style={{ background: c.hex }} title={c.name} />
          ))}
          <small>{product.sizes.map((s) => s.label).join(" / ")}</small>
        </div>
      </div>
      {reason && (
        <div className="recommend-reason">
          <Sparkles size={15} />
          <p>{reason}</p>
        </div>
      )}
      {reason && (
        <Link className="btn btn-dark full" to={`/fitting/${product.id}`}>
          立即試穿 <ArrowUpRight size={16} />
        </Link>
      )}
    </article>
  );
}
