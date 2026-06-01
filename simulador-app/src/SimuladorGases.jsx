import React, { useState, useEffect, useRef, useCallback } from 'react';
import { updatePhysics, generateParticles } from './motorFisico';

const SimuladorGases = () => {
  // --- ESTADOS SEGUROS Y CLAMPING (DoS Prevention) ---
  const [temperatura, setTemperatura] = useState(5); // 1 a 20
  const [numParticulas, setNumParticulas] = useState(500); // 1 a 5000 (Límite estricto)
  const [volumen, setVolumen] = useState(100); // 10 a 100 (Porcentaje)

  const [metricas, setMetricas] = useState({ fps: 0, presion: 0 });
  
  // Referencias mutables que NO disparan re-render de React (Crítico para rendimiento O(N))
  const canvasRef = useRef(null);
  const requestRef = useRef();
  const particlesRef = useRef([]);
  const lastTimeRef = useRef(performance.now());
  const pressureAccumulatorRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastMetricsUpdateRef = useRef(performance.now());

  // Redimensionamiento seguro con Debounce
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const containerRef = useRef(null);

  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      // Debounce de 200ms para evitar sobrecarga del hilo principal durante el resize
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (containerRef.current) {
          setCanvasSize({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight
          });
        }
      }, 200);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Init size

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Handler de inputs seguro
  const handleInput = (setter, min, max) => (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    // Clamping estricto de seguridad para evitar inyección de valores que rompan la memoria
    val = Math.max(min, Math.min(max, val));
    setter(val);
  };

  // --- BUCLE DE RENDERIZADO Y FÍSICAS (requestAnimationFrame) ---
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const timeNow = performance.now();
    // Delta time capado a 30ms para evitar saltos gigantes en lag spikes
    const dt = Math.min((timeNow - lastTimeRef.current) / 1000, 0.03) * 60; // Normalizado a ~60FPS
    lastTimeRef.current = timeNow;

    // Calcular geometría de la caja de volumen (Ley de Boyle visual)
    // El volumen determina el Área visible
    const volFactor = volumen / 100;
    const scale = Math.sqrt(volFactor); // Escala lineal
    
    // Dejar un padding del 5% mínimo
    const maxW = canvas.width * 0.95;
    const maxH = canvas.height * 0.95;
    
    const boxW = Math.max(50, maxW * scale);
    const boxH = Math.max(50, maxH * scale);
    const boxX = (canvas.width - boxW) / 2;
    const boxY = (canvas.height - boxH) / 2;

    // Actualizar cantidad de partículas de forma segura
    if (particlesRef.current.length !== numParticulas) {
      particlesRef.current = generateParticles(numParticulas, boxX, boxY, boxW, boxH, temperatura, particlesRef.current);
    }

    // --- FASE FÍSICA ---
    // updatePhysics es O(N) gracias al Spatial Hash Grid interno
    const framePressure = updatePhysics(particlesRef.current, boxX, boxY, boxW, boxH, dt, temperatura);
    pressureAccumulatorRef.current += framePressure;

    // --- FASE DE RENDERIZADO ---
    // Limpiar pantalla
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar el Contenedor (Volumen)
    ctx.strokeStyle = '#475569'; // slate-600
    ctx.lineWidth = 4;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    // Efecto visual interior del contenedor
    ctx.fillStyle = 'rgba(30, 41, 59, 0.5)'; // slate-800 con transparencia
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Dibujar Partículas
    const pArray = particlesRef.current;
    for (let i = 0; i < pArray.length; i++) {
      const p = pArray[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color; // Color dinámico (Distribución Maxwell-Boltzmann)
      ctx.fill();
    }

    // --- CÁLCULO DE MÉTRICAS (Actualizado cada 500ms para no saturar a React) ---
    frameCountRef.current++;
    if (timeNow - lastMetricsUpdateRef.current > 500) {
      const elapsed = (timeNow - lastMetricsUpdateRef.current) / 1000;
      const fps = Math.round(frameCountRef.current / elapsed);
      
      // Presión = Fuerza / Área.
      // Momentum transferido / tiempo / perímetro de la caja
      const perimetro = 2 * (boxW + boxH);
      const presion = Math.round((pressureAccumulatorRef.current / elapsed) / perimetro * 100);

      setMetricas({ fps, presion });
      
      frameCountRef.current = 0;
      pressureAccumulatorRef.current = 0;
      lastMetricsUpdateRef.current = timeNow;
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [numParticulas, temperatura, volumen]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* PANEL LATERAL DE CONTROLES */}
      <aside className="w-full md:w-80 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col shadow-2xl z-10 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-rose-400">
            Termodinámica 2D
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">Motor O(N) Spatial Grid</p>
        </div>

        {/* CONTROLES SEGUROS */}
        <div className="space-y-8 flex-1">
          {/* Temperatura */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Temperatura (T)</label>
              <span className="text-sm font-mono text-rose-400">{temperatura} K</span>
            </div>
            <input 
              type="range" 
              min="1" max="30" step="0.5"
              value={temperatura} 
              onChange={handleInput(setTemperatura, 1, 30)}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">Afecta la velocidad media (RMS) de las partículas.</p>
          </div>

          {/* Cantidad de Partículas */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Moléculas de Gas (N)</label>
              <span className="text-sm font-mono text-blue-400">{numParticulas}</span>
            </div>
            <input 
              type="range" 
              min="10" max="5000" step="10"
              value={numParticulas} 
              onChange={handleInput(setNumParticulas, 10, 5000)}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">Clamp de seguridad: Máximo 5000 partículas para evitar DoS.</p>
          </div>

          {/* Volumen */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Volumen Contenedor (V)</label>
              <span className="text-sm font-mono text-emerald-400">{volumen}%</span>
            </div>
            <input 
              type="range" 
              min="10" max="100" step="1"
              value={volumen} 
              onChange={handleInput(setVolumen, 10, 100)}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">Comprime el gas demostrando la Ley de Boyle (P ∝ 1/V).</p>
          </div>
        </div>

        {/* MONITORES EN TIEMPO REAL */}
        <div className="mt-8 border-t border-slate-800 pt-6">
          <h3 className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-4">Monitores del Sistema</h3>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Presión */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 shadow-inner">
              <span className="block text-[10px] text-slate-400 mb-1">PRESIÓN (P)</span>
              <span className="font-mono text-xl font-bold text-emerald-400">{metricas.presion}</span>
              <span className="text-xs text-slate-600 ml-1">u</span>
            </div>
            
            {/* FPS */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 shadow-inner">
              <span className="block text-[10px] text-slate-400 mb-1">RENDIMIENTO (FPS)</span>
              <span className={`font-mono text-xl font-bold ${metricas.fps < 30 ? 'text-rose-500' : 'text-blue-400'}`}>
                {metricas.fps}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* LIENZO PRINCIPAL (CANVAS) */}
      <main className="flex-1 relative" ref={containerRef}>
        <canvas 
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="block absolute top-0 left-0 w-full h-full"
        />
        
        {/* Etiqueta flotante didáctica */}
        <div className="absolute top-4 left-6 pointer-events-none">
           <h2 className="text-lg font-bold text-slate-700/50 uppercase tracking-widest">
             Distribución de Maxwell-Boltzmann
           </h2>
           <p className="text-xs font-mono text-slate-700/50 flex items-center gap-2 mt-1">
             <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Frío / Lento
             <span className="w-2 h-2 rounded-full bg-rose-500 inline-block ml-3"></span> Caliente / Rápido
           </p>
        </div>
      </main>

    </div>
  );
};

export default SimuladorGases;
