"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n/config";

const MAX_SIDE = 1920;
const MAX_BYTES = 3 * 1024 * 1024;
type Box = { x: number; y: number; w: number; h: number };

/**
 * Lets the sender black out names, emails or anything else before a screenshot leaves the browser. The result is drawn onto a
 * fresh canvas and re-encoded, so the covered pixels are really gone (not just hidden in a layer) and the file carries no metadata.
 */
export function RedactEditor({ file, lang, onDone, onCancel }: { file: File; lang: Lang; onDone: (f: File) => void; onCancel: () => void }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const cv = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [drag, setDrag] = useState<Box | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dead = false;                                           // a dev-mode remount revokes the first URL; its late error must not show
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { if (!dead) { img.current = im; setReady(true); } };
    im.onerror = () => { if (!dead) setError(t("이미지를 열 수 없습니다.", "Cannot open this image.")); };
    im.src = url;
    return () => { dead = true; URL.revokeObjectURL(url); };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps -- t only depends on lang

  // the output size: the original, shrunk so that neither side passes MAX_SIDE
  const size = () => {
    const im = img.current!, k = Math.min(1, MAX_SIDE / Math.max(im.naturalWidth, im.naturalHeight));
    return { w: Math.max(1, Math.round(im.naturalWidth * k)), h: Math.max(1, Math.round(im.naturalHeight * k)) };
  };

  useEffect(() => {
    if (!ready || !cv.current) return;
    const c = cv.current, { w, h } = size(), g = c.getContext("2d")!;
    c.width = w; c.height = h;
    g.drawImage(img.current!, 0, 0, w, h);
    g.fillStyle = "#000";
    for (const b of [...boxes, ...(drag ? [drag] : [])]) g.fillRect(b.x, b.y, b.w, b.h);
  }, [ready, boxes, drag]);

  const at = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * cv.current!.width, y: ((e.clientY - r.top) / r.height) * cv.current!.height };
  };
  const rect = (a: { x: number; y: number }, b: { x: number; y: number }): Box => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  const start = useRef<{ x: number; y: number } | null>(null);

  async function finish() {
    setBusy(true);
    const c = cv.current!;
    // the canvas already holds the covered image; encode it as PNG, or JPEG if the PNG is too big
    let blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    let ext = "png";
    if (blob && blob.size > MAX_BYTES) { blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85)); ext = "jpg"; }
    if (!blob || blob.size > MAX_BYTES) { setBusy(false); return setError(t("이미지가 너무 큽니다.", "The image is too large.")); }
    onDone(new File([blob], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type: blob.type }));
  }

  return (
    <div className="rd" role="dialog" aria-label={t("스크린샷에서 가릴 부분 지정", "Cover parts of the screenshot")}>
      <p className="dim">{t("닉네임·이메일·채팅처럼 보여주고 싶지 않은 곳을 끌어서 검게 가리세요. 가린 부분은 파일에서 완전히 지워집니다.", "Drag over anything you do not want to share (names, emails, chat). Covered pixels are removed from the file for good.")}</p>
      {error && <p role="alert" className="fb-err">{error}</p>}
      <canvas
        ref={cv} className="rd-canvas"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = at(e); }}
        onPointerMove={(e) => { if (start.current) setDrag(rect(start.current, at(e))); }}
        onPointerUp={(e) => { if (start.current) { const b = rect(start.current, at(e)); if (b.w > 3 && b.h > 3) setBoxes((x) => [...x, b]); } start.current = null; setDrag(null); }}
      />
      <div className="rd-bar">
        <button type="button" className="btn" disabled={boxes.length === 0} onClick={() => setBoxes((x) => x.slice(0, -1))}>{t("되돌리기", "Undo")}</button>
        <button type="button" className="btn btn-pri" disabled={!ready || busy} onClick={finish}>{boxes.length ? t("가려서 사용", "Use with covers") : t("가릴 곳 없음, 사용", "Nothing to cover, use it")}</button>
        <button type="button" className="btn" onClick={onCancel}>{t("취소", "Cancel")}</button>
      </div>
    </div>
  );
}
