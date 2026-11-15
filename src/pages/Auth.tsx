import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  ScanLine,
  ShieldCheck,
  Eye,
  EyeOff,
  MailCheck,
} from "lucide-react";
import { useApp } from "../context";
import { authSchema, errorText } from "../../shared/validation";
import { ErrorBox, SetupNotice, Spinner } from "../components/UI";
import { api } from "../lib/api";

export default function AuthPage() {
  const { db, session, userLoading, config, userError } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"register" | "login" | "reset" | "recovery">(
    params.get("recovery") === "1" ? "recovery" : "register",
  );
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const redirect = params.get("redirect");
  const safeRedirect =
    redirect?.startsWith("/") &&
    !redirect.startsWith("//") &&
    !redirect.startsWith("/auth")
      ? redirect
      : "/products";
  useEffect(() => {
    if (
      session &&
      !userLoading &&
      !userError &&
      mode !== "recovery" &&
      mode !== "reset"
    )
      navigate(safeRedirect, { replace: true });
  }, [session, userLoading, userError, navigate, safeRedirect, mode]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!db) {
      setError("請先完成 Supabase 連線設定。");
      return;
    }
    setBusy(true);
    try {
      if (mode === "reset") {
        if (!email.includes("@")) throw new Error("請輸入有效的電子郵件。");
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?recovery=1`,
        });
        if (error) throw error;
        setNotice("若此信箱已註冊，將會收到密碼重設郵件。");
        return;
      }
      if (mode === "recovery") {
        if (password.length < 6) throw new Error("密碼至少需要 6 個字元。");
        if (password !== confirm) throw new Error("兩次輸入的密碼不一致。");
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        setMode("login");
        setNotice("密碼已更新，請繼續登入。");
        return;
      }
      const credentials = authSchema.parse({ email: email.trim(), password });
      if (mode === "register") {
        if (name.trim().length > 40) throw new Error("暱稱最多 40 個字。");
        if (config?.instantSignup) {
          await api("/api/auth/register", {
            body: { ...credentials, display_name: name.trim() },
          });
          const { error } = await db.auth.signInWithPassword(credentials);
          if (error) throw error;
          return;
        }
        const { data, error } = await db.auth.signUp({
          ...credentials,
          options: {
            data: { display_name: name.trim() || credentials.email.split("@")[0].slice(0, 40) },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        if (error) throw error;
        if (!data.session)
          setNotice(
            "註冊資料已送出。請前往信箱點擊驗證連結，再回來登入建立分身。若你已有帳號，可直接切換登入。",
          );
      } else {
        const { error } = await db.auth.signInWithPassword(credentials);
        if (error) throw error;
      }
    } catch (e) {
      const msg = errorText(e);
      setError(
        /Invalid login credentials/.test(msg)
          ? "信箱或密碼不正確，請再次確認。"
          : /already.*registered|already.*exists/i.test(msg)
            ? "這個信箱已註冊，請切換登入。"
          : /Email not confirmed/.test(msg)
            ? "請先前往信箱驗證帳號。"
            : msg,
      );
    } finally {
      setBusy(false);
    }
  }
  function switchMode(next: typeof mode) {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
    setConfirm("");
  }
  return (
    <div className="page auth-layout">
      <aside className="auth-story">
        <div className="eyebrow">YOUR STYLE JOURNEY STARTS HERE</div>
        <h1>
          嗨，
          <br />
          未來的你。
        </h1>
        <p>
          把每一次穿搭，
          <br />
          變成更認識自己的小小冒險。
        </p>
        <div className="auth-art">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <ScanLine size={110} strokeWidth={0.7} />
          <span>YOUR DIGITAL SELF</span>
        </div>
        <div className="auth-security">
          <ShieldCheck size={18} /> 私人照片與資料，只有登入後的你能存取
        </div>
      </aside>
      <section className="auth-form">
        <div className="eyebrow">WELCOME TO KIKI</div>
        <h2>
          {mode === "register"
            ? "建立你的風格帳號"
            : mode === "login"
              ? "歡迎回到你的衣櫃"
              : mode === "reset"
                ? "找回你的帳號"
                : "設定新密碼"}
        </h2>
        <p>{mode === "register"
          ? config?.instantSignup ? "Email 和密碼就能開始，註冊後直接登入。" : "填寫 Email 和密碼，輕鬆開始探索。"
          : "登入後，繼續你的風格旅程。"}</p>
        {(mode === "login" || mode === "register") && (
          <div className="auth-tabs">
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              註冊帳號
            </button>
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              會員登入
            </button>
          </div>
        )}
        {config && !config.configured && <SetupNotice />}
        {(error || userError) && (
          <ErrorBox
            message={error || "個人資料讀取失敗，請確認已套用 Migration。"}
          />
        )}{" "}
        {notice && (
          <div className="success-box" role="status">
            <MailCheck size={22} />
            {notice}
          </div>
        )}
        <form onSubmit={submit} className="stack-form">
          {mode === "register" && (
            <label>
              你的暱稱（選填）
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="希望我們怎麼稱呼你？"
                maxLength={40}
                autoComplete="nickname"
              />
            </label>
          )}
          <label>
            電子郵件
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              disabled={mode === "recovery"}
            />
          </label>
          {mode !== "reset" && (
            <label>
              密碼
              <div className="password-input">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 個字元"
                  minLength={6}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "隱藏密碼" : "顯示密碼"}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}
          {mode === "recovery" && (
            <label>
              確認密碼
              <input
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="再次輸入密碼"
                autoComplete="new-password"
                required
                minLength={6}
              />
            </label>
          )}
          <button
            className="btn btn-dark full"
            disabled={busy || !config?.configured}
          >
            {busy ? (
              <Spinner label="正在連接你的風格空間" />
            ) : mode === "register" ? (
              <>
                註冊並開始探索 <ArrowUpRight size={18} />
              </>
            ) : mode === "login" ? (
              <>
                登入 KIKI <ArrowUpRight size={18} />
              </>
            ) : mode === "reset" ? (
              "寄送重設郵件"
            ) : (
              "更新密碼"
            )}
          </button>
        </form>
        {mode === "register" && <p className="fine-print">照片與身形可稍後建立；外部 AI 資料傳送會另行詢問授權。</p>}
        {mode === "login" ? (
          <button
            className="text-link auth-secondary"
            onClick={() => switchMode("reset")}
          >
            忘記密碼？
          </button>
        ) : mode === "reset" ? (
          <button
            className="text-link auth-secondary"
            onClick={() => switchMode("login")}
          >
            返回登入
          </button>
        ) : null}
        <Link to="/products" className="auth-explore">
          先逛逛商品，不急著決定 <ArrowUpRight size={14} />
        </Link>
      </section>
    </div>
  );
}
