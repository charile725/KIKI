import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Compass, Sparkles, ScanLine, Shirt } from "lucide-react";

// VisualViewport follows the visible screen when a mobile software keyboard opens.
// Keep navigation out of the keyboard area, and restore it when the viewport recovers.
export function useMobileKeyboard() {
  useEffect(() => {
    const viewport = window.visualViewport;
    function update() {
      const field = document.activeElement;
      const editing =
        field instanceof HTMLElement &&
        (field.matches(
          'input:not([type="checkbox"]):not([type="range"]),textarea',
        ) ||
          field.isContentEditable);
      const covered = viewport ? window.innerHeight - viewport.height : 0;
      document.body.classList.toggle(
        "is-keyboard-open",
        window.innerWidth <= 720 && editing && covered > 120,
      );
    }
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.body.classList.remove("is-keyboard-open");
    };
  }, []);
}

export default function MobileNavigation() {
  const { pathname, search } = useLocation();
  const agent =
    pathname === "/products" &&
    new URLSearchParams(search).get("agent") === "1";
  const items = [
    { to: "/", label: "首頁", Icon: Home, active: pathname === "/" },
    {
      to: "/products",
      label: "選品",
      Icon: Compass,
      active: pathname.startsWith("/products") && !agent,
    },
    {
      to: "/products?agent=1",
      label: "AI 穿搭",
      Icon: Sparkles,
      active: agent,
    },
    {
      to: "/avatar",
      label: "我的分身",
      Icon: ScanLine,
      active: pathname.startsWith("/avatar") || pathname.startsWith("/fitting"),
    },
    {
      to: "/wardrobe",
      label: "衣櫃",
      Icon: Shirt,
      active: pathname === "/wardrobe",
    },
  ];
  return (
    <nav className="mobile-bottom-nav" aria-label="手機底部導覽">
      {items.map(({ to, label, Icon, active }) => (
        <Link
          key={to}
          to={to}
          className={active ? "active" : ""}
          aria-current={active ? "page" : undefined}
        >
          <span>
            <Icon size={22} strokeWidth={active ? 2 : 1.6} />
          </span>
          <strong>{label}</strong>
        </Link>
      ))}
    </nav>
  );
}
