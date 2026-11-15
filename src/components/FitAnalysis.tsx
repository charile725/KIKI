import { useId, useState, type CSSProperties } from "react";
import { AlertTriangle, ChevronDown, CircleHelp, Shirt } from "lucide-react";
import { Link } from "react-router-dom";
import { analyzeFit } from "../../shared/fit-analysis";
import type { Body, Fit, Product } from "../../shared/types";
import "./FitAnalysis.css";

const levels = ["偏緊", "稍緊", "剛剛好", "稍鬆", "偏鬆"];
const formatScore = (score: number) => score > 0 ? `+${score}` : `${score}`;

export default function FitAnalysis({ product, size, preference, body, personalized = false, compact = false }: {
  product: Product;
  size: string;
  preference?: Fit;
  body?: Body | null;
  personalized?: boolean;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(!compact);
  const [showHelp, setShowHelp] = useState(false);
  const id = useId();
  const baseline = personalized ? preference || "合身" : "合身";
  const { metrics, notice } = analyzeFit(product, size, baseline, personalized ? body || null : null);
  const visibleMetrics = expanded ? metrics : metrics.filter((metric) => ["silhouette", "chest"].includes(metric.key));
  return (
    <section className="fit-analysis" aria-labelledby={`${id}-title`}>
      <div className="fit-analysis-heading">
        <h3 id={`${id}-title`}>{personalized ? "根據你的偏好分析" : "商品版型分析"}</h3>
        <button className="fit-analysis-help-button" type="button" aria-expanded={showHelp}
          aria-controls={`${id}-help`} onClick={() => setShowHelp(!showHelp)}>
          <CircleHelp size={15} aria-hidden="true" />查看說明
        </button>
      </div>
      <p className="fit-analysis-context">{size ? `${size} 號 · ` : ""}{personalized ? `你的偏好：${baseline}` : "以「合身」偏好為比較基準"}<span>示範估算</span></p>
      {showHelp && (
        <div className="fit-analysis-help" id={`${id}-help`}>
          <p>0 表示符合偏好，負數表示較緊，正數表示較鬆。版型依商品標示比較；合身度依胸圍差與偏好預留量估算，每差 6 cm 為一格，最高到 ±2。</p>
          <p>預留量：貼身 4、合身 10、微寬鬆 16、Oversized 24 cm。缺少數據的項目不評分；未依材質彈性校正，請搭配尺寸表參考。</p>
        </div>
      )}
      <div className="fit-analysis-chart" role="list" aria-label="版型與尺寸偏好分析">
        <div className="fit-analysis-axis" aria-hidden="true">
          {levels.map((level, index) => <span key={level}>{level}<b>{formatScore(index - 2)}</b></span>)}
        </div>
        {visibleMetrics.map((metric) => (
          <div className={`fit-analysis-row${metric.score === null ? " is-unavailable" : ""}`} key={metric.key}
            role="listitem" aria-label={`${metric.label}：${metric.score === null ? "資料不足" : `${formatScore(metric.score)}，${levels[metric.score + 2]}`}。${metric.reason}`}>
            <span className="fit-analysis-label">{metric.label}</span>
            <div className="fit-analysis-track" aria-hidden="true">
              {levels.map((level, index) => <i key={level} style={{ left: `${index * 25}%` }} />)}
              {metric.score !== null
                ? <><span className="fit-analysis-range" style={{ left: `${(metric.score + 2) * 25}%` }} /><span className="fit-analysis-marker" style={{ "--fit-position": `${(metric.score + 2) * 25}%` } as CSSProperties}>{formatScore(metric.score)}</span></>
                : <span className="fit-analysis-missing">資料不足</span>}
            </div>
          </div>
        ))}
        <div className="fit-analysis-legend" aria-hidden="true"><span>−2 太緊</span><span>0 符合偏好</span><span>+2 太鬆</span></div>
      </div>
      <div className="fit-analysis-notice">
        <AlertTriangle size={23} aria-hidden="true" />
        <div><strong>穿搭提醒</strong><p>{notice}</p></div>
        <Shirt className="fit-analysis-shirt" size={44} strokeWidth={1.2} aria-hidden="true" />
      </div>
      <div className="fit-analysis-footer">
        <span>僅供選碼參考，實際穿著感受依材質與身形而異。</span>
        <button type="button" aria-expanded={expanded} aria-controls={`${id}-details`} onClick={() => setExpanded(!expanded)}>
          {expanded ? "收合分析" : "完整分析"}<ChevronDown size={14} className={expanded ? "is-expanded" : ""} aria-hidden="true" />
        </button>
      </div>
      <div id={`${id}-details`} hidden={!expanded} className="fit-analysis-details">
        {metrics.filter((metric) => metric.score === null).map((metric) => <p key={metric.key}><strong>{metric.label}</strong> · {metric.reason}</p>)}
        {!personalized
          ? <Link to="/wardrobe">開啟身形與偏好授權，查看個人分析 →</Link>
          : !body?.chest && <Link to={`/avatar?next=${encodeURIComponent(`/products/${product.id}`)}`}>補充胸圍，查看合身度分析 →</Link>}
      </div>
    </section>
  );
}
