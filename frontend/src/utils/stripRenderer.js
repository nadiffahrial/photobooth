/**
 * 3-Strip Vertical Canvas Engine with 6 Unique Themes
 * Dimensions: 800px x 1980px
 */

function drawCoverImage(ctx, img, x, y, w, h, radius = 0) {
  if (!img) return;
  // If HTMLImageElement, check if successfully loaded and valid
  if (img instanceof HTMLImageElement && (!img.complete || img.naturalWidth === 0)) {
    return;
  }
  const imgW = img.videoWidth || img.naturalWidth || img.width || 1;
  const imgH = img.videoHeight || img.naturalHeight || img.height || 1;
  const srcRatio = imgW / imgH;
  const dstRatio = w / h;
  let sx, sy, sWidth, sHeight;

  if (srcRatio > dstRatio) {
    sHeight = imgH;
    sWidth = imgH * dstRatio;
    sx = (imgW - sWidth) / 2;
    sy = 0;
  } else {
    sWidth = imgW;
    sHeight = imgW / dstRatio;
    sx = 0;
    sy = (imgH - sHeight) / 2;
  }

  ctx.save();
  if (radius > 0) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, radius);
    else ctx.rect(x, y, w, h);
    ctx.clip();
  }
  try {
    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
  } catch (err) {
    console.warn('[stripRenderer] Error drawing image frame:', err);
  }
  ctx.restore();
}

function drawBarcode(ctx, x, y, width, height, color = '#ffffff') {
  ctx.save();
  ctx.fillStyle = color;
  const pattern = [3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 3, 4, 2, 1, 3];
  const totalUnits = pattern.reduce((a, b) => a + b, 0) + (pattern.length - 1);
  const unitWidth = width / totalUnits;
  let curX = x;
  pattern.forEach((weight, i) => {
    if (i % 2 === 0) ctx.fillRect(curX, y, weight * unitWidth, height);
    curX += (weight + 1) * unitWidth;
  });
  ctx.restore();
}

function drawSprocketHoles(ctx, totalH) {
  ctx.save();
  ctx.fillStyle = '#222226';
  ctx.strokeStyle = '#18181a';
  ctx.lineWidth = 1;
  const holeW = 20;
  const holeH = 14;
  const step = 34;
  for (let y = 20; y < totalH - 20; y += step) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(16, y, holeW, holeH, 4);
      ctx.roundRect(800 - 16 - holeW, y, holeW, holeH, 4);
    } else {
      ctx.rect(16, y, holeW, holeH);
      ctx.rect(800 - 16 - holeW, y, holeW, holeH);
    }
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawCornerBrackets(ctx, x, y, w, h, color, bracketLen = 26, thickness = 4) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'square';
  // Top-left
  ctx.beginPath();
  ctx.moveTo(x, y + bracketLen); ctx.lineTo(x, y); ctx.lineTo(x + bracketLen, y); ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + w - bracketLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + bracketLen); ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + h - bracketLen); ctx.lineTo(x, y + h); ctx.lineTo(x + bracketLen, y + h); ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w - bracketLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - bracketLen); ctx.stroke();
  ctx.restore();
}

function drawRubberStamp(ctx, cx, cy, radius, text, subtext, color = '#8B261E') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-11 * Math.PI / 180);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.arc(0, 0, radius - 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, -6);

  ctx.font = '9px "DM Sans", sans-serif';
  ctx.fillText(subtext, 0, 10);
  ctx.restore();
}

export function render3StripCanvas(canvas, framesInput = [], theme = 'film-noir') {
  if (!canvas) return;
  const W = 800;
  const H = 1980;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const photoW = 680;
  const photoH = 510;
  const px = 60;
  const py = [140, 680, 1220];

  const f0 = framesInput[0] || null;
  const f1 = framesInput[1] || f0;
  const f2 = framesInput[2] || f1;
  const frames = [f0, f1, f2];

  ctx.clearRect(0, 0, W, H);

  /* 1. FILM NOIR (35MM KODAK) */
  if (theme === 'film-noir') {
    ctx.fillStyle = '#101013';
    ctx.fillRect(0, 0, W, H);
    drawSprocketHoles(ctx, H);

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 17px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◆ KODAK SAFETY FILM 5063 · 35MM · ISO 400 ◆', W / 2, 75);
    ctx.fillStyle = '#8B8B94';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('SNAP STUDIO ARCHIVES · EXPOSURE 24+ · HIGH DEFINITION', W / 2, 98);

    frames.forEach((img, i) => {
      const y = py[i];
      ctx.fillStyle = '#D4AF37';
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`0${i + 1} ▶  35MM FRAME`, px, y - 10);

      ctx.fillStyle = '#1a1a1f';
      ctx.fillRect(px - 3, y - 3, photoW + 6, photoH + 6);
      drawCoverImage(ctx, img, px, y, photoW, photoH, 0);

      ctx.strokeStyle = '#2d2d34';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, y, photoW, photoH);
    });

    const now = new Date();
    const dateStr = `'98  ${String(now.getMonth() + 1).padStart(2, '0')}  ${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    ctx.save();
    ctx.fillStyle = '#FF7A00';
    ctx.shadowColor = '#FF5500';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(dateStr, W / 2, 1795);
    ctx.restore();

    drawBarcode(ctx, 240, 1835, 320, 36, '#D4AF37');
    ctx.fillStyle = '#8A8A92';
    ctx.font = '12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SN-35MM-NOIR-7702 · SNAP STUDIO KODAK REEL', W / 2, 1895);
  }

  /* 2. HARU PASTEL (KOREA LIFE FOUR CUTS) */
  else if (theme === 'haru-pastel') {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#FFF0F3');
    bgGrad.addColorStop(0.5, '#FCE7EB');
    bgGrad.addColorStop(1, '#FDE2E4');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#844365';
    ctx.font = 'bold 36px "DM Sans", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('하루 필름 · HARU FILM', W / 2, 72);

    ctx.fillStyle = '#B36D8E';
    ctx.font = 'bold 13px "DM Sans", sans-serif';
    ctx.fillText('♡ PRECIOUS MOMENTS TODAY ♡', W / 2, 98);

    frames.forEach((img, i) => {
      const y = py[i];
      const cardX = px - 12;
      const cardY = y - 12;
      const cardW = photoW + 24;
      const cardH = photoH + 24;

      ctx.save();
      ctx.shadowColor = 'rgba(180, 120, 145, 0.22)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 18);
      else ctx.rect(cardX, cardY, cardW, cardH);
      ctx.fill();
      ctx.restore();

      drawCoverImage(ctx, img, px, y, photoW, photoH, 12);

      if (i < 2) {
        ctx.fillStyle = '#C2829D';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✧   ✦   ♡   ✦   ✧', W / 2, y + photoH + 20);
      }
    });

    ctx.fillStyle = '#783A59';
    ctx.font = 'bold 22px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('우리들의 가장 빛나는 순간들 ✨', W / 2, 1785);

    const now = new Date();
    const dateFormatted = `${now.getFullYear()}. ${String(now.getMonth() + 1).padStart(2, '0')}. ${String(now.getDate()).padStart(2, '0')}`;
    ctx.fillText(`SNAP STUDIO SEOUL · ${dateFormatted}`, W / 2, 1815);

    ctx.fillStyle = '#C2829D';
    ctx.font = '24px sans-serif';
    ctx.fillText('🎀 ♡ 🌸', W / 2, 1855);
  }

  /* 3. Y2K CYBER */
  else if (theme === 'y2k-cyber') {
    const cyberGrad = ctx.createLinearGradient(0, 0, 0, H);
    cyberGrad.addColorStop(0, '#090514');
    cyberGrad.addColorStop(1, '#150A26');
    ctx.fillStyle = cyberGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#1D0E38';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += 40) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    ctx.save();
    ctx.fillStyle = '#00F0FF';
    ctx.shadowColor = '#00F0FF';
    ctx.shadowBlur = 12;
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('// SNAP_CYBER_MATRIX_2000 //', W / 2, 68);
    ctx.restore();

    ctx.fillStyle = '#39FF14';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[STATUS: LIVE REC] ● 60FPS · ISO 800 · HD TECH', W / 2, 94);

    frames.forEach((img, i) => {
      const y = py[i];
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px, y, photoW, photoH);
      drawCoverImage(ctx, img, px, y, photoW, photoH, 4);
      drawCornerBrackets(ctx, px - 6, y - 6, photoW + 12, photoH + 12, '#FF007F', 24, 4);

      ctx.fillStyle = '#39FF14';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`CAM_0${i + 1} [ACTIVE]`, px + 8, y + 22);
    });

    drawBarcode(ctx, 220, 1780, 360, 42, '#00F0FF');
    ctx.fillStyle = '#FF007F';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SERIAL # 992-04-Y2K-NEON · SNAP TECH SYS', W / 2, 1845);
  }

  /* 4. VINTAGE RETRO */
  else if (theme === 'vintage-retro') {
    ctx.fillStyle = '#F5EEDA';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#4A3423';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.lineWidth = 1;
    ctx.strokeRect(32, 32, W - 64, H - 64);

    ctx.fillStyle = '#342214';
    ctx.font = 'bold 36px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE DAILY SNAPSHOT', W / 2, 74);

    ctx.font = 'italic 15px Georgia, serif';
    ctx.fillStyle = '#5A3D28';
    ctx.fillText('~ ❦ Special Edition · Volume CXXVI · Est. 1926 ❦ ~', W / 2, 98);

    const plateTitles = ['PLATE I. CANDID STUDY', 'PLATE II. MOMENT IN TIME', 'PLATE III. TIMELESS MEMORY'];
    frames.forEach((img, i) => {
      const y = py[i];
      ctx.fillStyle = '#FFFDF7';
      ctx.fillRect(px - 8, y - 8, photoW + 16, photoH + 16);
      ctx.strokeStyle = '#5A3D28';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px - 8, y - 8, photoW + 16, photoH + 16);

      drawCoverImage(ctx, img, px, y, photoW, photoH, 0);

      ctx.font = 'italic 13px Georgia, serif';
      ctx.fillStyle = '#4A3423';
      ctx.textAlign = 'center';
      ctx.fillText(`— ${plateTitles[i]} —`, W / 2, y + photoH + 20);
    });

    drawRubberStamp(ctx, 220, 1835, 54, 'CERTIFIED', 'SNAP STUDIO 1926', '#8B261E');
    ctx.font = 'italic 16px Georgia, serif';
    ctx.fillStyle = '#342214';
    ctx.textAlign = 'left';
    ctx.fillText('"Every picture tells a story', 310, 1815);
    ctx.fillText('that time cannot erase."', 310, 1838);
  }

  /* 5. MINIMAL LUXURY */
  else if (theme === 'minimal-luxury') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#111111';
    ctx.font = '36px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('A T E L I E R', W / 2, 70);

    ctx.strokeStyle = '#C5A059';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 80, 88); ctx.lineTo(W / 2 + 80, 88);
    ctx.stroke();

    ctx.fillStyle = '#777777';
    ctx.font = '11px "DM Sans", sans-serif';
    ctx.fillText('AUTUMN / WINTER COLLECTION · EDITION N° 03', W / 2, 108);

    const romans = ['I', 'II', 'III'];
    frames.forEach((img, i) => {
      const y = py[i];
      ctx.strokeStyle = '#EEEEEE';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, y, photoW, photoH);
      drawCoverImage(ctx, img, px, y, photoW, photoH, 0);

      ctx.fillStyle = '#A0A0A0';
      ctx.font = '15px "Playfair Display", Georgia, serif';
      ctx.textAlign = 'right';
      ctx.fillText(romans[i], px + photoW - 10, y + photoH - 12);
    });

    ctx.fillStyle = '#111111';
    ctx.font = '18px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.fillText('S N A P   S T U D I O', W / 2, 1795);

    ctx.fillStyle = '#C5A059';
    ctx.font = '10px "DM Sans", sans-serif';
    ctx.fillText('✦ LIMITED EDITION 03 / 500 ✦', W / 2, 1840);
  }

  /* 6. MATCHA KAWAII */
  else if (theme === 'matcha-kawaii') {
    const matchaGrad = ctx.createLinearGradient(0, 0, 0, H);
    matchaGrad.addColorStop(0, '#D4DEC9');
    matchaGrad.addColorStop(1, '#C2CFB5');
    ctx.fillStyle = matchaGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#3B5237';
    ctx.font = 'bold 36px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('matcha club 🍵', W / 2, 72);

    ctx.fillStyle = '#55724F';
    ctx.font = 'bold 13px "DM Sans", sans-serif';
    ctx.fillText('🌿 fresh moments & sweet vibes ☘️', W / 2, 98);

    frames.forEach((img, i) => {
      const y = py[i];
      const cardX = px - 10;
      const cardY = y - 10;
      const cardW = photoW + 20;
      const cardH = photoH + 20;

      ctx.save();
      ctx.shadowColor = 'rgba(59, 82, 55, 0.16)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#FFFDF7';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 20);
      else ctx.rect(cardX, cardY, cardW, cardH);
      ctx.fill();
      ctx.restore();

      drawCoverImage(ctx, img, px, y, photoW, photoH, 14);

      if (i < 2) {
        ctx.fillStyle = '#4F6D4A';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('☘️   ♡   🌿   ♡   ☘️', W / 2, y + photoH + 18);
      }
    });

    ctx.fillStyle = '#344B30';
    ctx.font = 'bold 24px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('best day ever! ( ˶ˆᗜˆ˵ ) 🍵', W / 2, 1785);

    ctx.fillStyle = '#516E4C';
    ctx.font = '13px "DM Sans", sans-serif';
    ctx.fillText('✦ snap studio · matcha edition · 2026 ✦', W / 2, 1815);
  }
}

