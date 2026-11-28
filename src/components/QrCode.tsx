import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * A real, scannable QR code drawn as SVG (27 Nov 2026, user request: the check-in token on
 * the success step and the order history is a QR the check-in desk can scan).
 * Always black on white with a 4-module quiet zone, in every theme, so phone and desk
 * scanners can read it.
 */
export const QrCode: React.FC<{ value: string; size?: number; label: string; className?: string }> = ({
  value,
  size = 160,
  label,
  className,
}) => {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      }
    }
    return { count: n, path: d };
  }, [value]);
  const quiet = 4;
  const box = count + quiet * 2;
  return (
    <svg
      className={`qr-code${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox={`${-quiet} ${-quiet} ${box} ${box}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect x={-quiet} y={-quiet} width={box} height={box} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
};
