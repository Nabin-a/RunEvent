import React, { useState } from 'react';
import { RaceEvent } from '../types';
import { EventCoverMedia, IconAlert, IconCamera, IconCheckCircle } from './Icons';

import { tx, txf } from '../i18n';
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export interface EventMediaPatch {
  coverImageUrl?: string;
  coverImageAlt?: string;
  galleryImageUrls?: string[];
}

function isSafeImageUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (v.startsWith('data:image/')) return true;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return v.startsWith('/');
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** ย่อรูปให้ด้านยาวไม่เกิน 1600px และบีบอัดเป็น JPEG เพื่อลดขนาดข้อมูลที่จัดเก็บ */
async function downscaleImage(dataUrl: string, maxEdge = 1600): Promise<string> {
  const img = new Image();
  img.decoding = 'async';
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.82);
}

/**
 * ผู้จัดตั้งรูปปกและภาพประกอบของงานวิ่ง
 * รูปปกถูกใช้ในการ์ดหน้าแรก หน้ารายละเอียดงาน และแผงซ้ายของหน้าสมัคร (/events/:code/register)
 */
export const EventMediaManager: React.FC<{
  event: RaceEvent;
  canEdit: boolean;
  onSave: (patch: EventMediaPatch) => void;
}> = ({ event, canEdit, onSave }) => {
  const [coverUrl, setCoverUrl] = useState(event.coverImageUrl ?? '');
  const [coverAlt, setCoverAlt] = useState(event.coverImageAlt ?? '');
  const [gallery, setGallery] = useState<string[]>(event.galleryImageUrls ?? []);
  const [galleryDraft, setGalleryDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  React.useEffect(() => {
    setCoverUrl(event.coverImageUrl ?? '');
    setCoverAlt(event.coverImageAlt ?? '');
    setGallery(event.galleryImageUrls ?? []);
    setError(null);
    setSaved(false);
  }, [event.id, event.coverImageUrl, event.coverImageAlt, event.galleryImageUrls]);

  const handleFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'cover' | 'gallery'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      setError(tx("รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP"));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(tx("ไฟล์ใหญ่เกิน 8 MB กรุณาเลือกรูปที่เล็กลง"));
      return;
    }
    try {
      const dataUrl = await downscaleImage(await readFileAsDataUrl(file));
      setError(null);
      setSaved(false);
      if (target === 'cover') {
        setCoverUrl(dataUrl);
        if (!coverAlt) setCoverAlt(event.titleTh);
      } else if (gallery.length < 3) {
        setGallery((prev) => [...prev, dataUrl]);
      }
    } catch {
      setError(tx("อ่านไฟล์รูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    }
  };

  const previewEvent: RaceEvent = {
    ...event,
    coverImageUrl: coverUrl.trim() || undefined,
    coverImageAlt: coverAlt.trim() || undefined,
  };

  return (
    <section className="clean-panel event-media-panel">
      <div className="section-title-bar">
        <div>
          <h2>{tx("รูปปกและภาพประกอบงานวิ่ง")}</h2>
          <p className="muted-block">
            {tx("รูปปกจะแสดงบนการ์ดหน้าแรก หน้ารายละเอียดงาน และแผงซ้ายของหน้าสมัครวิ่ง ถ้ายังไม่ใส่รูป ระบบจะใช้ภาพปกลายเส้นตามประเภทเส้นทางของงานแทน")}
          </p>
        </div>
      </div>

      <div className="event-media-grid">
        <div className="event-media-preview">
          <EventCoverMedia event={previewEvent} className="event-media-preview-img" />
          <span className="muted-inline">
            {coverUrl ? tx("ตัวอย่างรูปปกที่จะแสดง") : tx("ยังไม่มีรูปปก — กำลังแสดงภาพปกลายเส้นของงาน")}
          </span>
        </div>

        <div className="event-media-form">
          <div className="form-row">
            <label htmlFor={`cover-url-${event.id}`}>{tx("ลิงก์รูปปก (https://…)")}</label>
            <input
              id={`cover-url-${event.id}`}
              type="url"
              value={coverUrl.startsWith('data:') ? '' : coverUrl}
              placeholder={coverUrl.startsWith('data:') ? tx("ใช้ไฟล์ที่อัปโหลดอยู่") : 'https://example.com/cover.jpg'}
              disabled={!canEdit}
              onChange={(e) => {
                setCoverUrl(e.target.value);
                setSaved(false);
              }}
            />
          </div>

          <div className="cta-inline-row">
            <label className={`btn-secondary file-pick-btn ${!canEdit ? 'is-disabled' : ''}`}>
              <IconCamera size={15} />
              <span>{tx("อัปโหลดรูปปก (JPG/PNG/WebP ≤ 8 MB)")}</span>
              <input
                type="file"
                accept={ALLOWED_MIME.join(',')}
                disabled={!canEdit}
                onChange={(e) => handleFile(e, 'cover')}
              />
            </label>
            {coverUrl && canEdit && (
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => {
                  setCoverUrl('');
                  setSaved(false);
                }}
              >
                {tx("ลบรูปปก")}
              </button>
            )}
          </div>

          <div className="form-row">
            <label htmlFor={`cover-alt-${event.id}`}>{tx("คำอธิบายรูป (สำหรับโปรแกรมอ่านหน้าจอ)")}</label>
            <input
              id={`cover-alt-${event.id}`}
              type="text"
              value={coverAlt}
              disabled={!canEdit}
              placeholder={tx("เช่น นักวิ่งขึ้นเขาดอยสุเทพยามเช้า")}
              onChange={(e) => {
                setCoverAlt(e.target.value);
                setSaved(false);
              }}
            />
          </div>

          <div className="form-row">
            <label htmlFor={`gallery-url-${event.id}`}>{tx("ภาพประกอบเพิ่มเติม (สูงสุด 3 รูป)")}</label>
            <div className="cta-inline-row">
              <input
                id={`gallery-url-${event.id}`}
                type="url"
                value={galleryDraft}
                disabled={!canEdit || gallery.length >= 3}
                placeholder="https://example.com/photo.jpg"
                onChange={(e) => setGalleryDraft(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                disabled={!canEdit || gallery.length >= 3 || !galleryDraft.trim()}
                onClick={() => {
                  if (!isSafeImageUrl(galleryDraft)) {
                    setError(tx("ลิงก์รูปต้องขึ้นต้นด้วย https:// หรือ http://"));
                    return;
                  }
                  setGallery((prev) => [...prev, galleryDraft.trim()]);
                  setGalleryDraft('');
                  setSaved(false);
                }}
              >
                {tx("เพิ่มลิงก์")}
              </button>
              <label
                className={`btn-ghost-sm file-pick-btn ${
                  !canEdit || gallery.length >= 3 ? 'is-disabled' : ''
                }`}
              >
                <span>{tx("อัปโหลด")}</span>
                <input
                  type="file"
                  accept={ALLOWED_MIME.join(',')}
                  disabled={!canEdit || gallery.length >= 3}
                  onChange={(e) => handleFile(e, 'gallery')}
                />
              </label>
            </div>
          </div>

          {gallery.length > 0 && (
            <ul className="event-media-thumbs">
              {gallery.map((src, i) => (
                <li key={`${src.slice(0, 40)}-${i}`}>
                  <img src={src} alt={txf("ภาพประกอบที่ {0}", i + 1)} />
                  {canEdit && (
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      onClick={() => {
                        setGallery((prev) => prev.filter((_, idx) => idx !== i));
                        setSaved(false);
                      }}
                    >
                      {tx("ลบ")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {error && (
            <div className="error-callout" role="alert">
              <IconAlert size={16} />
              <span>{tx(error)}</span>
            </div>
          )}
          {saved && (
            <div className="success-callout" role="status">
              <IconCheckCircle size={16} />
              <span>{tx("บันทึกรูปปกและภาพประกอบแล้ว")}</span>
            </div>
          )}

          {canEdit && (
            <div className="cta-inline-row">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (!isSafeImageUrl(coverUrl)) {
                    setError(tx("ลิงก์รูปปกต้องขึ้นต้นด้วย https:// หรือ http://"));
                    return;
                  }
                  setError(null);
                  onSave({
                    coverImageUrl: coverUrl.trim() || undefined,
                    coverImageAlt: coverAlt.trim() || undefined,
                    galleryImageUrls: gallery,
                  });
                  setSaved(true);
                }}
              >
                {tx("บันทึกรูปปก")}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
