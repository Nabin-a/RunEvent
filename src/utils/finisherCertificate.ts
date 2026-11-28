/** Downloads the finisher certificate as an SVG file (moved from the profile, 27 Nov 2026). */
export function downloadFinisherCertificateSvg(params: {
  runnerName: string;
  eventTitle: string;
  eventDate: string;
  distanceLabel: string;
  bibNumber: string;
  chipTime: string;
  gunTime: string;
  pace: string;
  rank: string;
  certCode: string;
}) {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="840" viewBox="0 0 1200 840">
  <rect width="1200" height="840" fill="#f7f8fa"/>
  <rect x="44" y="44" width="1112" height="752" rx="16" fill="#ffffff" stroke="#34495f" stroke-width="3"/>
  <rect x="44" y="44" width="1112" height="96" rx="14" fill="#34495f"/>
  <text x="96" y="102" fill="#f8fafc" font-family="Anuphan, sans-serif" font-size="28" font-weight="700">KRATAI · OFFICIAL FINISHER CERTIFICATE</text>
  <text x="1104" y="102" text-anchor="end" fill="#cbd5e1" font-family="Anuphan, sans-serif" font-size="18">${esc(params.certCode)}</text>
  <text x="600" y="220" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="22">ขอรับรองว่านักวิ่งผู้เข้าแข่งขัน</text>
  <text x="600" y="290" text-anchor="middle" fill="#34495f" font-family="Anuphan, sans-serif" font-size="46" font-weight="700">${esc(params.runnerName)}</text>
  <line x1="280" y1="322" x2="920" y2="322" stroke="#cbd5e1" stroke-width="2"/>
  <text x="600" y="382" text-anchor="middle" fill="#34495f" font-family="Anuphan, sans-serif" font-size="30" font-weight="700">${esc(params.eventTitle)}</text>
  <text x="600" y="424" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="20">วันที่แข่งขัน: ${esc(params.eventDate)} · ระยะทาง: ${esc(params.distanceLabel)}</text>
  <rect x="140" y="476" width="920" height="156" rx="12" fill="#f1f4f8" stroke="#cbd5e1"/>
  <text x="255" y="528" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="16">หมายเลข BIB</text>
  <text x="255" y="578" text-anchor="middle" fill="#34495f" font-family="Anuphan, sans-serif" font-size="30" font-weight="700">${esc(params.bibNumber)}</text>
  <text x="485" y="528" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="16">เวลาสุทธิ (Chip Time)</text>
  <text x="485" y="578" text-anchor="middle" fill="#157347" font-family="Anuphan, sans-serif" font-size="30" font-weight="700">${esc(params.chipTime)}</text>
  <text x="715" y="528" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="16">เฉลี่ยฝีเท้า (Pace)</text>
  <text x="715" y="578" text-anchor="middle" fill="#34495f" font-family="Anuphan, sans-serif" font-size="28" font-weight="700">${esc(params.pace)}</text>
  <text x="945" y="528" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="16">อันดับรวม (Overall)</text>
  <text x="945" y="578" text-anchor="middle" fill="#34495f" font-family="Anuphan, sans-serif" font-size="26" font-weight="700">${esc(params.rank)}</text>
  <text x="600" y="720" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="16">Gun Time: ${esc(params.gunTime)} · Verified Official Result by Kratai Timing Ledger</text>
</svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.certCode}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
