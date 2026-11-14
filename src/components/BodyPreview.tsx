import type { Body } from "../../shared/types";
export default function BodyPreview({ body }: { body: Body }) {
  const mass = Math.max(
    0.82,
    Math.min(1.3, Math.sqrt(body.weight / (body.height / 100) ** 2 / 22)),
  );
  const shoulder = (body.shoulder || 40 * mass) * 1.5;
  const chest = (body.chest || 90 * mass) * 0.57;
  const waist = (body.waist || 74 * mass) * 0.58;
  const hip = (body.hip || 94 * mass) * 0.57;
  const leg = 155 + (body.height - 165) * 0.5;
  const x = 170,
    sy = 122,
    cy = 174,
    wy = 239,
    hy = 285,
    ankle = hy + leg;
  const path = `M${x - 21} 91 L${x - 25} 111 Q${x - shoulder} 115 ${x - shoulder} ${sy} L${x - shoulder - 22} 218 L${x - shoulder - 28} 298 Q${x - shoulder - 18} 311 ${x - shoulder - 10} 298 L${x - chest - 6} 198 Q${x - chest} ${cy} ${x - waist} ${wy} Q${x - hip} 264 ${x - hip} ${hy} L${x - hip + 10} ${ankle} L${x - 7} ${ankle} L${x - 4} 314 L${x + 4} 314 L${x + 7} ${ankle} L${x + hip - 10} ${ankle} L${x + hip} ${hy} Q${x + hip} 264 ${x + waist} ${wy} Q${x + chest} ${cy} ${x + chest + 6} 198 L${x + shoulder + 10} 298 Q${x + shoulder + 18} 311 ${x + shoulder + 28} 298 L${x + shoulder + 22} 218 L${x + shoulder} ${sy} Q${x + shoulder} 115 ${x + 25} 111 L${x + 21} 91Z`;
  return (
    <div className="body-preview">
      <div className="body-grid" />
      <span className="body-status">
        <i /> LIVE BODY PREVIEW
      </span>
      <svg
        viewBox="0 0 340 510"
        role="img"
        aria-label="根據輸入即時更新的概念身形輪廓，非精準人體測量"
      >
        <defs>
          <linearGradient id="body-fill" x1="0" x2="1">
            <stop stopColor="#bbc995" />
            <stop offset=".5" stopColor="#e1e9cc" />
            <stop offset="1" stopColor="#b3c18c" />
          </linearGradient>
        </defs>
        <ellipse
          cx="170"
          cy="475"
          rx="80"
          ry="13"
          fill="#444b37"
          opacity=".09"
        />
        <ellipse cx="170" cy="64" rx="27" ry="35" fill="url(#body-fill)" />
        <path
          d={path}
          fill="url(#body-fill)"
          stroke="#7d8e5c"
          strokeWidth="1.5"
        />
        <path
          d={`M${x - waist} ${wy}H${x + waist} M${x - chest} ${cy}H${x + chest} M${x - hip} ${hy}H${x + hip}`}
          stroke="#72864c"
          strokeDasharray="3 4"
          strokeOpacity=".5"
        />
        {body.shoulder && (
          <g>
            <path
              d={`M${x - shoulder} 122H${x + shoulder}`}
              stroke="#6a7d47"
              strokeDasharray="3 3"
            />
            <text x="270" y="126">
              {body.shoulder} cm
            </text>
          </g>
        )}
        {body.chest && (
          <text x="265" y={cy + 4}>
            {body.chest} cm
          </text>
        )}
        {body.waist && (
          <text x="265" y={wy + 4}>
            {body.waist} cm
          </text>
        )}
        {body.hip && (
          <text x="265" y={hy + 4}>
            {body.hip} cm
          </text>
        )}
        <path d="M47 37V450M42 37H52M42 450H52" stroke="#8b9577" />
        <text x="15" y="249" transform="rotate(-90 15 249)">
          {body.height} cm
        </text>
      </svg>
      <div className="body-caption">
        <strong>你的輪廓，持續成形</strong>
        <span>身形示意 · 非精準測量或 3D 重建</span>
      </div>
    </div>
  );
}
