import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Camera,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  PartyPopper,
} from "lucide-react";
import { useApp } from "../context";
import { fits, type Body, type Fit } from "../../shared/types";
import { bodySchema, errorText } from "../../shared/validation";
import { saveAvatar } from "../lib/data";
import { ErrorBox, Spinner } from "../components/UI";
import BodyPreview from "../components/BodyPreview";
import PhotoCapture, { type PhotoValue } from "../components/PhotoCapture";
const fitDetails = [
  ["貼身", "貼合線條，俐落有型", "FITTED"],
  ["合身", "剛剛好的活動空間", "REGULAR"],
  ["微寬鬆", "自然放鬆，留一點餘裕", "RELAXED"],
  ["Oversized", "大一點，更有自己的輪廓", "OVERSIZED"],
];
export default function AvatarPage() {
  const { db, session, avatar, profile, refresh } = useApp();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0),
    [body, setBody] = useState<Body>({
      height: avatar?.height || 165,
      weight: avatar?.weight || 58,
      ...(avatar?.shoulder ? { shoulder: avatar.shoulder } : {}),
      ...(avatar?.chest ? { chest: avatar.chest } : {}),
      ...(avatar?.waist ? { waist: avatar.waist } : {}),
      ...(avatar?.hip ? { hip: avatar.hip } : {}),
    });
  const [front, setFront] = useState<PhotoValue | null>(null),
    [side, setSide] = useState<PhotoValue | null>(null);
  const photoRefs = useRef<{
    front: PhotoValue | null;
    side: PhotoValue | null;
  }>({ front: null, side: null });
  const [fit, setFit] = useState<Fit>(profile?.fit_preference || "微寬鬆"),
    [personalize, setPersonalize] = useState(profile?.personalize || false),
    [advanced, setAdvanced] = useState(!!avatar?.chest);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      if (photoRefs.current.front)
        URL.revokeObjectURL(photoRefs.current.front.url);
      if (photoRefs.current.side)
        URL.revokeObjectURL(photoRefs.current.side.url);
    },
    [],
  );
  function photo(kind: "front" | "side", value: PhotoValue) {
    const old = photoRefs.current[kind];
    if (old && old.url !== value.url) URL.revokeObjectURL(old.url);
    photoRefs.current[kind] = value;
    if (kind === "front") setFront(value);
    else setSide(value);
  }
  function next() {
    setError("");
    if (
      step === 0 &&
      (!(front || avatar?.front_path) || !(side || avatar?.side_path))
    ) {
      setError("請先提供正面與側面照片，再進入身形設定。");
      return;
    }
    if (
      step === 0 &&
      ((front && !front.confirmed) || (side && !side.confirmed))
    ) {
      setError("請先確認正面與側面照片，再繼續下一步。");
      return;
    }
    if (step === 1) {
      const result = bodySchema.safeParse(body);
      if (!result.success) {
        setError(errorText(result.error));
        return;
      }
    }
    setStep((s) => s + 1);
    window.scrollTo({ top: 120, behavior: "smooth" });
  }
  async function complete() {
    if (!db || !session) return;
    setError("");
    setBusy(true);
    try {
      const parsed = bodySchema.parse(body);
      await saveAvatar(
        db,
        session.user.id,
        parsed,
        fit,
        personalize,
        { front: front?.blob || null, side: side?.blob || null },
        avatar,
      );
      await refresh();
      setStep(3);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const nextPath = params.get("next");
  const destination =
    nextPath?.startsWith("/") &&
    !nextPath.startsWith("//") &&
    !nextPath.startsWith("/auth")
      ? nextPath
      : "/products";
  if (step === 3)
    return (
      <div className="page avatar-success">
        <div className="success-burst">
          <PartyPopper size={52} />
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
        <div className="eyebrow">LEVEL 01 / STYLE UNLOCKED</div>
        <h1>認識新的你。</h1>
        <p>
          你的數位分身已儲存。
          <br />
          偏好的 <strong>{fit}</strong> 輪廓，也已加入你的風格檔案。
        </p>
        <div className="success-card">
          <BodyPreview body={body} />
          <span>
            <Check size={17} /> 已安全儲存至私人衣櫃
          </span>
        </div>
        <div className="success-actions">
          <Link
            className="btn btn-dark"
            to={destination === "/products" ? `/products?agent=1` : destination}
          >
            開始試穿 <ArrowUpRight size={18} />
          </Link>
          <button className="btn btn-outline" onClick={() => setStep(1)}>
            調整分身
          </button>
          <Link className="text-link" to="/products">
            前往商品頁 <ArrowRight size={16} />
          </Link>
        </div>
        <p className="fine-print">
          分身輪廓為概念視覺化；照片試穿使用獨立模組，不由身形數值直接控制。
        </p>
      </div>
    );
  return (
    <div className="page studio-page">
      <div className="page-heading">
        <div className="eyebrow">YOUR DIGITAL SELF / KIKI STUDIO</div>
        <h1>{avatar ? "讓分身，更接近你。" : "一點一點，認識你的輪廓。"}</h1>
        <p>3 個小步驟，開啟你的專屬風格空間。</p>
      </div>
      <ol className="stepper">
        {[
          ["照片準備", Camera],
          ["身形設定", SlidersHorizontal],
          ["穿著偏好", Sparkles],
        ].map(([title, Icon], i) => (
          <li
            key={i}
            className={step === i ? "active" : step > i ? "done" : ""}
          >
            <button
              onClick={() => {
                if (i < step) {
                  setStep(i);
                  setError("");
                }
              }}
              disabled={i > step}
              aria-current={step === i ? "step" : undefined}
            >
              <span>
                {step > i ? (
                  <Check size={17} />
                ) : typeof Icon !== "string" ? (
                  <Icon size={17} />
                ) : (
                  i + 1
                )}
              </span>
              <div>
                <small>STEP 0{i + 1}</small>
                <strong>{String(title)}</strong>
              </div>
            </button>
          </li>
        ))}
      </ol>
      {error && <ErrorBox message={error} />}
      {step === 0 ? (
        <section className="wizard-panel">
          <div className="panel-title">
            <span>01</span>
            <div>
              <h2>先和鏡頭裡的自己打聲招呼</h2>
              <p>
                準備正面、側面各一張全身照，背景簡單、光線均勻，效果更清楚。
              </p>
            </div>
          </div>
          <div className="photo-grid">
            <PhotoCapture
              kind="front"
              value={front}
              existingPath={avatar?.front_path}
              onChange={(v) => photo("front", v)}
            />
            <PhotoCapture
              kind="side"
              value={side}
              existingPath={avatar?.side_path}
              onChange={(v) => photo("side", v)}
            />
            <aside className="photo-tips">
              <span className="eyebrow">A GOOD PHOTO MAKES A DIFFERENCE</span>
              <h3>讓分身好好認識你</h3>
              {[
                ["01", "穿著簡單貼合的衣物", "避免厚重大衣或手持物遮住身形。"],
                [
                  "02",
                  "全身完整入鏡",
                  "頭頂到腳底都留一點空間，鏡頭與身體保持水平。",
                ],
                [
                  "03",
                  "站在明亮、單純的背景前",
                  "避免逆光；正面手臂微張，側面自然站立。",
                ],
              ].map(([n, t, d]) => (
                <div className="tip" key={n}>
                  <i>{n}</i>
                  <div>
                    <strong>{t}</strong>
                    <p>{d}</p>
                  </div>
                </div>
              ))}
              <div className="privacy-hint">
                <ShieldCheck size={20} />
                <p>
                  照片儲存於 Supabase
                  私人空間，可在個人衣櫃刪除。基本品質檢查只檢查格式、尺寸與亮度，不包含人臉或姿勢辨識。
                </p>
              </div>
            </aside>
          </div>
        </section>
      ) : step === 1 ? (
        <section className="wizard-panel">
          <div className="panel-title">
            <span>02</span>
            <div>
              <h2>調整到熟悉的自己</h2>
              <p>從身高體重開始，右側輪廓會即時回應你的調整。</p>
            </div>
          </div>
          <div className="body-layout">
            <div className="body-fields">
              <div className="two-fields">
                {(
                  [
                    ["height", "身高", "cm", 120, 220],
                    ["weight", "體重", "kg", 30, 250],
                  ] as const
                ).map(([key, label, unit, min, max]) => (
                  <label key={key}>
                    {label}
                    <div className="unit-input">
                      <input
                        type="number"
                        aria-label={label}
                        min={min}
                        max={max}
                        value={Number.isFinite(body[key]) ? body[key] : ""}
                        onChange={(e) =>
                          setBody({
                            ...body,
                            [key]:
                              e.target.value === ""
                                ? NaN
                                : Number(e.target.value),
                          })
                        }
                      />
                      <span>{unit}</span>
                    </div>
                    <input
                      type="range"
                      aria-label={`調整${label}`}
                      min={min}
                      max={max}
                      value={Number.isFinite(body[key]) ? body[key] : min}
                      onChange={(e) =>
                        setBody({ ...body, [key]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="body-note">
                <Sparkles size={18} />
                <p>
                  身高與體重只用於產生<strong>概念輪廓</strong>
                  ，不是精準人體測量。補充實際量測數據，可以更直觀地調整示意圖。
                </p>
              </div>
              <button
                className="advanced-toggle"
                aria-expanded={advanced}
                onClick={() => setAdvanced(!advanced)}
              >
                <SlidersHorizontal size={17} />
                進階身形數據 <span>{advanced ? "收合 −" : "選填 +"}</span>
              </button>
              {advanced && (
                <div className="advanced-fields">
                  {(
                    [
                      ["shoulder", "肩寬", 25, 70],
                      ["chest", "胸圍", 50, 200],
                      ["waist", "腰圍", 40, 200],
                      ["hip", "臀圍", 50, 200],
                    ] as const
                  ).map(([key, label, min, max]) => (
                    <label key={key}>
                      {label}
                      <div className="unit-input">
                        <input
                          type="number"
                          min={min}
                          max={max}
                          value={body[key] ?? ""}
                          placeholder="選填"
                          aria-label={label}
                          onChange={(e) =>
                            setBody({
                              ...body,
                              [key]:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            })
                          }
                        />
                        <span>cm</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <button
                className="text-link skip-advanced"
                onClick={() => {
                  setBody({ height: body.height, weight: body.weight });
                  setAdvanced(false);
                }}
              >
                略過進階數據，僅保留身高體重 <ArrowRight size={14} />
              </button>
            </div>
            <BodyPreview
              body={{
                ...body,
                height: Number.isFinite(body.height) ? body.height : 165,
                weight: Number.isFinite(body.weight) ? body.weight : 58,
              }}
            />
          </div>
        </section>
      ) : (
        <section className="wizard-panel fit-panel">
          <div className="panel-title">
            <span>03</span>
            <div>
              <h2>舒服，是你說了算。</h2>
              <p>你喜歡衣服怎麼貼近身體？這會成為穿搭助理的推薦參考。</p>
            </div>
          </div>
          <div className="fit-options" role="radiogroup" aria-label="穿著偏好">
            {fitDetails.map(([name, desc, en], i) => (
              <button
                key={name}
                role="radio"
                aria-checked={fit === name}
                className={fit === name ? "fit-option selected" : "fit-option"}
                onClick={() => setFit(fits[i])}
              >
                <span className="fit-selection">
                  {fit === name ? <Check size={14} /> : null}
                </span>
                <div className={`fit-illustration fit-${i}`}>
                  <div className="fit-person" />
                  <div className="fit-garment" />
                </div>
                <small>{en}</small>
                <strong>{name}</strong>
                <p>{desc}</p>
              </button>
            ))}
          </div>
          <label className="checkbox-label consent-box">
            <input
              type="checkbox"
              checked={personalize}
              onChange={(e) => setPersonalize(e.target.checked)}
            />
            <div>
              <strong>讓穿搭助理參考我的身形與 Fit Preference</strong>
              <p>
                只使用你已輸入並授權的數據。取消勾選時，推薦只依當次需求與商品資料；外部
                AI 傳送須另外授權。
              </p>
            </div>
          </label>
          <div className="fine-print">
            偏好可隨時調整。推薦與視覺模擬都不代表實際合身或舒適度保證。
          </div>
        </section>
      )}
      <div className="wizard-bottom">
        <div>
          <ShieldCheck size={15} /> 你的資料，由你掌握
        </div>
        <div>
          {step > 0 && (
            <button
              className="btn btn-outline"
              onClick={() => {
                setStep((s) => s - 1);
                setError("");
              }}
              disabled={busy}
            >
              <ArrowLeft size={16} />
              上一步
            </button>
          )}
          {step < 2 ? (
            <button className="btn btn-dark" onClick={next}>
              下一步 <ArrowRight size={17} />
            </button>
          ) : (
            <button className="btn btn-dark" onClick={complete} disabled={busy}>
              {busy ? (
                <Spinner label="儲存分身中" />
              ) : (
                <>
                  完成，開啟風格旅程 <Sparkles size={17} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
