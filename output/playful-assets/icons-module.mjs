import React from 'react';
const baseProps = (size = 18, className) => ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    'aria-hidden': true,
});
export const IconBib = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }),
    React.createElement("line", { x1: "3", y1: "9", x2: "21", y2: "9" }),
    React.createElement("path", { d: "M8 15h8" }),
    React.createElement("path", { d: "M10 12.5h4" })));
export const IconFlag = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M4 21V4" }),
    React.createElement("path", { d: "M4 4h15l-2.5 4.5L19 13H4" })));
export const IconSearch = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("circle", { cx: "11", cy: "11", r: "7" }),
    React.createElement("path", { d: "m20 20-3.5-3.5" })));
export const IconMapPin = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Z" }),
    React.createElement("circle", { cx: "12", cy: "11", r: "2.2" })));
export const IconCalendar = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("rect", { x: "3", y: "5", width: "18", height: "16", rx: "2" }),
    React.createElement("path", { d: "M16 3v4M8 3v4M3 10h18" })));
export const IconUsers = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("circle", { cx: "9", cy: "8", r: "3.5" }),
    React.createElement("path", { d: "M3 19c0-3 2.7-5 6-5s6 2 6 5" }),
    React.createElement("circle", { cx: "17", cy: "9", r: "2.5" }),
    React.createElement("path", { d: "M16 14.3c2.4.4 4.5 2 4.5 4.7" })));
export const IconLedger = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }),
    React.createElement("path", { d: "M7 9h10M7 13h6M7 17h4" }),
    React.createElement("path", { d: "M16 14.5v4M14 16.5h4" })));
export const IconQr = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1" }),
    React.createElement("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1" }),
    React.createElement("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1" }),
    React.createElement("path", { d: "M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 19h2" })));
export const IconCheckCircle = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("circle", { cx: "12", cy: "12", r: "9" }),
    React.createElement("path", { d: "m8.5 12.2 2.4 2.4 4.8-5" })));
export const IconAlert = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M12 4 3 20h18L12 4Z" }),
    React.createElement("path", { d: "M12 10v4.5" }),
    React.createElement("circle", { cx: "12", cy: "17.2", r: "0.6", fill: "currentColor" })));
export const IconClock = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("circle", { cx: "12", cy: "12", r: "9" }),
    React.createElement("path", { d: "M12 7v5l3.2 2" })));
export const IconLock = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("rect", { x: "5", y: "11", width: "14", height: "10", rx: "2" }),
    React.createElement("path", { d: "M8 11V7a4 4 0 0 1 8 0v4" })));
export const IconSwitch = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M17 3l4 4-4 4" }),
    React.createElement("path", { d: "M3 7h18" }),
    React.createElement("path", { d: "M7 21l-4-4 4-4" }),
    React.createElement("path", { d: "M21 17H3" })));
export const IconCamera = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M4 8h3l2-2.5h6L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" }),
    React.createElement("circle", { cx: "12", cy: "13.5", r: "3.5" })));
export const IconPlus = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M12 5v14M5 12h14" })));
export const IconArrowRight = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M5 12h14M13 6l6 6-6 6" })));
export const IconArrowLeft = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M19 12H5M11 6l-6 6 6 6" })));
export const IconBuilding = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("rect", { x: "4", y: "3", width: "16", height: "18", rx: "1.5" }),
    React.createElement("path", { d: "M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" })));
export const IconShield = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M12 3 5 6v6c0 4.6 3 7.9 7 9 4-1.1 7-4.4 7-9V6l-7-3Z" }),
    React.createElement("path", { d: "m9.2 12 2 2 3.8-4" })));
export const IconDownload = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M12 4v11M7.5 11.5 12 16l4.5-4.5" }),
    React.createElement("path", { d: "M4 19h16" })));
export const IconCopy = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("rect", { x: "9", y: "9", width: "11", height: "11", rx: "2" }),
    React.createElement("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })));
export const IconBag = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M6 7h12l1 13H5L6 7Z" }),
    React.createElement("path", { d: "M9 7V5a3 3 0 0 1 6 0v2" })));
export const IconShirt = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M8 4h8l4 3.5-2.2 3.2-2.3-1.2V20H8.5V9.5L6.2 10.7 4 7.5 8 4Z" })));
export const IconSliders = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("line", { x1: "4", y1: "6", x2: "20", y2: "6" }),
    React.createElement("line", { x1: "4", y1: "12", x2: "20", y2: "12" }),
    React.createElement("line", { x1: "4", y1: "18", x2: "20", y2: "18" }),
    React.createElement("circle", { cx: "9", cy: "6", r: "2", fill: "currentColor" }),
    React.createElement("circle", { cx: "15", cy: "12", r: "2", fill: "currentColor" }),
    React.createElement("circle", { cx: "10", cy: "18", r: "2", fill: "currentColor" })));
export const IconEye = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" }),
    React.createElement("circle", { cx: "12", cy: "12", r: "2.8" })));
export const IconEyeOff = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M3 3l18 18" }),
    React.createElement("path", { d: "M10.6 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a17.2 17.2 0 0 1-3.2 4.1" }),
    React.createElement("path", { d: "M6.4 6.6C3.7 8.5 2 12 2 12s3.5 6 10 6c1.9 0 3.6-.5 5-1.3" })));
export const IconMail = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("rect", { x: "3", y: "5", width: "18", height: "14", rx: "2" }),
    React.createElement("path", { d: "m3 7 9 6 9-6" })));
export const IconDevice = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("rect", { x: "3", y: "4", width: "18", height: "12", rx: "2" }),
    React.createElement("path", { d: "M8 20h8M12 16v4" })));
/* Provider marks in their official brand colors (login buttons, linked accounts). */
export const IconGoogleMark = ({ size = 18, className }) => (React.createElement("svg", { width: size, height: size, viewBox: "0 0 48 48", className: className, "aria-hidden": "true" },
    React.createElement("path", { fill: "#EA4335", d: "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" }),
    React.createElement("path", { fill: "#4285F4", d: "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" }),
    React.createElement("path", { fill: "#FBBC05", d: "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" }),
    React.createElement("path", { fill: "#34A853", d: "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" })));
export const IconLineMark = ({ size = 18, className }) => (React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", className: className, "aria-hidden": "true" },
    React.createElement("rect", { width: "24", height: "24", rx: "5.5", fill: "#06C755" }),
    React.createElement("path", { fill: "#FFFFFF", d: "M20 11.2c0-3.7-3.6-6.7-8-6.7s-8 3-8 6.7c0 3.3 2.9 6.1 6.9 6.6.3.1.6.2.7.4.1.2.1.5 0 .8l-.1.7c0 .2-.2.8.7.4.9-.4 4.8-2.8 6.5-4.8 1.2-1.3 1.3-2.6 1.3-4.1z" }),
    React.createElement("path", { fill: "#06C755", d: "M7.2 9.4v3.9h2.3v-.8H8.1V9.4zm3 0v3.9h.9V9.4zm1.8 0v3.9h.9v-2.4l1.7 2.4h.8V9.4h-.9v2.4l-1.7-2.4zm4.1 0v3.9h2.4v-.8h-1.5v-.8h1.5v-.8h-1.5v-.7h1.5v-.8z" })));
export const IconFacebookMark = ({ size = 18, className }) => (React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", className: className, "aria-hidden": "true" },
    React.createElement("circle", { cx: "12", cy: "12", r: "12", fill: "#1877F2" }),
    React.createElement("path", { fill: "#FFFFFF", d: "M16.67 15.47 17.2 12h-3.33V9.75c0-.95.47-1.88 1.95-1.88h1.51V4.92s-1.37-.23-2.68-.23c-2.74 0-4.53 1.66-4.53 4.66V12H7.08v3.47h3.04V24h3.75v-8.53z" })));
export const EventCoverArtwork = ({ motif, className }) => {
    return (React.createElement("svg", { viewBox: "0 0 400 165", className: className, role: "img", "aria-hidden": "true", preserveAspectRatio: "xMidYMid slice" },
        motif === 'mountain' && (React.createElement(React.Fragment, null,
            React.createElement("rect", { width: "400", height: "165", fill: "var(--cover-mountain-bg)" }),
            React.createElement("circle", { cx: "326", cy: "46", r: "17", fill: "var(--cover-sun)" }),
            React.createElement("path", { d: "M0 132 L92 58 L172 108 L258 42 L354 104 L400 82 L400 165 L0 165 Z", fill: "var(--cover-mountain-mid)" }),
            React.createElement("path", { d: "M0 165 Q140 112 250 132 T400 108 L400 165 Z", fill: "var(--cover-mountain-fg)" }),
            React.createElement("path", { className: "cover-route-line", d: "M44 134 Q172 104 348 118", stroke: "var(--cover-route)", strokeWidth: "2.4", strokeDasharray: "6 5", fill: "none" }),
            React.createElement("circle", { cx: "44", cy: "134", r: "4", fill: "var(--bg-surface)", stroke: "var(--cover-route)", strokeWidth: "2" }),
            React.createElement("circle", { cx: "348", cy: "118", r: "4.2", fill: "var(--cover-route)" }))),
        motif === 'coast' && (React.createElement(React.Fragment, null,
            React.createElement("rect", { width: "400", height: "165", fill: "var(--cover-coast-bg)" }),
            React.createElement("circle", { cx: "304", cy: "52", r: "20", fill: "var(--cover-sun)" }),
            React.createElement("path", { d: "M0 102 Q100 88 200 102 T400 96 L400 165 L0 165 Z", fill: "var(--cover-coast-mid)" }),
            React.createElement("path", { d: "M0 126 Q120 112 240 128 T400 118 L400 165 L0 165 Z", fill: "var(--cover-coast-fg)" }),
            React.createElement("path", { className: "cover-route-line", d: "M38 134 Q178 110 356 124", stroke: "var(--cover-route)", strokeWidth: "2.4", strokeDasharray: "6 5", fill: "none" }),
            React.createElement("circle", { cx: "38", cy: "134", r: "4", fill: "var(--bg-surface)", stroke: "var(--cover-route)", strokeWidth: "2" }),
            React.createElement("circle", { cx: "356", cy: "124", r: "4.2", fill: "var(--cover-route)" }))),
        motif === 'heritage' && (React.createElement(React.Fragment, null,
            React.createElement("rect", { width: "400", height: "165", fill: "var(--cover-heritage-bg)" }),
            React.createElement("path", { d: "M38 122 V76 H96 V122 M124 122 V64 L162 42 L200 64 V122 M228 122 V72 H302 V122 M326 122 V82 H370 V122", stroke: "var(--cover-heritage-line)", strokeWidth: "1.8", fill: "none" }),
            React.createElement("rect", { y: "122", width: "400", height: "43", fill: "var(--cover-heritage-fg)" }),
            React.createElement("path", { className: "cover-route-line", d: "M34 136 H366", stroke: "var(--cover-route)", strokeWidth: "2.4", strokeDasharray: "6 5", fill: "none" }),
            React.createElement("circle", { cx: "34", cy: "136", r: "4", fill: "var(--bg-surface)", stroke: "var(--cover-route)", strokeWidth: "2" }),
            React.createElement("circle", { cx: "366", cy: "136", r: "4.2", fill: "var(--cover-route)" }))),
        motif === 'river' && (React.createElement(React.Fragment, null,
            React.createElement("rect", { width: "400", height: "165", fill: "var(--cover-river-bg)" }),
            React.createElement("circle", { cx: "88", cy: "44", r: "14", fill: "var(--cover-sun)" }),
            React.createElement("path", { d: "M0 112 C110 88, 230 136, 400 98 L400 165 L0 165 Z", fill: "var(--cover-river-mid)" }),
            React.createElement("path", { className: "cover-route-line", d: "M42 108 Q122 76 202 108 Q282 76 358 108", stroke: "var(--cover-route)", strokeWidth: "2.4", strokeDasharray: "6 5", fill: "none" }),
            React.createElement("circle", { cx: "42", cy: "108", r: "4", fill: "var(--bg-surface)", stroke: "var(--cover-route)", strokeWidth: "2" }),
            React.createElement("circle", { cx: "358", cy: "108", r: "4.2", fill: "var(--cover-route)" }))),
        motif === 'trail' && (React.createElement(React.Fragment, null,
            React.createElement("rect", { width: "400", height: "165", fill: "var(--cover-trail-bg)" }),
            React.createElement("path", { d: "M0 84 Q95 48 190 78 T400 64", stroke: "var(--cover-trail-line)", strokeWidth: "1.5", fill: "none" }),
            React.createElement("path", { d: "M0 110 Q115 72 220 104 T400 88", stroke: "var(--cover-trail-line)", strokeWidth: "1.5", fill: "none" }),
            React.createElement("path", { d: "M0 136 Q130 104 255 128 T400 112 L400 165 L0 165 Z", fill: "var(--cover-trail-fg)" }),
            React.createElement("path", { className: "cover-route-line", d: "M40 132 Q156 96 262 122 T358 106", stroke: "var(--cover-route)", strokeWidth: "2.4", strokeDasharray: "6 5", fill: "none" }),
            React.createElement("circle", { cx: "40", cy: "132", r: "4", fill: "var(--bg-surface)", stroke: "var(--cover-route)", strokeWidth: "2" }),
            React.createElement("circle", { cx: "358", cy: "106", r: "4.2", fill: "var(--cover-route)" })))));
};
export const IconGlobe = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("circle", { cx: "12", cy: "12", r: "9" }),
    React.createElement("path", { d: "M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" })));
export const IconAward = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("circle", { cx: "12", cy: "8.5", r: "5.5" }),
    React.createElement("path", { d: "M8.6 13.1 7 21l5-2.6L17 21l-1.6-7.9" })));
export const IconBell = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M18 8a6 6 0 0 0-12 0c0 6.5-3 8.5-3 8.5h18S18 14.5 18 8Z" }),
    React.createElement("path", { d: "M13.73 20a2 2 0 0 1-3.46 0" })));
export const IconChevronDown = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "m6 9 6 6 6-6" })));
export const IconLink = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("path", { d: "M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" }),
    React.createElement("path", { d: "M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" })));
export const IconMenu = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("line", { x1: "4", y1: "7", x2: "20", y2: "7" }),
    React.createElement("line", { x1: "4", y1: "12", x2: "20", y2: "12" }),
    React.createElement("line", { x1: "4", y1: "17", x2: "20", y2: "17" })));
export const IconClose = ({ size, className }) => (React.createElement("svg", { ...baseProps(size, className) },
    React.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" }),
    React.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" })));
/**
 * รูปปกงานวิ่ง: ใช้รูปที่ผู้จัดอัปโหลด/ระบุ URL (coverImageUrl) ก่อน
 * ถ้าไม่มีหรือโหลดไม่ได้ จะ fallback ไปเป็นปก SVG ตาม coverMotif ของงาน
 */
export const EventCoverMedia = ({ event, className, imgClassName }) => {
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false), [event.coverImageUrl]);
    if (event.coverImageUrl && !failed) {
        return (React.createElement("img", { src: event.coverImageUrl, alt: event.coverImageAlt || event.titleTh, className: imgClassName ?? className, loading: "lazy", decoding: "async", onError: () => setFailed(true) }));
    }
    return React.createElement(EventCoverArtwork, { motif: event.coverMotif, className: className });
};
