export class Particle {
  constructor(x, y, vx, vy, radius) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.mass = 1;
    this.color = '#0000ff'; // Blue default
  }
}

export class SpatialGrid {
  constructor(boxX, boxY, boxW, boxH, cellSize) {
    this.boxX = boxX;
    this.boxY = boxY;
    this.boxW = boxW;
    this.boxH = boxH;
    this.cellSize = cellSize;
    // Padding of 1 cell on each side just in case particles slightly escape bounds
    this.cols = Math.ceil(boxW / cellSize) + 2; 
    this.rows = Math.ceil(boxH / cellSize) + 2;
    this.cells = new Array(this.cols * this.rows).fill(null).map(() => []);
  }

  insert(particle) {
    // Relative position to the bounding box
    const relX = particle.x - this.boxX;
    const relY = particle.y - this.boxY;
    
    // Add +1 to offset the padding we created
    const col = Math.floor(relX / this.cellSize) + 1;
    const row = Math.floor(relY / this.cellSize) + 1;
    
    const safeCol = Math.max(0, Math.min(col, this.cols - 1));
    const safeRow = Math.max(0, Math.min(row, this.rows - 1));
    
    const index = safeCol + safeRow * this.cols;
    this.cells[index].push(particle);
  }
}

export function updatePhysics(particles, boxX, boxY, boxW, boxH, dt, temperature) {
  let pressureAccumulator = 0;
  
  // La velocidad objetivo promedio de la distribución (Vrms proporcional a sqrt(T))
  // Hacemos una aproximación lineal simple para efectos visuales en pantalla
  const targetSpeed = Math.max(0.5, temperature); 
  
  // Buscar velocidad máxima actual para el mapa de calor (Maxwell-Boltzmann)
  let maxSpeed = 0;
  for (let i = 0; i < particles.length; i++) {
    const speed = Math.sqrt(particles[i].vx * particles[i].vx + particles[i].vy * particles[i].vy);
    if (speed > maxSpeed) maxSpeed = speed;
  }
  if (maxSpeed < targetSpeed) maxSpeed = targetSpeed;
  if (maxSpeed === 0) maxSpeed = 1; 
  
  const particleRadius = particles[0] ? particles[0].radius : 2;
  const cellSize = particleRadius * 2.5; // Un poco más que el diámetro para seguridad
  
  const grid = new SpatialGrid(boxX, boxY, boxW, boxH, cellSize);
  
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    
    // Termostato de simulación (Baño térmico):
    // Empuja suavemente la velocidad del gas hacia la temperatura deseada
    let speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    
    // Ocasionalmente aplicamos "ruido térmico" para evitar que todas las partículas tengan exactamente la misma velocidad
    let noise = (Math.random() - 0.5) * 0.1;
    let scale = speed > 0 ? (targetSpeed * (1 + noise)) / speed : 1;
    
    // Interpolación hacia la temperatura objetivo muy suavemente (0.05)
    p.vx = p.vx * 0.95 + (p.vx * scale) * 0.05;
    p.vy = p.vy * 0.95 + (p.vy * scale) * 0.05;

    // Movimiento
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    
    // Colisiones con las paredes de la caja (Ley de Boyle y Charles)
    if (p.x - p.radius < boxX) {
      p.x = boxX + p.radius;
      p.vx *= -1;
      pressureAccumulator += 2 * Math.abs(p.vx) * p.mass;
    } else if (p.x + p.radius > boxX + boxW) {
      p.x = boxX + boxW - p.radius;
      p.vx *= -1;
      pressureAccumulator += 2 * Math.abs(p.vx) * p.mass;
    }
    
    if (p.y - p.radius < boxY) {
      p.y = boxY + p.radius;
      p.vy *= -1;
      pressureAccumulator += 2 * Math.abs(p.vy) * p.mass;
    } else if (p.y + p.radius > boxY + boxH) {
      p.y = boxY + boxH - p.radius;
      p.vy *= -1;
      pressureAccumulator += 2 * Math.abs(p.vy) * p.mass;
    }

    // Termodinámica de Color: Azul (Frío) a Rojo (Caliente)
    speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    let normalizedSpeed = Math.min(speed / maxSpeed, 1);
    
    // En HSL: 240 es Azul, 0 es Rojo. Interpolamos de 240 a 0 basado en velocidad.
    let hue = (1 - normalizedSpeed) * 240; 
    p.color = `hsl(${hue}, 100%, 50%)`;

    grid.insert(p);
  }

  // Resolver colisiones de partículas (O(N) gracias al Spatial Hash Grid)
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      let index = c + r * grid.cols;
      let cell = grid.cells[index];
      
      for (let i = 0; i < cell.length; i++) {
        let p1 = cell[i];
        
        // 1. Verificar colisiones con otras partículas en la *misma celda*
        for (let j = i + 1; j < cell.length; j++) {
           resolveCollision(p1, cell[j]);
        }
        
        // 2. Verificar colisiones con celdas adyacentes (Solo 4 direcciones para evitar doble chequeo)
        checkCell(p1, grid, c + 1, r);     // Derecha
        checkCell(p1, grid, c, r + 1);     // Abajo
        checkCell(p1, grid, c + 1, r + 1); // Abajo-Derecha
        checkCell(p1, grid, c - 1, r + 1); // Abajo-Izquierda
      }
    }
  }
  
  return pressureAccumulator; // Momentum transferido a los muros (Impulso total)
}

function checkCell(p1, grid, col, row) {
  if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return;
  const index = col + row * grid.cols;
  const cell = grid.cells[index];
  for (let i = 0; i < cell.length; i++) {
    resolveCollision(p1, cell[i]);
  }
}

function resolveCollision(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distSq = dx * dx + dy * dy;
  const minDist = p1.radius + p2.radius;
  
  if (distSq < minDist * minDist && distSq > 0) {
    const dist = Math.sqrt(distSq);
    
    // Separación para evitar superposición (Overlap)
    const overlap = 0.5 * (minDist - dist);
    const nx = dx / dist;
    const ny = dy / dist;
    
    p1.x -= nx * overlap;
    p1.y -= ny * overlap;
    p2.x += nx * overlap;
    p2.y += ny * overlap;
    
    // Física de colisión elástica en 2D (Asumiendo masa 1 para ambos)
    const dvx = p2.vx - p1.vx;
    const dvy = p2.vy - p1.vy;
    
    // Producto punto de vector de velocidad relativo y vector normal
    const dotProduct = dvx * nx + dvy * ny;
    
    // Solo rebotan si se están acercando
    if (dotProduct < 0) {
       const impulse = dotProduct;
       p1.vx += impulse * nx;
       p1.vy += impulse * ny;
       p2.vx -= impulse * nx;
       p2.vy -= impulse * ny;
    }
  }
}

export function generateParticles(num, boxX, boxY, boxW, boxH, temperature, prevParticles = []) {
   let particles = [...prevParticles];
   const radius = 3; // Radio físico de la partícula
   
   // Safety clamps:
   const safeW = boxW - radius * 2;
   const safeH = boxH - radius * 2;
   
   // Si queremos menos partículas, cortamos el arreglo
   if (num < particles.length) {
     particles.length = num;
   } 
   // Si queremos más, añadimos nuevas
   else if (num > particles.length) {
     const toAdd = num - particles.length;
     for(let i = 0; i < toAdd; i++) {
       // Espawnear aleatoriamente dentro del volumen de la caja actual
       const x = boxX + radius + Math.random() * safeW;
       const y = boxY + radius + Math.random() * safeH;
       
       const angle = Math.random() * Math.PI * 2;
       const speed = Math.max(0.5, temperature) * (0.8 + Math.random() * 0.4); 
       
       particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, radius));
     }
   }
   
   return particles;
}
