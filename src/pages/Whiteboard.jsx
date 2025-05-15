// Whiteboard.jsx
import React, { useRef, useEffect, useState } from 'react';
import getUserId from '../utils/userId';
import { useParams } from 'react-router-dom';

const Whiteboard = () => {
  const { roomId = 'default' } = useParams();
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const socketRef = useRef(null);
  const drawing = useRef(false);

  const userId = useRef(getUserId());
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [strokes, setStrokes] = useState([]);
  const [myStrokes, setMyStrokes] = useState([]);
  const currentStroke = useRef([]);

  const drawBackground = () => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    const { width, height } = canvas;

    ctx.save();
    ctx.fillStyle = '#fdf6e3';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#d0cfc7';
    ctx.lineWidth = 1;
    const lineSpacing = 32;
    for (let y = lineSpacing; y < height; y += lineSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctxRef.current = ctx;

    const socket = new WebSocket(`ws://10.126.109.177:8080/ws/canvas?roomId=${roomId}`);
    socketRef.current = socket;

    socket.onopen = () => console.log('✅ WebSocket 연결됨');

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'stroke') {
        setStrokes(prev => [...prev, data]);
      }

      if (data.type === 'undo') {
        setStrokes(prev => {
          const updated = [...prev];
          const idx = [...updated].reverse().findIndex(s => s.userId === data.userId);
          if (idx !== -1) {
            updated.splice(updated.length - 1 - idx, 1);
          }
          return updated;
        });
        if (data.userId === userId.current) {
          setMyStrokes(prev => prev.slice(0, -1));
        }
      }
    };

    socket.onclose = () => console.log('❎ WebSocket 연결 종료됨');

    return () => socket.close();
  }, [roomId]);

  useEffect(() => {
    redraw(strokes);
  }, [strokes]);

  const startDrawing = (e) => {
    drawing.current = true;
    currentStroke.current = [{ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }];
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const draw = (e) => {
    if (!drawing.current) return;
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    ctxRef.current.lineTo(x, y);
    ctxRef.current.strokeStyle = color;
    ctxRef.current.lineWidth = lineWidth;
    ctxRef.current.stroke();
    currentStroke.current.push({ x, y });
  };

  const endDrawing = () => {
    if (!drawing.current) return;
    drawing.current = false;
    ctxRef.current.closePath();

    const strokeData = {
      type: 'stroke',
      userId: userId.current,
      color,
      width: lineWidth,
      points: currentStroke.current
    };

    socketRef.current.send(JSON.stringify(strokeData));
    setMyStrokes(prev => [...prev, strokeData]);
  };

  const drawStroke = (stroke) => {
    if (!stroke.points?.length) return;
    const ctx = ctxRef.current;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    const [{ x, y }, ...rest] = stroke.points;
    ctx.moveTo(x, y);
    rest.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.closePath();
  };

  const redraw = (strokeList) => {
    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    drawBackground();
    strokeList.forEach(drawStroke);
  };

  const handleUndo = () => {
    socketRef.current.send(JSON.stringify({
      type: 'undo',
      userId: userId.current
    }));
  };

  // ✅ 터치 이벤트 수동 등록
  useEffect(() => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      startDrawing({
        nativeEvent: {
          offsetX: touch.clientX - rect.left,
          offsetY: touch.clientY - rect.top
        }
      });
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      draw({
        nativeEvent: {
          offsetX: touch.clientX - rect.left,
          offsetY: touch.clientY - rect.top
        }
      });
    };

    const handleTouchEnd = () => endDrawing();

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '12px',
        padding: '12px 16px',
        display: 'flex',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        alignItems: 'center'
      }}>
        <label>
          🎨 <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label>
          ✏️ <input type="range" min="1" max="10" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} />
        </label>
        <button onClick={handleUndo} style={{
        background: '#4CAF50', // 상큼한 연두색 계열
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        padding: '6px 12px',
        fontSize: '16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
        }}>
        ⟳
        </button>

      </div>

      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: 'crosshair',
          touchAction: 'none' // 💡 스크롤 방지
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
      />
    </div>
  );
};

export default Whiteboard;
