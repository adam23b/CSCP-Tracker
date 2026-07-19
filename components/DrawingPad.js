"use client";
import { useRef, useState } from "react";

export default function DrawingPad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#1b2a47");

  function pos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
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
    ctx.lineWidth = 3;
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
              style={{ background: c, width: 26, height: 26, padding: 0, borderRadius: "50%" }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <canvas
          width={560}
          height={360}
          className="drawpad-canvas"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          ref={(el) => {
            canvasRef.current = el;
            if (el && !el.dataset.inited) {
              el.dataset.inited = "1";
              const ctx = el.getContext("2d");
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, el.width, el.height);
            }
          }}
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
