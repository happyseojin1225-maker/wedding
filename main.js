 (() => {
   // =========================
   // 0) 기본 세팅
   // =========================
   const canvas = document.getElementById("c");
   const ctx = canvas.getContext("2d");

   const ASSETS = {
     bg: "assets/bg_night.jpg",
     characterBack: "assets/character_back.png",
     characterBackLook: "assets/character_back_look.png",
     arrow: "assets/arrow.png",
     star: "assets/star.png",
     dadFront: "assets/dad_front.png",
     between: "assets/between.png",
     centerPhoto: "assets/center_photo.png",
   };

   const SCENE = {
     PAN_ONLY: 0,        // 파노라마만 흐름
     PAN_STOP_WALK: 1,   // 배경 멈추고 캐릭터 걸어옴
     NECK_HINT: 2,       // 목 클릭 유도
     ARROW_HINT: 3,      // 화살표 클릭 유도
     ARROW_GROW: 4,      // 화살표 커짐 + 가운데 별 커짐
     STAR_READY: 5,
     BETWEEN_HINT: 6,    // between 이미지 클릭 유도
     CENTER_PHOTO: 7,    // 중앙 사진 + 별똥별
   };

   const state = {
     scene: SCENE.PAN_ONLY,
     t: 0,
     last: 0,

     W: 0,
     H: 0,

     assets: {},

     // 파노라마
     bgScrollX: 0,
     bgSpeed: 7,      // 파노라마 속도 (원하면 5~9 사이)
     bgMoving: true,  // 씬에 따라 멈춤

     // 캐릭터
     character: {
       x: 0,
       y: 0,
       w: 0,
       h: 0,
       yCurrent: 0,
       walking: false,
       lookingUp: false,
       mode: "back"
     },

     // 화살표
     arrow: {
       visible: false,
       x: 0,
       y: 0,
       w: 90,
       h: 90,

       scale: 1,
       targetScale: 1,
       animating: false,

       showStar: false,
       starScale: 0,
       starTargetScale: 0,
       starAnimating: false,
     },

     // 클릭 유도(깜빡 원)
     hint: {
       visible: false,
       x: 0,
       y: 0,
       r: 26,
       pulse: 0,
     },

     showBetweenImage: false,
     betweenRect: { x: 0, y: 0, w: 0, h: 0 },
     betweenClickable: false,

     centerPhotoVisible: false,
     centerPhotoAlpha: 0,
     meteors: [],
     meteorSpawnAcc: 0,
     meteorsOn: false
   };

   // =========================
   // 1) 유틸
   // =========================
   function resize() {
     const dpr = Math.max(1, window.devicePixelRatio || 1);
     const rect = canvas.getBoundingClientRect();

     canvas.width = Math.floor(rect.width * dpr);
     canvas.height = Math.floor(rect.height * dpr);

     ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
     state.W = rect.width;
     state.H = rect.height;

     layout();
   }

   function layout() {
     const { W, H } = state;

     // 캐릭터 크기/위치(화면 가운데 아래)
     const c = state.character;
     c.h = Math.min(H * 0.42, 400);
     c.w = c.h * 0.42;
     c.x = W * 0.5;
     c.y = H * 0.98;

     // 시작은 화면 아래에 숨김
     if (!c.walking) {
       c.yCurrent = H + c.h;
     }

     // 화살표 위치
     const a = state.arrow;
     a.x = W * 0.55;
     a.y = H * 0.16;
     a.w = Math.min(110, W * 0.18);
     a.h = a.w;
   }

   function loadImage(src) {
     return new Promise((resolve, reject) => {
       const img = new Image();
       img.onload = () => resolve(img);
       img.onerror = () => reject(new Error("Failed to load: " + src));
       img.src = src;
     });
   }

   function setHint(x, y) {
     state.hint.visible = true;
     state.hint.x = x;
     state.hint.y = y;
     state.hint.pulse = 0;
   }

   function hideHint() {
     state.hint.visible = false;
   }

   function getCanvasXY(e) {
     const rect = canvas.getBoundingClientRect();
     const x = (e.clientX - rect.left);
     const y = (e.clientY - rect.top);
     return { x, y };
   }

   function hitCenteredRect(px, py, cx, cy, w, h) {
     const left = cx - w / 2;
     const top = cy - h / 2;
     return (px >= left && px <= left + w && py >= top && py <= top + h);
   }

   function hitCircle(px, py, cx, cy, r) {
     const dx = px - cx;
     const dy = py - cy;
     return (dx * dx + dy * dy) <= (r * r);
   }

   // ✅ 추가: between 이미지 중심 좌표를 "항상 동일하게" 계산 (힌트/클릭 둘 다 여기 기준)
   function getBetweenCenter() {
     const c = state.character;
     const a = state.arrow;
     const midX = c.x + state.W * 0.03;
     const midY = (c.yCurrent - c.h * 0.4 + a.y) / 2 - state.H * 0.04;
     return { midX, midY };
   }

   // =========================
   // 2) 그리기
   // =========================
   function drawBackground(dt) {
     const { bg } = state.assets;
     const { W, H } = state;

     ctx.fillStyle = "#05060b";
     ctx.fillRect(0, 0, W, H);
     if (!bg) return;

     const scale = Math.max(W / bg.width, H / bg.height) * 0.82;
     const dw = bg.width * scale;
     const dh = bg.height * scale;

     if (state.bgMoving) {
       const breeze = 1 + 0.10 * Math.sin(state.t * 0.30);
       state.bgScrollX = (state.bgScrollX + state.bgSpeed * breeze * dt) % dw;
     }

     const x1 = -state.bgScrollX;
     const x2 = x1 + dw;
     const y = (H - dh) / 2;

     ctx.drawImage(bg, x1, y, dw, dh);
     ctx.drawImage(bg, x2, y, dw, dh);

     ctx.fillStyle = "rgba(0,0,0,0.32)";
     ctx.fillRect(0, 0, W, H);

     ctx.fillStyle = "rgba(10,18,40,0.07)";
     ctx.fillRect(0, 0, W, H);
   }

   function drawCharacter() {
     const c = state.character;
     const { characterBack, characterBackLook } = state.assets;

     let img = characterBack;
     if (c.mode === "look") img = characterBackLook;
     if (c.mode === "front") img = state.assets.dadFront;

     if (!img) return;

     const iw = img.width;
     const ih = img.height;
     const s = Math.min(c.w / iw, c.h / ih);
     const dw = iw * s;
     const dh = ih * s;

     const dx = c.x - dw / 2;
     const dy = c.yCurrent - dh;

     ctx.drawImage(img, dx, dy, dw, dh);
   }

   function drawBetweenImage() {
     if (!state.showBetweenImage) return;

     const img = state.assets.between;
     if (!img) return;

     const { midX, midY } = getBetweenCenter();
     const size = Math.min(state.W, state.H) * 0.14;

     state.betweenRect.x = midX - size / 2;
     state.betweenRect.y = midY - size / 2;
     state.betweenRect.w = size;
     state.betweenRect.h = size;

     ctx.drawImage(img, midX - size / 2, midY - size / 2, size, size);
   }

   function drawCenterPhoto() {
     if (!state.centerPhotoVisible) return;

     const img = state.assets.centerPhoto;
     if (!img) return;

     const W = state.W, H = state.H;
     const maxSize = Math.min(W, H) * 0.92;

     const s = Math.min(maxSize / img.width, maxSize / img.height);
     const dw = img.width * s;
     const dh = img.height * s;

     const x = (W - dw) / 2;
     const y = (H - dh) / 2 - H * 0.05;

     ctx.save();
     ctx.globalAlpha = state.centerPhotoAlpha;
     ctx.drawImage(img, x, y, dw, dh);
     ctx.restore();
   }

   function spawnMeteor() {
     const W = state.W, H = state.H;
     const m = {
       x: Math.random() * W * 1.1,
       y: -Math.random() * H * 0.2,
       vx: -(W * (0.6 + Math.random() * 0.6)),
       vy: (H * (0.7 + Math.random() * 0.6)),
       life: 0.65 + Math.random() * 0.55,
       age: 0,
       len: 80 + Math.random() * 140,
       w: 1.2 + Math.random() * 1.8
     };
     state.meteors.push(m);
   }

   function updateMeteors(dt) {
     if (!state.meteorsOn) return;

     state.meteorSpawnAcc += dt;
     const spawnEvery = 0.18;
     while (state.meteorSpawnAcc >= spawnEvery) {
       state.meteorSpawnAcc -= spawnEvery;
       spawnMeteor();
     }

     const arr = state.meteors;
     for (let i = arr.length - 1; i >= 0; i--) {
       const m = arr[i];
       m.age += dt;
       m.x += m.vx * dt;
       m.y += m.vy * dt;

       if (m.age > m.life || m.x < -300 || m.y > state.H + 300) {
         arr.splice(i, 1);
       }
     }
   }

   function drawMeteors() {
     if (!state.meteorsOn) return;

     ctx.save();
     ctx.lineCap = "round";

     for (const m of state.meteors) {
       const t = m.age / m.life;
       const a = Math.max(0, 1 - t);

       const nx = -m.vx;
       const ny = -m.vy;
       const nlen = Math.hypot(nx, ny) || 1;
       const ux = nx / nlen;
       const uy = ny / nlen;

       const x2 = m.x + ux * m.len;
       const y2 = m.y + uy * m.len;

       ctx.globalAlpha = 0.55 * a;
       ctx.strokeStyle = "rgba(255,255,255,1)";
       ctx.lineWidth = m.w;

       ctx.beginPath();
       ctx.moveTo(m.x, m.y);
       ctx.lineTo(x2, y2);
       ctx.stroke();
     }

     ctx.restore();
   }

   function drawArrow() {
     const a = state.arrow;
     if (!a.visible) return;

     const { arrow, star } = state.assets;

     const w = a.w * a.scale;
     const h = a.h * a.scale;

     const x = a.x - w / 2;
     const y = a.y - h / 2;

     if (arrow) ctx.drawImage(arrow, x, y, w, h);

     if (a.showStar && star) {
       const sSize = Math.min(w, h) * a.starScale;
       ctx.drawImage(star, a.x - sSize / 2, a.y - sSize / 2, sSize, sSize);
     }
   }

   function drawHint(dt) {
     if (!state.hint.visible) return;

     state.hint.pulse += dt;
     const p = 0.5 + 0.5 * Math.sin(state.hint.pulse * 4.0);

     ctx.save();
     ctx.globalAlpha = 0.35 + 0.35 * p;

     ctx.strokeStyle = "rgba(255,255,255,0.95)";
     ctx.lineWidth = 3;
     ctx.beginPath();
     ctx.arc(state.hint.x, state.hint.y, state.hint.r * (1.0 + 0.10 * p), 0, Math.PI * 2);
     ctx.stroke();

     ctx.globalAlpha = 0.20 + 0.25 * p;
     ctx.lineWidth = 2;
     ctx.beginPath();
     ctx.arc(state.hint.x, state.hint.y, state.hint.r * 0.45, 0, Math.PI * 2);
     ctx.stroke();

     ctx.restore();
   }

   // =========================
   // 3) 업데이트(애니메이션/씬)
   // =========================
   function update(dt) {
     const c = state.character;
     const a = state.arrow;

     // 캐릭터 걷기
     if (c.walking) {
       const targetY = c.y;
       const speed = Math.max(180, state.H * 0.17);
       c.yCurrent = Math.max(targetY, c.yCurrent - speed * dt);

       if (Math.abs(c.yCurrent - targetY) < 1) {
         c.yCurrent = targetY;
         c.walking = false;
         state.scene = SCENE.NECK_HINT;

         const neckX = c.x;
         const neckY = c.yCurrent - c.h * 0.78;
         setHint(neckX, neckY);
       }
     }

     // arrow scale
     if (a.animating) {
       const speed = 4.0;
       a.scale += (a.targetScale - a.scale) * Math.min(1, speed * dt);

       if (Math.abs(a.targetScale - a.scale) < 0.01) {
         a.scale = a.targetScale;
         a.animating = false;
       }
     }

     // star scale
     if (a.starAnimating) {
       const speed = 5.0;
       a.starScale += (a.starTargetScale - a.starScale) * Math.min(1, speed * dt);
       if (Math.abs(a.starTargetScale - a.starScale) < 0.01) {
         a.starScale = a.starTargetScale;
         a.starAnimating = false;

         hideHint();
         state.scene = SCENE.STAR_READY;

         state.showBetweenImage = true;

         // 2초 뒤 아빠 앞모습
         setTimeout(() => {
           state.character.mode = "front";
         }, 290);

         // ✅ 핵심: between 힌트가 안 뜨던 문제 해결
         // star가 다 커진 후, 조금 기다렸다가 between 클릭 유도 표시 띄우기
         setTimeout(() => {
           if (!state.showBetweenImage) return;

           state.betweenClickable = true;
           state.scene = SCENE.BETWEEN_HINT;

           // rect 안 믿고, between 중심 계산으로 힌트 고정
           const { midX, midY } = getBetweenCenter();
           setHint(midX, midY);
         }, 900);
       }
     }

     // ✅ 중앙 사진 씬 페이드인 (원래 drawHint 안에 있던 걸 여기로 옮김)
     if (state.scene === SCENE.CENTER_PHOTO) {
       state.centerPhotoAlpha = Math.min(1, state.centerPhotoAlpha + dt * 1.2);
     }

     // ✅ 별똥별 업데이트도 여기에서 (원래 drawHint 안에 있던 걸 여기로 옮김)
     updateMeteors(dt);
   }

   // =========================
   // 4) 메인 루프
   // =========================
   function loop(ts) {
     if (!state.last) state.last = ts;
     const dt = Math.min(0.033, (ts - state.last) / 1000);
     state.last = ts;
     state.t += dt;

     update(dt);

     drawBackground(dt);
     drawCharacter();
     drawBetweenImage();
     drawArrow();
     drawCenterPhoto();
     drawMeteors();
     drawHint(dt);

     requestAnimationFrame(loop);
   }

   // =========================
   // 5) 클릭 이벤트
   // =========================
   canvas.addEventListener("click", (e) => {
     const { x, y } = getCanvasXY(e);
     const c = state.character;
     const a = state.arrow;

     // 목 클릭 (NECK_HINT)
     if (state.scene === SCENE.NECK_HINT) {
       const neckX = c.x;
       const neckY = c.yCurrent - c.h * 0.78;
       const ok = hitCircle(x, y, neckX, neckY, 40);

       if (ok) {
         hideHint();

         c.mode = "look";
         state.scene = SCENE.PAN_STOP_WALK;

         setTimeout(() => {
           a.visible = true;
           a.scale = 1;
           a.targetScale = 1;
           a.animating = false;

           a.showStar = false;
           a.starScale = 0;
           a.starTargetScale = 0;
           a.starAnimating = false;

           state.scene = SCENE.ARROW_HINT;
           setHint(a.x, a.y);
         }, 800);
       }
       return;
     }

     // 화살표 클릭 (ARROW_HINT)
     if (state.scene === SCENE.ARROW_HINT) {
       const w = a.w * a.scale;
       const h = a.h * a.scale;
       const ok = hitCenteredRect(x, y, a.x, a.y, w, h);

       if (ok) {
         hideHint();

         a.animating = true;
         a.targetScale = 1.5;

         a.showStar = true;
         a.starScale = 0.10;
         a.starTargetScale = 0.60;
         a.starAnimating = true;

         state.scene = SCENE.ARROW_GROW;
       }
       return;
     }

     // ⭐ STAR_READY에서 가운데 별 클릭은 "넘어가기"가 아니라, 그냥 유지(원하면 여기서 다음 단계 추가 가능)
     if (state.scene === SCENE.STAR_READY) {
       // 지금 단계에서는 별 클릭 기능을 일부러 비워둠
       return;
     }

     // ✅ between 클릭 (BETWEEN_HINT)
     if (state.scene === SCENE.BETWEEN_HINT && state.betweenClickable) {
       const r = state.betweenRect;
       const ok =
         x >= r.x &&
         x <= r.x + r.w &&
         y >= r.y &&
         y <= r.y + r.h;

       if (ok) {
         hideHint();
         state.betweenClickable = false;

         // arrow/별/비트윈 정리
         a.visible = false;
         a.showStar = false;
         state.showBetweenImage = false;

         // 중앙 사진 시작
         state.centerPhotoVisible = true;
         state.centerPhotoAlpha = 0;

         // 별똥별 시작
         state.meteorsOn = true;
         state.meteors = [];
         state.meteorSpawnAcc = 0;

         state.scene = SCENE.CENTER_PHOTO;
           
           // ✅ CENTER_PHOTO 진입 시: 다른 모든 요소 숨김 (센터포토만 남김)
           state.arrow.visible = false;
           state.arrow.showStar = false;
           state.showBetweenImage = false;
           state.betweenClickable = false;
           hideHint();

           // 캐릭터도 화면에서 없애기(완전 제거)
           state.character.yCurrent = state.H + state.character.h;
       }
       return;
     }
   });

   // =========================
   // 6) 시작
   // =========================
   async function init() {
     resize();
     window.addEventListener("resize", resize);

     const keys = Object.keys(ASSETS);
     for (const k of keys) {
       try {
         state.assets[k] = await loadImage(ASSETS[k]);
       } catch (err) {
         console.error(err);
       }
     }

     state.scene = SCENE.PAN_ONLY;
     state.bgMoving = true;

     setTimeout(() => {
       state.bgMoving = false;
       state.scene = SCENE.PAN_STOP_WALK;

       state.character.walking = true;
       state.character.yCurrent = state.H + state.character.h;

       hideHint();
     }, 3000);

     requestAnimationFrame(loop);
   }

   init();
 })();
