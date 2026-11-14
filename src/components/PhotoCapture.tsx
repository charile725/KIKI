import { useEffect, useRef, useState } from "react";
import { Camera, Upload, RotateCcw, Check, AlertCircle } from "lucide-react";
import { Modal, ErrorBox, Spinner, PrivateImage } from "./UI";
import { errorText } from "../../shared/validation";
function PoseGuide() {
  return (
    <svg
      viewBox="0 0 160 340"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <ellipse cx="80" cy="30" rx="20" ry="25" />
      <path d="M69 53V64L42 74L12 159L24 166L51 109L54 181L43 321Q51 329 64 323L80 211L96 323Q109 329 117 321L106 181L109 109L136 166L148 159L118 74L91 64V53" />
      <path d="M4 4H23M4 4V23M156 4H137M156 4V23M4 336H23M4 336V317M156 336H137M156 336V317" />
    </svg>
  );
}
export interface PhotoValue {
  blob: Blob;
  url: string;
  confirmed: boolean;
}
export async function preparePhoto(file: Blob): Promise<PhotoValue> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("請使用 JPG、PNG 或 WebP 圖片；HEIC 請先轉換為 JPG。");
  if (file.size > 10 * 1024 * 1024) throw new Error("照片不能超過 10 MB。");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("無法讀取圖片，請重新拍攝或選擇其他檔案。");
  }
  try {
    if (bitmap.width < 400 || bitmap.height < 400)
      throw new Error("照片解析度太低，寬與高都需至少 400 像素。");
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error("照片像素過高，請先縮小至 4,000 萬像素以內。");
    const sample = document.createElement("canvas");
    sample.width = 48;
    sample.height = 48;
    const context = sample.getContext("2d")!;
    context.drawImage(bitmap, 0, 0, 48, 48);
    const pixels = context.getImageData(0, 0, 48, 48).data;
    const lights: number[] = [];
    for (let i = 0; i < pixels.length; i += 4)
      lights.push(
        0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2],
      );
    const average = lights.reduce((a, b) => a + b, 0) / lights.length;
    const deviation = Math.sqrt(
      lights.reduce((a, b) => a + (b - average) ** 2, 0) / lights.length,
    );
    if (average < 18) throw new Error("照片過暗，請移動到光線充足的地方。");
    if (average > 246) throw new Error("照片過亮，請避開逆光或過曝環境。");
    if (deviation < 7)
      throw new Error("照片缺乏可辨識細節，請確認畫面有包含人物。");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("照片轉換失敗，請重試。"))),
        "image/jpeg",
        0.9,
      ),
    );
    return { blob, url: URL.createObjectURL(blob), confirmed: false };
  } finally {
    bitmap.close();
  }
}
function CameraModal({
  side,
  onClose,
  onCapture,
}: {
  side: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => Promise<void>;
}) {
  const video = useRef<HTMLVideoElement>(null),
    streamRef = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [count, setCount] = useState<number | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "此瀏覽器不支援相機，或未使用 HTTPS／localhost。請改用照片上傳。",
          );
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 1600 },
          },
          audio: false,
        });
        if (!live) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
          setReady(true);
        }
      } catch (e) {
        if (live)
          setError(
            e instanceof DOMException && e.name === "NotAllowedError"
              ? "相機權限被拒絕，請允許相機存取，或改用上傳照片。"
              : errorText(e),
          );
      }
    }
    void start();
    return () => {
      live = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
    };
  }, []);
  async function capture() {
    if (!video.current) return;
    setBusy(true);
    try {
      const v = video.current;
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext("2d")!.drawImage(v, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("拍攝失敗，請重試。"))),
          "image/jpeg",
          0.94,
        ),
      );
      await onCapture(blob);
      onClose();
    } catch (e) {
      setError(errorText(e));
      setCount(null);
    } finally {
      setBusy(false);
    }
  }
  function countdown() {
    setError("");
    setCount(3);
    let left = 3;
    timer.current = setInterval(() => {
      left--;
      if (left <= 0) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setCount(null);
        void capture();
      } else setCount(left);
    }, 1000);
  }
  return (
    <Modal title={`拍攝${side ? "側面" : "正面"}照片`} onClose={onClose}>
      <p className="muted">
        {side
          ? "身體向側面轉 90°，手臂自然垂下。"
          : "面向鏡頭站直，手臂稍微離開身體。"}
        讓全身落在人形框內。
      </p>
      {error && <ErrorBox message={error} />}
      <div className="camera-stage">
        <video ref={video} muted playsInline aria-label="即時相機預覽" />
        <div className={`human-guide ${side ? "side" : ""}`}>
          <PoseGuide />
        </div>
        {count && (
          <div className="countdown" aria-live="assertive">
            {count}
          </div>
        )}
        <span className="camera-caption">
          {side ? "側面" : "正面"} · 頭頂與雙腳完整入鏡
        </span>
      </div>
      <button
        className="btn btn-dark full"
        onClick={countdown}
        disabled={!ready || count !== null || busy}
      >
        {busy ? (
          <Spinner label="檢查照片" />
        ) : (
          <>
            <Camera size={18} />
            {count ? "請保持姿勢" : "3 秒倒數拍攝"}
          </>
        )}
      </button>
    </Modal>
  );
}
export default function PhotoCapture({
  kind,
  value,
  existingPath,
  onChange,
}: {
  kind: "front" | "side";
  value: PhotoValue | null;
  existingPath?: string;
  onChange: (value: PhotoValue) => void;
}) {
  const [camera, setCamera] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const confirmed = value ? value.confirmed : !!existingPath;
  const input = useRef<HTMLInputElement>(null);
  const label = kind === "front" ? "正面" : "側面";
  async function accept(file: Blob) {
    setBusy(true);
    setError("");
    try {
      const photo = await preparePhoto(file);
      onChange(photo);
    } catch (e) {
      setError(errorText(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`photo-card ${value || existingPath ? "has-photo" : ""}`}>
      <div className="photo-card-label">
        <span>
          {kind === "front" ? "01" : "02"} / {label}照
        </span>
        {(value || existingPath) && (
          <span className="photo-ok">
            <Check size={13} />
            {confirmed ? "已確認" : "已選擇"}
          </span>
        )}
      </div>
      <div className="photo-stage">
        {value ? (
          <img src={value.url} alt={`${label}照預覽`} />
        ) : existingPath ? (
          <PrivateImage path={existingPath} alt={`目前${label}照`} />
        ) : (
          <>
            <div className={`human-guide ${kind === "side" ? "side" : ""}`}>
              <PoseGuide />
            </div>
            <div className="photo-empty">
              <Camera size={24} />
              <strong>{label}全身照</strong>
              <span>
                {kind === "front"
                  ? "面向鏡頭，手臂微張"
                  : "轉向側面，保持自然站姿"}
              </span>
            </div>
          </>
        )}
        {busy && (
          <div className="photo-processing">
            <Spinner label="檢查照片品質" />
          </div>
        )}
      </div>
      {error && (
        <div className="photo-error" role="alert">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={`上傳${label}照片`}
        className="file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void accept(file).catch(() => {});
          e.target.value = "";
        }}
      />
      <div className="photo-actions">
        <button
          className="btn btn-outline"
          onClick={() => setCamera(true)}
          disabled={busy}
        >
          <Camera size={16} />
          拍攝
        </button>
        <button
          className="btn btn-outline"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          {value ? <RotateCcw size={16} /> : <Upload size={16} />}{" "}
          {value ? "重新上傳" : "上傳照片"}
        </button>
      </div>
      {value && !confirmed && (
        <button
          className="confirm-photo"
          onClick={() => onChange({ ...value, confirmed: true })}
        >
          <Check size={15} /> 確認使用這張照片
        </button>
      )}
      {camera && (
        <CameraModal
          side={kind === "side"}
          onClose={() => setCamera(false)}
          onCapture={accept}
        />
      )}
    </div>
  );
}
