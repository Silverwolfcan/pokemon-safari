(function () {
  const NS = window.SafariGame = window.SafariGame || {};

  if (!NS.Game) {
    console.error("[Pokémon Safari] aim-ui.js: NS.Game todavía no existe.");
    return;
  }

  const COLORS = {
    ball: {
      main: '#f7f8ff',
      dark: '#496da8',
      glow: 'rgba(151,198,255,.75)',
      cursor: '#65b7ff'
    },
    bait: {
      main: '#ffd968',
      dark: '#9c6817',
      glow: 'rgba(255,217,104,.75)',
      cursor: '#ffd34d'
    },
    rock: {
      main: '#d6ddd9',
      dark: '#5a6963',
      glow: 'rgba(205,218,212,.72)',
      cursor: '#b9c5c0'
    }
  };

  function colorFor(type) {
    return COLORS[type] || COLORS.ball;
  }

  function drawRoundedBar(ctx, x, y, width, height, charge, colors) {
    const radius = height / 2;

    ctx.save();

    // Fondo
    ctx.fillStyle = 'rgba(5,16,31,.86)';
    ctx.strokeStyle = 'rgba(255,255,255,.72)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    ctx.stroke();

    // Carga
    const innerPad = 3;
    const innerW = Math.max(0, (width - innerPad * 2) * charge);

    if (innerW > 0) {
      const grad = ctx.createLinearGradient(x, 0, x + width, 0);

      if (charge < .55) {
        grad.addColorStop(0, colors.main);
        grad.addColorStop(1, '#ffe168');
      } else {
        grad.addColorStop(0, '#ffe168');
        grad.addColorStop(1, '#ff765e');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(
        x + innerPad,
        y + innerPad,
        innerW,
        height - innerPad * 2,
        Math.max(2, (height - innerPad * 2) / 2)
      );
      ctx.fill();
    }

    ctx.restore();
  }

  function drawArrow(ctx, px, py, nx, ny, length, colors, charge) {
    const start = 30;
    const shaftEnd = Math.max(start + 20, length - 24);

    const sx = px + nx * start;
    const sy = py + ny * start;
    const ex = px + nx * shaftEnd;
    const ey = py + ny * shaftEnd;

    ctx.save();

    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Flecha
    const tipX = px + nx * length;
    const tipY = py + ny * length;
    const sideX = -ny;
    const sideY = nx;
    const headLength = 30 + charge * 8;
    const headWidth = 17 + charge * 5;

    const baseX = tipX - nx * headLength;
    const baseY = tipY - ny * headLength;

    ctx.fillStyle = colors.main;
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      baseX + sideX * headWidth,
      baseY + sideY * headWidth
    );
    ctx.lineTo(
      baseX - sideX * headWidth,
      baseY - sideY * headWidth
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function drawPointer(ctx, x, y, type) {
    const colors = colorFor(type);

    ctx.save();
    ctx.translate(x, y);

    // Sombra exterior para que se vea sobre cualquier bioma.
    ctx.shadowColor = 'rgba(0,0,0,.85)';
    ctx.shadowBlur = 5;

    /*
      Cursor tipo puntero de ratón, algo más grande que uno normal.
      La silueta negra hace que siga siendo visible sobre agua, arena,
      hierba o sprites.
    */
    ctx.fillStyle = '#10151d';
    ctx.beginPath();
    ctx.moveTo(-2, -3);
    ctx.lineTo(21, 7);
    ctx.lineTo(11, 11);
    ctx.lineTo(17, 24);
    ctx.lineTo(11, 27);
    ctx.lineTo(5, 14);
    ctx.lineTo(-2, 20);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = colors.cursor;
    ctx.beginPath();
    ctx.moveTo(1, 1);
    ctx.lineTo(17, 8);
    ctx.lineTo(8, 11);
    ctx.lineTo(13, 22);
    ctx.lineTo(10, 23);
    ctx.lineTo(5, 13);
    ctx.lineTo(1, 17);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  /*
    Sustituye completamente el antiguo apuntado:
    - flecha grande
    - barra de carga sobre el jugador
    - cursor personalizado por herramienta
  */
  function drawCooldownBadge(ctx, x, y, seconds) {
    ctx.save();

    ctx.fillStyle = 'rgba(65,70,78,.72)';
    ctx.strokeStyle = 'rgba(255,255,255,.76)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(x,y,16,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(seconds.toFixed(1),x,y+1);

    ctx.restore();
  }

  function drawItemGlyph(ctx, x, y, type) {
    ctx.save();

    if (type === 'ball') {
      ctx.fillStyle = '#f2f2ed';
      ctx.beginPath();
      ctx.arc(x,y,9,0,Math.PI*2);
      ctx.fill();

      ctx.fillStyle = '#dd4b43';
      ctx.beginPath();
      ctx.arc(x,y,9,Math.PI,0);
      ctx.fill();

      ctx.strokeStyle = '#242424';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x-9,y);
      ctx.lineTo(x+9,y);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x,y,2.5,0,Math.PI*2);
      ctx.fill();
    } else if (type === 'bait') {
      // Mismo icono de cebo que ya usamos sobre el jugador.
      ctx.fillStyle = '#d79d45';
      ctx.beginPath();
      ctx.arc(x,y,8,0,Math.PI*2);
      ctx.fill();

      ctx.fillStyle = '#f2d66d';
      ctx.beginPath();
      ctx.arc(x-3,y-2,2,0,Math.PI*2);
      ctx.fill();
    } else {
      // Mismo icono de piedra que ya usamos sobre el jugador.
      ctx.fillStyle = '#8b9490';
      ctx.beginPath();
      ctx.arc(x,y,8,0,Math.PI*2);
      ctx.fill();

      ctx.fillStyle = '#c3cbc7';
      ctx.beginPath();
      ctx.arc(x-3,y-3,3,0,Math.PI*2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawMiniItemIcon(ctx, x, y, type, quantity = 0) {
    ctx.save();

    ctx.fillStyle = 'rgba(16,24,36,.78)';
    ctx.strokeStyle = 'rgba(255,255,255,.78)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(x,y,16,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();

    drawItemGlyph(ctx,x,y,type);

    // Cantidad del objeto, siempre visible.
    const amount = Math.max(0, Number(quantity || 0));

    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    // Sombra para mantener legibilidad sobre cualquier icono.
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.88)';
    ctx.strokeText(String(amount), x + 13, y + 14);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(amount), x + 13, y + 14);

    // Si no quedan unidades, una X roja cruza el icono.
    if (amount <= 0) {
      ctx.strokeStyle = '#ff4040';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(x - 10, y - 10);
      ctx.lineTo(x + 10, y + 10);
      ctx.moveTo(x + 10, y - 10);
      ctx.lineTo(x - 10, y + 10);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Fuente única de verdad para los iconos de Ball/Cebo/Piedra.
  // Otros renderers (por ejemplo pickups del mundo) reutilizan exactamente
  // el mismo dibujo en vez de imitarlo por separado.
  NS.ItemIcons = NS.ItemIcons || {};
  NS.ItemIcons.drawGlyph = drawItemGlyph;


  function drawPlayerThrowStatus(ctx, game) {
    const px = game.player.x - game.camera.x + game.width / 2;
    const py = game.player.y - game.camera.y + game.height / 2;

    const currentType = game.mouse.left
      ? 'ball'
      : game.mouse.right
        ? game.tool
        : (game.selectedThrowDisplay || game.lastThrownType || 'ball');

    // Siempre visible: objeto cargado o último objeto lanzado.
    const quantity =
      currentType === 'ball'
        ? game.balls
        : currentType === 'bait'
          ? game.bait
          : game.rocks;

    drawMiniItemIcon(
      ctx,
      px,
      py-103,
      currentType,
      quantity
    );

    // El CD solo aparece mientras está activo.
    if ((game.throwCooldownRemaining || 0) > 0.01) {
      drawCooldownBadge(
        ctx,
        px,
        py-70,
        game.throwCooldownRemaining
      );
    }
  }

  NS.Game.prototype.drawAim = function (ctx) {
    const charging = this.mouse.left || this.mouse.right;

    // Incluso sin estar cargando mostramos el cursor personalizado.
    const passiveType = this.tool || 'bait';

    if (!charging) {
      drawPointer(
        ctx,
        this.mouse.x,
        this.mouse.y,
        passiveType
      );

      drawPlayerThrowStatus(ctx,this);
      return;
    }

    const type = this.mouse.left ? 'ball' : this.tool;
    const charge = this.mouse.left
      ? this.mouse.charge
      : this.mouse.rightCharge;

    const colors = colorFor(type);

    const px = this.player.x - this.camera.x + this.width / 2;
    const py = this.player.y - this.camera.y + this.height / 2;

    const dx = this.mouse.x - px;
    const dy = this.mouse.y - py;
    const distance = Math.hypot(dx, dy) || 1;

    const nx = dx / distance;
    const ny = dy / distance;

    // Flecha más gruesa y visible. Aumenta con la carga.
    const arrowLength = 90 + charge * 130;

    drawArrow(
      ctx,
      px,
      py,
      nx,
      ny,
      arrowLength,
      colors,
      charge
    );

    // Barra más pequeña, justo sobre la cabeza del entrenador.
    const barWidth = 92;
    const barHeight = 10;
    const barX = px - barWidth / 2;
    const barY = py - 78;

    drawRoundedBar(
      ctx,
      barX,
      barY,
      barWidth,
      barHeight,
      charge,
      colors
    );

    // Cursor coloreado según lo que se está apuntando.
    drawPointer(
      ctx,
      this.mouse.x,
      this.mouse.y,
      type
    );

    drawPlayerThrowStatus(ctx,this);
  };

  /*
    El juego ya puede dibujar su propio puntero: escondemos el cursor
    nativo incluso si style.css tarda un instante en aplicarse.
  */
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) canvas.style.cursor = 'none';

    const oldChargeBar = document.getElementById('chargeBar');
    if (oldChargeBar) oldChargeBar.style.display = 'none';
  });

  console.info("[Pokémon Safari] Interfaz de apuntado renovada.");
})();
