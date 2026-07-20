"use client";
import { useEffect, useRef, useState } from "react";

export default function DrawingPad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#1b2a47");
  const [lineWidth, setLineWidth] = useState(3);
  const [size, setSize] = useState({ w: 800, h: 460 });

  useEffect(() => {
    const w = Math.round(Math.min(window.innerWidth * 0.9, 1400));
    const h = Math.round(Math.min(window.innerHeight * 0.65, w * 0.55));
    setSize({ w, h });
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size.w, size.h);
    }
  }, [size]);

  function pos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return { x: (point.clientX - rect.left) * scaleX, y: (point.clientY - rect.top) * scaleY };
  }

  function start(e) {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pos(e);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function save() {
    canvasRef.current.toBlob((blob) => {
      const file = new File([blob], "sketch.png", { type: "image/png" });
      onSave(file);
    }, "image/png");
  }

  return (
    <div className="drawpad-overlay">
      <div className="drawpad-box">
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="mod-sub" style={{ margin: 0 }}>Sketch a process flow</span>
          <div style={{ flex: 1 }} />
          {["#1b2a47", "#e2665d", "#f2a93b", "#4fd1c5"].map((c) => (
            <button
              key={c}
              className="small"
              style={{
                background: c,
                width: 26,
                height: 26,
                padding: 0,
                borderRadius: "50%",
                outline: color === c ? "2px solid var(--teal)" : "none",
                outlineOffset: 2,
              }}
              onClick={() => setColor(c)}
            />
          ))}
          <div style={{ width: 14 }} />
          <button className={lineWidth === 2 ? "small" : "ghost small"} onClick={() => setLineWidth(2)}>Thin</button>
          <button className={lineWidth === 3 ? "small" : "ghost small"} onClick={() => setLineWidth(3)}>Med</button>
          <button className={lineWidth === 6 ? "small" : "ghost small"} onClick={() => setLineWidth(6)}>Thick</button>
        </div>
        <canvas
          ref={canvasRef}
          width={size.w}
          height={size.h}
          className="drawpad-canvas"
          style={{ width: "100%", height: "auto" }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="ghost small" onClick={clear}>Clear</button>
          <div style={{ flex: 1 }} />
          <button className="ghost small" onClick={onCancel}>Cancel</button>
          <button className="small" onClick={save}>Add to note</button>
        </div>
      </div>
    </div>
  );
}
