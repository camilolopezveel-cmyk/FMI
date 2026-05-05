import React, { useState, useEffect } from 'react';

const SimuladorFlotacion = () => {
  // Estado inicial con valores por defecto (como strings para el input controlado)
  const [inputs, setInputs] = useState({
    densidadFluido: '1000',
    masaObjeto: '50',
    volumenObjeto: '0.1'
  });

  // Estado para los resultados matemáticos y físicos
  const [resultados, setResultados] = useState({
    densidadObjeto: 0,
    pesoTotal: 0,
    empujeMaximo: 0,
    estado: '',
    porcentajeSumergido: 0,
    error: null
  });

  // Manejador seguro de inputs (Security by Design: Sanitización en la entrada)
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Sanitización básica estricta: solo permite números y punto decimal.
    // Previene inyección de caracteres maliciosos o scripts.
    const sanitizedValue = value.replace(/[^0-9.]/g, '');
    
    // Evitar múltiples puntos decimales (ej. '10.5.2' -> '10.52')
    const parts = sanitizedValue.split('.');
    const finalValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitizedValue;

    setInputs(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  // Hook aislado para la lógica matemática y física (Principio de Separación de Responsabilidades)
  useEffect(() => {
    try {
      // 1. Validación estricta y parseo seguro
      const densidadFluido = parseFloat(inputs.densidadFluido);
      const masa = parseFloat(inputs.masaObjeto);
      const volumen = parseFloat(inputs.volumenObjeto);

      // Verificamos si la conversión falló resultando en NaN (Not a Number)
      if (isNaN(densidadFluido) || isNaN(masa) || isNaN(volumen)) {
        throw new Error("Por favor, ingrese valores numéricos válidos.");
      }

      // Prevención de división por cero y valores negativos o singulares (Límites)
      if (volumen <= 0.0001) {
         throw new Error("El volumen debe ser mayor a 0 para evitar divisiones por cero o singularidades.");
      }
      if (densidadFluido <= 0 || masa <= 0) {
         throw new Error("La densidad y la masa deben ser valores positivos mayores a 0.");
      }

      // 2. Cálculos físicos (Gravedad de la Tierra = 9.81 m/s²)
      const g = 9.81;
      const densidadObjeto = masa / volumen;
      const pesoTotal = masa * g; // W = m * g
      const empujeMaximo = densidadFluido * volumen * g; // E = ρ * V * g (Principio de Arquímedes)

      // 3. Determinación del estado de flotabilidad
      let estado = '';
      let porcentajeSumergido = 100;
      
      // Uso de un epsilon para comparaciones de punto flotante seguras y evitar errores de precisión de JS
      const epsilon = 0.01; 

      if (densidadObjeto < densidadFluido - epsilon) {
        estado = 'Flota';
        // Si flota, el porcentaje sumergido es la relación entre la densidad del objeto y el fluido
        porcentajeSumergido = (densidadObjeto / densidadFluido) * 100;
      } else if (densidadObjeto > densidadFluido + epsilon) {
        estado = 'Se hunde';
        porcentajeSumergido = 100; // Totalmente sumergido
      } else {
        estado = 'Equilibrio Neutro';
        porcentajeSumergido = 100; // Totalmente sumergido pero suspendido
      }

      // Actualizamos estado de forma segura, limitando decimales para UI limpia
      setResultados({
        densidadObjeto: parseFloat(densidadObjeto.toFixed(2)),
        pesoTotal: parseFloat(pesoTotal.toFixed(2)),
        empujeMaximo: parseFloat(empujeMaximo.toFixed(2)),
        estado,
        porcentajeSumergido: parseFloat(porcentajeSumergido.toFixed(2)),
        error: null // Limpiamos errores previos si todo fue exitoso
      });

    } catch (err) {
      // Manejo de errores defensivo: no exponemos el stack trace al DOM
      setResultados(prev => ({
        ...prev,
        error: err.message || "Error inesperado en los cálculos físicos."
      }));
    }
  }, [inputs]); // El efecto depende únicamente de los inputs controlados

  // Determinación dinámica de colores (Mapeo seguro, sin inyección de clases arbitrarias)
  const getStateColor = (estado) => {
    switch(estado) {
      case 'Flota': return 'bg-emerald-500'; // Verde moderno
      case 'Se hunde': return 'bg-rose-500'; // Rojo moderno
      case 'Equilibrio Neutro': return 'bg-amber-500'; // Amarillo/Ambar
      default: return 'bg-slate-500';
    }
  };

  // Renderizado seguro en DOM (React previene XSS de manera nativa al usar llaves { })
  // No hay uso de dangerouslySetInnerHTML ni manipulación directa de DOM insegura.
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="border-b border-slate-800 pb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">
            Simulador de Flotabilidad Hidrostática
          </h1>
          <p className="text-slate-400 mt-2 font-medium">
            Modelo Dinámico Arquimediano con Security by Design
          </p>
        </header>

        {/* Manejo y visualización segura de excepciones */}
        {resultados.error && (
          <div className="bg-rose-500/10 border-l-4 border-rose-500 text-rose-200 p-4 rounded-r-lg shadow-lg" role="alert">
            <p className="font-bold flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Excepción de Parámetros
            </p>
            <p className="mt-1 text-sm">{resultados.error}</p>
          </div>
        )}

        {/* Layout Principal Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* COLUMNA IZQUIERDA: PANEL DE CONTROLES */}
          <div className="lg:col-span-5 bg-slate-900 p-6 md:p-8 rounded-2xl shadow-2xl border border-slate-800/60 backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-6 flex items-center text-slate-200">
              <svg className="w-6 h-6 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
              Parámetros Físicos
            </h2>
            
            <div className="space-y-6">
              {/* Grupo Input 1 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Densidad del Fluido <span className="text-slate-500">(kg/m³)</span></label>
                <input 
                  type="text" 
                  name="densidadFluido"
                  value={inputs.densidadFluido}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
                  placeholder="Ej: 1000"
                  aria-label="Densidad del Fluido"
                />
              </div>

              {/* Grupo Input 2 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Masa del Objeto <span className="text-slate-500">(kg)</span></label>
                <input 
                  type="text" 
                  name="masaObjeto"
                  value={inputs.masaObjeto}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
                  placeholder="Ej: 50"
                  aria-label="Masa del Objeto"
                />
              </div>

              {/* Grupo Input 3 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Volumen del Objeto <span className="text-slate-500">(m³)</span></label>
                <input 
                  type="text" 
                  name="volumenObjeto"
                  value={inputs.volumenObjeto}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all shadow-inner"
                  placeholder="Ej: 0.1"
                  aria-label="Volumen del Objeto"
                />
              </div>
            </div>

            {/* Sub-panel de Resultados Computados */}
            <div className="mt-8 pt-8 border-t border-slate-800">
              <h3 className="text-sm uppercase tracking-wider font-semibold text-slate-400 mb-4">Salida del Sistema</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                  <span className="block text-xs text-slate-500 mb-1">Densidad Objeto</span>
                  <span className="font-mono text-lg text-slate-200">{resultados.error ? '---' : `${resultados.densidadObjeto} kg/m³`}</span>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                  <span className="block text-xs text-slate-500 mb-1">Fuerza Peso (W)</span>
                  <span className="font-mono text-lg text-slate-200">{resultados.error ? '---' : `${resultados.pesoTotal} N`}</span>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                  <span className="block text-xs text-slate-500 mb-1">Empuje Máx (E)</span>
                  <span className="font-mono text-lg text-blue-400">{resultados.error ? '---' : `${resultados.empujeMaximo} N`}</span>
                </div>
                {/* Bloque de Color Dinámico Seguro */}
                <div className={`p-4 rounded-xl border ${resultados.error ? 'bg-slate-900 border-slate-800/50' : `${getStateColor(resultados.estado)} bg-opacity-10 border-current shadow-lg`}`}>
                  <span className="block text-xs opacity-70 mb-1">Estado Físico</span>
                  <span className={`font-bold text-lg tracking-wide ${resultados.error ? 'text-slate-600' : 'text-slate-100'}`}>
                    {resultados.error ? 'N/A' : resultados.estado}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: PANEL DE VISUALIZACIÓN DINÁMICA */}
          <div className="lg:col-span-7 bg-slate-900 p-6 md:p-8 rounded-2xl shadow-2xl border border-slate-800/60 backdrop-blur-sm flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-6 flex items-center w-full text-slate-200">
              <svg className="w-6 h-6 mr-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              Renderizado Espacial
            </h2>

            {!resultados.error ? (
              <div className="relative w-full max-w-md h-[400px] bg-slate-950 rounded-2xl border-4 border-slate-800 overflow-hidden mt-2 shadow-inner">
                
                {/* Atmósfera superior */}
                <div className="absolute top-0 w-full h-[40%] bg-gradient-to-b from-slate-900 to-slate-950 z-0"></div>
                
                {/* Fluido / Tanque */}
                <div className="absolute bottom-0 w-full h-[60%] bg-blue-600/20 border-t border-blue-400/50 z-10 backdrop-blur-[2px]">
                  {/* Animación sutil de olas mediante gradiente */}
                  <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-blue-400/0 via-blue-400/30 to-blue-400/0 opacity-50"></div>
                </div>

                {/* Bloque Representativo (El Objeto) */}
                <div 
                  className={`absolute left-1/2 transform -translate-x-1/2 w-28 h-28 rounded-xl shadow-2xl z-20 transition-all duration-1000 ease-in-out flex flex-col items-center justify-center font-bold text-white border-2 border-white/20 backdrop-blur-md ${getStateColor(resultados.estado)}`}
                  style={{
                    /* 
                      Seguridad y Lógica de Posición Y:
                      La variable de estado determina estrictamente la posición calculada.
                      Usamos 'top' calculado dinámicamente. El agua inicia al 40% del contenedor.
                      El objeto mide 7rem (28 x 0.25rem).
                    */
                    top: resultados.estado === 'Se hunde' ? 'calc(100% - 7rem - 1rem)' // Al fondo
                       : resultados.estado === 'Equilibrio Neutro' ? 'calc(70% - 3.5rem)' // Suspendido al medio del agua
                       : `calc(40% - 7rem + (7rem * ${resultados.porcentajeSumergido / 100}))` // Flotando
                  }}
                >
                  <span className="block text-[10px] uppercase tracking-wider opacity-80 mb-1">Volumen sumergido</span>
                  <span className="text-2xl font-mono">{resultados.porcentajeSumergido}%</span>
                </div>

                {/* Indicadores de Entorno */}
                <div className="absolute right-3 bottom-3 z-30 text-[10px] text-blue-300/50 font-mono uppercase tracking-widest">Lecho</div>
                <div className="absolute left-0 w-full top-[40%] border-t border-blue-400/30 border-dashed z-0"></div>
                <div className="absolute left-3 top-[40%] -mt-6 z-30 text-[10px] text-blue-300/50 font-mono uppercase tracking-widest">Superficie</div>
              </div>
            ) : (
              <div className="w-full max-w-md h-[400px] flex items-center justify-center border-2 border-dashed border-rose-500/30 bg-rose-500/5 rounded-2xl">
                <div className="text-center p-6">
                  <svg className="w-12 h-12 text-rose-500/50 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <p className="text-slate-400 text-sm">El motor de renderizado está en pausa<br/>hasta resolver la excepción matemática.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimuladorFlotacion;
