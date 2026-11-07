// Coin Catch, the small game on the 404 page. A gold piggy bank slides along
// the floor catching green coins and dodging red bills. This file is the canvas
// engine only; the score bar, start/pause/game-over panels and buttons are React
// in components/CoinCatch.tsx, which hears about changes through the callbacks.

export type CoinCatchPhase = 'ready' | 'playing' | 'paused' | 'over';

export interface CoinCatchCallbacks {
  onSaved: (saved: number) => void;
  onLives: (lives: number) => void;
  onPhase: (phase: CoinCatchPhase) => void;
  /** Bottom edge (px, from the field top) of the start panel, so the idle demo
   *  coins sit in the open band between it and the pig. */
  readyPanelBottom: () => number;
}

export interface CoinCatchGame {
  start: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

type Colors = Record<'floor' | 'halo' | 'goodText' | 'badText', string>;

interface Coin { value: number; label: string; r: number; weight: number }
interface Item {
  bill: boolean; value: number; label: string;
  r: number; x: number; y: number; vy: number; rot: number; spin: number;
}
interface Pop { x: number; y: number; text: string; color: string; life: number }

// Fixed brand colours: logo gold for the pig, coin green, the app's red for bills.
const PIG = { body: '#FFC81A', dark: '#E8A400', light: '#FFE07A', cheek: '#FF8A3D' };
const COIN = '#1DCB63';
const COIN_SHINE = '#86E8AE';
const BILL = '#E8174B';

const COINS: Coin[] = [
  { value: 1, label: '1', r: 13, weight: 40 },
  { value: 2, label: '2', r: 15, weight: 30 },
  { value: 5, label: '5', r: 17, weight: 20 },
  { value: 10, label: '10', r: 19, weight: 10 },
];
const COIN_WEIGHT = COINS.reduce((s, c) => s + c.weight, 0);
const BILL_SIZE = 14;
// Furthest drawn point of the pig (snout or tail), squash included, in pig units.
const PIG_EDGE = 66;
const LIVES = 3;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function createCoinCatch(field: HTMLElement, canvas: HTMLCanvasElement, cb: CoinCatchCallbacks): CoinCatchGame {
  const ctx = canvas.getContext('2d')!;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let colors: Colors = { floor: '#1A1A1A', halo: '#FAFAF9', goodText: '#007A33', badText: '#B3123A' };
  const readColors = () => {
    const s = getComputedStyle(field);
    const dark = document.documentElement.classList.contains('dark');
    colors = {
      floor: s.getPropertyValue('--border-primary').trim() || '#1A1A1A',
      halo: s.getPropertyValue('--bg-secondary').trim() || '#FAFAF9',
      goodText: dark ? '#52C68B' : '#007A33',
      badText: dark ? '#FF6B88' : '#B3123A',
    };
  };
  readColors();
  // The app switches theme with a class on <html>.
  const themeObserver = new MutationObserver(() => { readColors(); kick(); });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  let W = 0, H = 0, scale = 1;
  let phase: CoinCatchPhase = 'ready';
  let items: Item[] = [];
  let pops: Pop[] = [];
  let saved = 0, lives = LIVES, t = 0, spawnIn = 0.6;
  const pig = { x: 0, y: 0, targetX: 0, face: 1, squash: 0, hurt: 0, deposit: 0 };
  const keys = { left: false, right: false };

  function setPhase(next: CoinCatchPhase) {
    phase = next;
    cb.onPhase(next);
    kick();
  }

  function resize() {
    const oldW = W, oldH = H, oldScale = scale;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, canvas.clientWidth); H = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = clamp(W / 520, 0.62, 1);
    // Keep falling items in proportion when the field changes size mid-game.
    if (oldW > 1 && oldH > 1) {
      const kx = W / oldW, ky = H / oldH, ks = scale / oldScale;
      for (const it of items) {
        it.r *= ks;
        it.x = clamp(it.x * kx, it.r, W - it.r);
        it.y *= ky; it.vy *= ky;
      }
      pig.x *= kx; pig.targetX *= kx;
      if (phase === 'playing' && Math.abs(W - oldW) > 40) pause();
    }
    const edge = PIG_EDGE * scale;
    pig.y = H - 40 * scale - 6;
    pig.targetX = clamp(pig.targetX || W / 2, edge, W - edge);
    pig.x = clamp(pig.x || W / 2, edge, W - edge);
    kick(); // resizing the canvas clears it
  }

  function start() {
    items = []; pops = [];
    saved = 0; lives = LIVES; t = 0; spawnIn = 0.6;
    pig.x = pig.targetX = W / 2;
    pig.squash = pig.hurt = pig.deposit = 0;
    keys.left = keys.right = false;
    cb.onSaved(saved); cb.onLives(lives);
    setPhase('playing');
    canvas.focus({ preventScroll: true });
  }

  function pause() {
    if (phase === 'playing') setPhase('paused');
  }

  function resume() {
    if (phase !== 'paused') return;
    keys.left = keys.right = false;
    setPhase('playing');
    canvas.focus({ preventScroll: true });
  }

  // A coin and a bill that reach the pig at about the same time must be far
  // enough apart that the pig can sit under the coin without touching the bill.
  function fairX(isBill: boolean, r: number, vy: number): number | null {
    const gap = (PIG_EDGE + 22) * scale;
    const arrive = (pig.y + r) / vy;
    const rivals = items.filter(it => it.bill !== isBill && Math.abs((pig.y - it.y) / it.vy - arrive) < 0.75);
    let bestX: number | null = null, bestDist = -1;
    for (let tries = 0; tries < 12; tries++) {
      const x = r + 6 + Math.random() * Math.max(0, W - 2 * r - 12);
      const dist = rivals.reduce((m, it) => Math.min(m, Math.abs(it.x - x)), Infinity);
      if (dist >= gap) return x;
      if (dist > bestDist) { bestDist = dist; bestX = x; }
    }
    return isBill ? null : bestX;
  }

  function spawn() {
    const ramp = Math.min(1, t / 60);
    const isBill = t > 6 && Math.random() < lerp(0.12, 0.28, ramp);
    let kind: { value: number; label: string; r: number };
    if (isBill) {
      kind = { value: 0, label: '', r: BILL_SIZE };
    } else {
      let roll = Math.random() * COIN_WEIGHT;
      kind = COINS.find(c => (roll -= c.weight) < 0) ?? COINS[0];
    }
    const r = kind.r * scale;
    const speed = lerp(150, 380, ramp) * (kind.value === 10 ? 1.2 : 1) * (0.9 + Math.random() * 0.2);
    const vy = speed * Math.max(0.75, H / 440);
    const x = fairX(isBill, r, vy);
    if (x === null) return; // no fair spot for this bill right now; skip it
    items.push({
      bill: isBill, value: kind.value, label: kind.label, r, x, vy,
      y: -r - 4, rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 3,
    });
  }

  function addPop(x: number, y: number, text: string, color: string) {
    pops.push({ x, y, text, color, life: 0.9 });
  }

  function shake() {
    if (reduceMotion) return;
    field.classList.remove('coin-catch-hit');
    void field.offsetWidth;
    field.classList.add('coin-catch-hit');
  }

  function loseLife() {
    lives -= 1;
    pig.hurt = 0.7;
    cb.onLives(lives);
    shake();
    if (lives <= 0) setPhase('over');
  }

  function update(dt: number) {
    t += dt;
    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawn();
      spawnIn = lerp(0.95, 0.4, Math.min(1, t / 60)) * (0.7 + Math.random() * 0.6);
    }

    const keySpeed = 560 * scale;
    if (keys.left) pig.targetX -= keySpeed * dt;
    if (keys.right) pig.targetX += keySpeed * dt;
    const edge = PIG_EDGE * scale;
    pig.targetX = clamp(pig.targetX, edge, W - edge);
    const prev = pig.x;
    pig.x += (pig.targetX - pig.x) * Math.min(1, dt * 16);
    if (Math.abs(pig.x - prev) > 0.4) pig.face = pig.x > prev ? 1 : -1;
    pig.squash = Math.max(0, pig.squash - dt * 5);
    pig.hurt = Math.max(0, pig.hurt - dt);
    pig.deposit = Math.max(0, pig.deposit - dt * 3);

    const catchTop = pig.y - 36 * scale;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * dt;
      it.rot += it.spin * dt;
      // Anything touching the drawn pig (egg body or snout) counts as caught.
      const dx = (it.x - pig.x) * pig.face, dy = it.y - pig.y;
      const bx = dx + 1 * scale;
      const inBody = bx * bx / (46 * scale + it.r) ** 2 + dy * dy / (35 * scale + it.r) ** 2 <= 1;
      const sx = dx - 48 * scale, sy = dy - 4 * scale;
      const inSnout = sx * sx / (11 * scale + it.r) ** 2 + sy * sy / (11 * scale + it.r) ** 2 <= 1;
      if (inBody || inSnout) {
        items.splice(i, 1);
        if (it.bill) {
          addPop(it.x, catchTop - 10, 'Bill!', colors.badText);
          loseLife();
        } else {
          saved += it.value;
          pig.squash = 1;
          pig.deposit = 1;
          addPop(it.x, catchTop - 10, '+' + it.label, colors.goodText);
          cb.onSaved(saved);
        }
        if (phase !== 'playing') return;
      } else if (it.y - it.r > H) {
        items.splice(i, 1);
        if (!it.bill) {
          addPop(clamp(it.x, 30, W - 30), H - 18, 'Missed', colors.badText);
          loseLife();
          if (phase !== 'playing') return;
        }
      }
    }

    for (let i = pops.length - 1; i >= 0; i--) {
      pops[i].life -= dt;
      pops[i].y -= 40 * dt;
      if (pops[i].life <= 0) pops.splice(i, 1);
    }
  }

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawCoin(it: { x: number; y: number; r: number; label: string; rot: number }) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.scale(Math.abs(Math.cos(it.rot)) * 0.35 + 0.65, 1);
    ctx.beginPath(); ctx.arc(0, 0, it.r, 0, Math.PI * 2);
    ctx.fillStyle = COIN; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.beginPath(); ctx.arc(-it.r * 0.35, -it.r * 0.4, it.r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = COIN_SHINE; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, it.r * 0.7, 0, Math.PI * 2);
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.font = `800 ${Math.round(it.r * 0.72)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(it.label, 0, 1);
    ctx.restore();
  }

  function drawBill(it: { x: number; y: number; rot: number }) {
    const w = 24 * scale, h = 32 * scale;
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(Math.sin(it.rot) * 0.35);
    roundRect(-w / 2, -h / 2, w, h, 4 * scale);
    ctx.fillStyle = BILL; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff';
    for (const ly of [-0.22, 0, 0.22]) {
      ctx.beginPath(); ctx.moveTo(-w * 0.28, h * ly); ctx.lineTo(w * (ly === 0.22 ? 0.05 : 0.28), h * ly); ctx.stroke();
    }
    ctx.restore();
  }

  // The pig in local units: origin at the body centre, facing right.
  function drawPigLocal(st: { happy: boolean; hurt: boolean; blink: boolean; deposit: number }) {
    const ink = '#000';
    const LW = 3.5;
    const TAU = Math.PI * 2;

    // Egg-shaped body: fuller rump (left), slightly tapered toward the face (right).
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(0, -35);
      ctx.bezierCurveTo(26, -35, 45, -20, 45, 1);
      ctx.bezierCurveTo(45, 22, 26, 35, 0, 35);
      ctx.bezierCurveTo(-28, 35, -47, 22, -47, 0);
      ctx.bezierCurveTo(-47, -22, -28, -35, 0, -35);
      ctx.closePath();
    };

    ctx.lineWidth = LW; ctx.strokeStyle = ink;

    // Far legs (behind the body, darker)
    ctx.fillStyle = PIG.dark;
    roundRect(-30, 16, 13, 22, 6); ctx.fill(); ctx.stroke();
    roundRect(16, 16, 13, 22, 6); ctx.fill(); ctx.stroke();

    // Curly tail, with a gold core so it still shows on a dark background
    ctx.beginPath(); ctx.moveTo(-45, -4);
    ctx.bezierCurveTo(-57, -4, -59, -16, -52, -18);
    ctx.bezierCurveTo(-46, -19, -46, -11, -52, -11);
    ctx.lineWidth = 5; ctx.strokeStyle = ink; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = PIG.dark; ctx.stroke();
    ctx.lineWidth = LW; ctx.strokeStyle = ink;

    // Far ear (behind the body)
    ctx.fillStyle = PIG.dark;
    ctx.beginPath(); ctx.moveTo(6, -31); ctx.quadraticCurveTo(8, -47, 21, -42); ctx.quadraticCurveTo(19, -34, 16, -30); ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Body fill, belly and highlight
    bodyPath(); ctx.fillStyle = PIG.body; ctx.fill();
    ctx.save(); bodyPath(); ctx.clip();
    ctx.fillStyle = PIG.light;
    ctx.beginPath(); ctx.ellipse(-3, 24, 36, 17, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(-26, -14, 8, 4.5, -0.75, 0, TAU); ctx.fill();
    ctx.restore();

    // Body outline (before the slot, so a coin going in sits in front of it)
    bodyPath(); ctx.stroke();

    // Coin slot on top of the back. Right after a catch, a green coin sinks into it.
    const sx = -3, sy = -30, srx = 10, sry = 2.2;
    ctx.fillStyle = '#1a1200';
    ctx.beginPath(); ctx.ellipse(sx, sy, srx, sry, 0, 0, TAU); ctx.fill();
    if (st.deposit > 0) {
      // Only the part above the slit's centre line shows.
      ctx.save();
      ctx.beginPath(); ctx.rect(sx - 20, sy - 30, 40, 30); ctx.clip();
      const cr = 11, cy = sy - 9 + (1 - st.deposit) * 22;
      ctx.beginPath(); ctx.arc(sx, cy, cr, 0, TAU);
      ctx.fillStyle = COIN; ctx.fill();
      ctx.lineWidth = 3; ctx.stroke();
      ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(0,60,20,0.45)';
      ctx.beginPath(); ctx.arc(sx, cy, cr - 4, 0, TAU); ctx.stroke();
      ctx.fillStyle = COIN_SHINE;
      ctx.beginPath(); ctx.ellipse(sx - 4.5, cy - 4.5, 3, 1.7, -0.7, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = ink;
    // Slit front edge plus a light lip under it, so it reads as cut in
    ctx.fillStyle = '#1a1200';
    ctx.beginPath(); ctx.ellipse(sx, sy, srx, sry, 0, 0, Math.PI); ctx.fill();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sx, sy, srx, sry, 0, 0, Math.PI); ctx.stroke();
    ctx.strokeStyle = PIG.light; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(sx, sy + 2.2, srx + 0.5, sry + 1.6, 0, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.strokeStyle = ink; ctx.lineWidth = LW;

    // Near legs
    ctx.fillStyle = PIG.body;
    roundRect(-19, 20, 14, 18, 6); ctx.fill(); ctx.stroke();
    roundRect(24, 18, 14, 18, 6); ctx.fill(); ctx.stroke();

    // Near ear
    ctx.fillStyle = PIG.dark;
    ctx.beginPath(); ctx.moveTo(14, -31); ctx.quadraticCurveTo(20, -50, 35, -39); ctx.quadraticCurveTo(31, -30, 25, -27); ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Cheek blush
    ctx.fillStyle = PIG.cheek; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.ellipse(22, 8, 6.5, 4.5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    // Snout: a short cylinder seen at three quarters. Side band first...
    const px = 49, py = 4, prx = 9.5, pry = 11;
    ctx.beginPath();
    ctx.moveTo(41, py - pry + 0.5);
    ctx.lineTo(px, py - pry);
    ctx.ellipse(px, py, prx, pry, 0, -Math.PI / 2, Math.PI / 2, false);
    ctx.lineTo(41, py + pry - 0.5);
    ctx.ellipse(41, py, 5, pry - 0.5, 0, Math.PI / 2, -Math.PI / 2, false);
    ctx.closePath();
    ctx.fillStyle = PIG.dark; ctx.fill();
    ctx.fillStyle = 'rgba(120,60,0,0.22)'; ctx.fill();
    ctx.stroke();
    // ...then the front plate with two nostrils side by side
    ctx.beginPath(); ctx.ellipse(px, py, prx, pry, 0, 0, TAU);
    ctx.fillStyle = PIG.dark; ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.ellipse(px - 2, py - 6, 3, 1.6, -0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1800';
    ctx.beginPath(); ctx.ellipse(px - 3.6, py + 1, 1.9, 3.2, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px + 3.6, py + 1, 1.9, 3.2, 0, 0, TAU); ctx.fill();

    // Eye: hurt, happy, blinking or open
    const ex = 26, ey = -9;
    ctx.fillStyle = ink; ctx.lineWidth = 2.8;
    if (st.hurt) {
      ctx.beginPath(); ctx.moveTo(ex - 4, ey - 4); ctx.lineTo(ex + 4, ey + 4); ctx.moveTo(ex + 4, ey - 4); ctx.lineTo(ex - 4, ey + 4); ctx.stroke();
    } else if (st.happy) {
      ctx.beginPath(); ctx.arc(ex, ey + 2, 4.5, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke();
    } else if (st.blink) {
      ctx.beginPath(); ctx.moveTo(ex - 4.5, ey); ctx.lineTo(ex + 4.5, ey); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(ex, ey, 4.2, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex + 1.4, ey - 1.8, 1.5, 0, TAU); ctx.fill();
    }
  }

  function drawPig(now: number) {
    ctx.save();
    ctx.translate(pig.x, pig.y);
    ctx.scale(pig.face * scale * (1 + pig.squash * 0.08), scale * (1 - pig.squash * 0.1));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    drawPigLocal({ happy: pig.squash > 0.2, hurt: pig.hurt > 0, blink: now % 3200 < 120, deposit: pig.deposit });
    ctx.restore();
  }

  function draw(now: number) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = colors.floor;
    ctx.fillRect(0, H - 4, W, 4);

    if (phase === 'ready') {
      // A few coins and a bill hanging between the start panel and the pig, so
      // the field reads as a game before anyone presses Play. Skipped when the
      // field is too short to fit them.
      const bandTop = cb.readyPanelBottom() + 22 * scale;
      const bandBottom = pig.y - 60 * scale;
      if (bandBottom - bandTop > 20) {
        const bob = reduceMotion ? 0 : Math.sin(now / 500) * 4;
        const at = (k: number) => lerp(bandTop, bandBottom, k);
        const demo = [
          { x: W * 0.14, y: at(0.7) + bob, r: 15 * scale, label: '2', rot: 0 },
          { x: W * 0.32, y: at(0.2) - bob, r: 19 * scale, label: '10', rot: 0 },
          { x: W * 0.84, y: at(0.75) + bob, r: 13 * scale, label: '1', rot: 0 },
        ];
        demo.forEach(drawCoin);
        drawBill({ x: W * 0.68, y: at(0.3) - bob, rot: 0.6 });
      }
    }

    for (const it of items) {
      if (it.bill) drawBill(it); else drawCoin(it);
    }
    drawPig(now);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(16 * Math.max(scale, 0.8))}px Inter, system-ui, sans-serif`;
    ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = colors.halo;
    for (const p of pops) {
      ctx.globalAlpha = clamp(p.life / 0.9, 0, 1);
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  // The loop only runs while there is motion to show: during play, and on the
  // start screen (bobbing coins) unless reduced motion is on. Otherwise each
  // change draws a single frame through kick(), so an idle page costs nothing.
  let raf = 0;
  let last = 0;
  let visible = true;
  const animating = () => visible && (phase === 'playing' || (phase === 'ready' && !reduceMotion));
  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (phase === 'playing') update(dt);
    draw(now);
    if (animating()) raf = requestAnimationFrame(frame);
  };
  function kick() {
    if (raf || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // Input. The pointer is followed across the whole window so the pig keeps
  // up with a mouse that slips outside the field (the cursor is hidden over it).
  const pointerTo = (e: PointerEvent) => {
    pig.targetX = e.clientX - canvas.getBoundingClientRect().left;
  };
  const onPointerMove = (e: PointerEvent) => { if (phase === 'playing') pointerTo(e); };
  const onPointerDown = (e: PointerEvent) => {
    if (phase !== 'playing') return;
    pointerTo(e);
    if (e.pointerType !== 'mouse') field.setPointerCapture?.(e.pointerId);
  };
  const LEFT = ['ArrowLeft', 'a', 'A'], RIGHT = ['ArrowRight', 'd', 'D'];
  // Keys only count while the game has focus (or nothing else does), and never
  // with a modifier, so browser shortcuts and typing elsewhere keep working.
  const onKeyDown = (e: KeyboardEvent) => {
    if (phase !== 'playing' && phase !== 'paused') return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    const inGame = target === canvas || (target !== null && field.contains(target));
    if (phase === 'playing' && (inGame || target === document.body)) {
      if (LEFT.includes(e.key)) { keys.left = true; e.preventDefault(); return; }
      if (RIGHT.includes(e.key)) { keys.right = true; e.preventDefault(); return; }
      if (e.key === ' ') { e.preventDefault(); if (!e.repeat) pause(); return; }
    }
    if (phase === 'paused' && e.key === ' ' && target === canvas) {
      e.preventDefault();
      if (!e.repeat) resume();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (LEFT.includes(e.key)) keys.left = false;
    if (RIGHT.includes(e.key)) keys.right = false;
  };
  const onHidden = () => { if (document.hidden) pause(); };
  // Tabbing or clicking away from the game pauses it, so it never plays on unseen.
  const onFocusOut = (e: FocusEvent) => {
    if (!field.contains(e.relatedTarget as Node | null)) pause();
  };

  window.addEventListener('pointermove', onPointerMove);
  field.addEventListener('pointerdown', onPointerDown);
  field.addEventListener('focusout', onFocusOut);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', onHidden);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  // Scrolled out of view: pause, and stop drawing until it comes back.
  const viewObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) kick(); else pause();
  });
  viewObserver.observe(field);

  resize();
  setPhase('ready');

  return {
    start,
    pause,
    resume,
    destroy() {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      viewObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      field.removeEventListener('pointerdown', onPointerDown);
      field.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', onHidden);
    },
  };
}
