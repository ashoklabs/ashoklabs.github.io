(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────
     MESSAGES
  ───────────────────────────────────────────────────────── */
  var MESSAGES = {
    wave:  ['Houston, I\'ve landed! 🚀', 'All systems nominal.', 'Ready for deployment!', 'The code is strong with this one.'],
    jump:  ['Wheee! Zero gravity! 🌌', 'Bounce bounce bounce!', 'Moon physics activated 🌙'],
    spin:  ['Spinning out of orbit! 🌀', 'Wheee zero-g! 🛸', 'My head… is… spinning…'],
    boost: ['BOOOOOST! 🔥', 'Thrusters at max! 🚀', 'To infinity and beyond!'],
    sleep: ['zzz… deploys can wait… zzz', 'just 5 more minutes… 💤', 'zzz… git push later… zzz'],
    idle:  [
      'CI is green. Ship it! 🟢', 'Have you committed today?',
      'git push --force? Bold choice.', 'kubectl get pods --all-namespaces',
      'One small commit for man… 🌍', 'Containers: just spaceships for code. 🛸',
      'sudo make me a rocket 🚀', 'The logs look fine from up here.',
      'It works on my machine… in space. 🧑‍🚀', 'Have you written tests? I have orbital time.',
    ],
  };

  function pickMsg(type) {
    var list = MESSAGES[type] || MESSAGES.idle;
    return list[Math.floor(Math.random() * list.length)];
  }

  /* ─────────────────────────────────────────────────────────
     CSS  –  animation-expert edition
     Principles applied:
       • Squash & stretch on jump (anticipation → stretch → land-squash → settle)
       • Ground shadow inversely scales with height (sells elevation)
       • Secondary / overlapping motion: arms lag behind body
       • Antenna wobble as tertiary motion
       • Only transform + opacity animated (GPU composited, no reflow)
       • will-change on every moving layer
       • Cubic-bezier tuned per motion type
  ───────────────────────────────────────────────────────── */
  var css = `
    /* ── GPU hints ── */
    #site-bot-char, .a-body-wrap,
    .a-arm, .a-leg, .a-shadow, .a-ant { will-change: transform; }

    /* ── Wrapper ── */
    #site-bot-wrap {
      position: fixed; bottom: 20px; right: 24px; z-index: 9999;
      display: flex; flex-direction: column; align-items: center;
      cursor: pointer; user-select: none; -webkit-user-select: none;
      transition: right .05s linear;
    }

    /* ── Speech bubble ── */
    #site-bot-bubble {
      background: #071e4a; color: #c8e0ff;
      font: 600 12px/1.5 "Open Sans", sans-serif;
      border-radius: 12px 12px 12px 3px;
      padding: 8px 14px; max-width: 205px; text-align: center;
      box-shadow: 0 4px 20px rgba(0,0,0,.45);
      margin-bottom: 10px;
      opacity: 0; transform: translateY(10px) scale(.86);
      transition: opacity .2s ease, transform .2s cubic-bezier(.34,1.56,.64,1);
      pointer-events: none;
    }
    #site-bot-bubble.visible { opacity: 1; transform: translateY(0) scale(1); }
    [data-theme=dark] #site-bot-bubble { background: #040e24; color: #9dc8ff; }
    #site-bot-hint { font: 500 10px "Open Sans",sans-serif; color: #999; margin-top: 5px; }
    [data-theme=dark] #site-bot-hint { color: #aaa; }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       CHARACTER ROOT
       Handles Y-axis position only.
       Separating position from squash/stretch is the
       key trick that makes S&S look physically correct.
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    #site-bot-char {
      position: relative; width: 72px; height: 118px;
      animation: float-y 3.4s cubic-bezier(.45,.05,.55,.95) infinite;
    }
    @keyframes float-y {
      0%,100% { transform: translateY(0); }
      50%     { transform: translateY(-13px); }
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       BODY WRAP
       Handles rotation sway + squash/stretch scale.
       transform-origin at the feet = natural pivot.
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .a-body-wrap {
      position: absolute; inset: 0;
      transform-origin: 50% 90%;
      animation: float-sway 3.4s ease-in-out infinite;
    }
    @keyframes float-sway {
      0%,100% { transform: rotate(-1.3deg) scaleX(1) scaleY(1); }
      50%     { transform: rotate( 1.3deg) scaleX(1) scaleY(1); }
    }

    /* ── Ground shadow (inversely sized with height) ── */
    .a-shadow {
      position: absolute; bottom: 1px; left: 50%;
      transform: translateX(-50%);
      width: 44px; height: 6px;
      background: radial-gradient(ellipse, rgba(0,0,0,.22) 0%, transparent 72%);
      border-radius: 50%;
      animation: shadow-idle 3.4s cubic-bezier(.45,.05,.55,.95) infinite;
    }
    @keyframes shadow-idle {
      0%,100% { transform: translateX(-50%) scaleX(1);   opacity: 1; }
      50%     { transform: translateX(-50%) scaleX(.48); opacity: .28; }
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ANTENNA  (tertiary motion — lags behind sway)
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .a-ant {
      position: absolute; top: 7px; left: 53%;
      width: 3px; height: 16px;
      background: linear-gradient(to bottom, #c8d5e2, #8898a8);
      border-radius: 2px; z-index: 6;
      transform-origin: bottom center;
      animation: ant-sway 3.4s ease-in-out infinite .35s; /* deliberate lag */
    }
    @keyframes ant-sway {
      0%,100% { transform: rotate(-4deg); }
      50%     { transform: rotate( 4deg); }
    }
    .a-ant-ball {
      position: absolute; top: -5px; left: -2px;
      width: 7px; height: 7px;
      background: radial-gradient(circle at 35% 30%, #ffe88a, #ffb400);
      border-radius: 50%;
      box-shadow: 0 0 7px 2px rgba(255,185,0,.6);
      animation: ant-blink 1.6s ease-in-out infinite;
    }
    @keyframes ant-blink {
      0%,100% { opacity: 1; transform: scale(1); }
      50%     { opacity: .18; transform: scale(.75); }
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       HELMET
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .a-helmet {
      position: absolute; top: 12px; left: 50%;
      transform: translateX(-50%);
      width: 50px; height: 50px;
      background: radial-gradient(circle at 32% 28%,
        #f4f8fc 18%, #d0dce8 58%, #a8bccf 100%);
      border-radius: 50%;
      box-shadow:
        0 6px 22px rgba(0,0,0,.32),
        inset -6px -5px 14px rgba(0,0,0,.18),
        inset  4px  4px  9px rgba(255,255,255,.62);
      z-index: 4;
    }
    /* Gold collar */
    .a-collar {
      position: absolute; top: 57px; left: 50%;
      transform: translateX(-50%);
      width: 44px; height: 10px;
      background: linear-gradient(to bottom, #f9d262, #c99014, #f0c040);
      border-radius: 5px;
      box-shadow: 0 2px 6px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.3);
      z-index: 5;
    }
    /* Visor */
    .a-visor {
      position: absolute; top: 13px; left: 8px;
      width: 34px; height: 25px;
      background:
        linear-gradient(160deg, rgba(110,190,255,.18) 0%, transparent 45%),
        linear-gradient(135deg, #2a82d5 0%, #0f3e82 42%, #061b48 76%, #030b1d 100%);
      border-radius: 50%;
      box-shadow:
        inset 0 3px 9px rgba(0,0,0,.65),
        inset 0 -1px 4px rgba(80,155,255,.22);
      overflow: hidden;
    }
    .a-visor-glare {
      position: absolute; top: 3px; left: 5px;
      width: 13px; height: 8px;
      background: rgba(255,255,255,.42); border-radius: 50%;
      transform: rotate(-28deg);
    }
    .a-visor-glare2 {
      position: absolute; bottom: 4px; right: 4px;
      width: 8px; height: 5px;
      background: rgba(80,165,255,.22); border-radius: 50%;
    }
    /* Eyes visible through visor */
    .a-eye {
      position: absolute; top: 9px;
      width: 7px; height: 7px;
      background: #fff; border-radius: 50%;
      box-shadow: 0 0 5px rgba(255,255,255,.7);
    }
    .a-eye.l { left: 5px; }
    .a-eye.r { right: 5px; }
    .a-pupil {
      position: absolute; top: 1px; left: 1px;
      width: 5px; height: 5px;
      background: #0a0a0a; border-radius: 50%;
      animation: eye-blink 4.2s ease-in-out infinite;
    }
    .a-pupil::after {
      content: ""; position: absolute; top: 1px; left: 1px;
      width: 2px; height: 2px;
      background: rgba(255,255,255,.9); border-radius: 50%;
    }
    @keyframes eye-blink {
      0%,42%,56%,100% { transform: scaleY(1); }
      49%             { transform: scaleY(.07); }
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       SHOULDER PADS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .a-shoulder {
      position: absolute; top: 61px;
      width: 15px; height: 13px;
      background: radial-gradient(ellipse at 38% 28%, #dce8f2, #96aec6);
      border-radius: 50% 50% 42% 42%;
      box-shadow: 0 2px 6px rgba(0,0,0,.28);
      z-index: 6;
    }
    .a-shoulder.l { left: 2px; }
    .a-shoulder.r { right: 2px; }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ARMS  (secondary motion — float lags .45s)
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .a-arm {
      position: absolute; top: 65px;
      width: 13px; height: 28px;
      background: radial-gradient(ellipse at 38% 18%, #dce8f4, #96aec6);
      border-radius: 7px 7px 6px 6px;
      box-shadow: 0 3px 8px rgba(0,0,0,.24);
      z-index: 5; transform-origin: top center;
    }
    /* Arms hang naturally outward; gentle sway lags body by .45s */
    .a-arm.l { left: 1px;  animation: arm-idle-l 3.4s ease-in-out infinite .45s; }
    .a-arm.r { right: 1px; animation: arm-idle-r 3.4s ease-in-out infinite .45s; }
    @keyframes arm-idle-l { 0%,100%{transform:rotate(-26deg)} 50%{transform:rotate(-18deg)} }
    @keyframes arm-idle-r { 0%,100%{transform:rotate( 26deg)} 50%{transform:rotate( 18deg)} }
    .a-glove {
      position: absolute; bottom: -4px; left: 50%;
      transform: translateX(-50%);
      width: 16px; height: 12px;
      background: radial-gradient(ellipse at 38% 28%, #c8d8ea, #627a90);
      border-radius: 50%;
      box-shadow: 0 2px 5px rgba(0,0,0,.32);
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       BODY
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .a-body {
      position: absolute; top: 59px; left: 50%;
      transform: translateX(-50%);
      width: 42px; height: 32px;
      background: radial-gradient(ellipse at 38% 26%,
        #eaf0f8 18%, #c8d8ea 62%, #9eb6cc 100%);
      border-radius: 12px 12px 9px 9px;
      box-shadow:
        0 5px 14px rgba(0,0,0,.24),
        inset -3px -3px 10px rgba(0,0,0,.15),
        inset  2px  2px  6px rgba(255,255,255,.52);
      z-index: 3;
    }
    /* Backpack / PLSS */
    .a-backpack {
      position: absolute; top: 61px; right: 2px;
      width: 12px; height: 26px;
      background: linear-gradient(to right, #a8bac8, #78909e);
      border-radius: 4px 6px 6px 4px;
      box-shadow: 3px 2px 8px rgba(0,0,0,.28), inset -2px 0 4px rgba(0,0,0,.12);
      z-index: 2;
    }
    .a-backpack-vent {
      position: absolute; top: 67px; right: 4px;
      width: 6px; height: 2px;
      background: rgba(0,0,0,.25); border-radius: 1px;
      box-shadow: 0 4px 0 rgba(0,0,0,.2), 0 8px 0 rgba(0,0,0,.18);
    }
    /* Chest panel */
    .a-panel {
      position: absolute; top: 66px; left: 50%;
      transform: translateX(-50%);
      width: 22px; height: 16px;
      background: #050f2e;
      border-radius: 3px;
      box-shadow: inset 0 1px 5px rgba(0,0,0,.65), 0 1px 0 rgba(255,255,255,.08);
    }
    .a-led {
      position: absolute; top: 4px;
      width: 5px; height: 5px; border-radius: 50%;
    }
    .a-led.r { left: 3px;  background: #ff2020; box-shadow: 0 0 6px 1px #ff2020; animation: led 1.9s ease-in-out infinite; }
    .a-led.g { right: 3px; background: #20ff60; box-shadow: 0 0 6px 1px #20ff60; animation: led 1.9s ease-in-out infinite .95s; }
    @keyframes led {
      0%,100% { opacity: 1; transform: scale(1); }
      50%     { opacity: .1; transform: scale(.65); }
    }
    /* Flag patch */
    .a-badge {
      position: absolute; top: 61px; left: 10px;
      width: 11px; height: 8px;
      background: linear-gradient(to bottom, #d41c1c 33%, #fff 33%, #fff 66%, #1844b8 66%);
      border-radius: 1px;
      box-shadow: 0 1px 3px rgba(0,0,0,.4);
    }

    /* ── Waist ring ── */
    .a-waist {
      position: absolute; top: 88px; left: 50%;
      transform: translateX(-50%);
      width: 36px; height: 7px;
      background: linear-gradient(to bottom, #f9d262, #c99014, #f0c040);
      border-radius: 3px;
      box-shadow: 0 2px 5px rgba(0,0,0,.32);
      z-index: 3;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       LEGS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .a-legs {
      position: absolute; top: 92px; left: 50%;
      transform: translateX(-50%);
      width: 36px; display: flex; justify-content: space-between;
    }
    .a-leg {
      width: 15px; height: 16px;
      background: radial-gradient(ellipse at 38% 18%, #dce8f2, #96aec6);
      border-radius: 5px 5px 3px 3px;
      box-shadow: 0 3px 7px rgba(0,0,0,.22);
      position: relative;
    }
    .a-boot {
      position: absolute; bottom: -6px; left: 50%;
      transform: translateX(-50%);
      width: 20px; height: 10px;
      background: linear-gradient(to bottom, #667c94, #3e4e60);
      border-radius: 4px 4px 6px 6px;
      box-shadow: 0 3px 6px rgba(0,0,0,.35);
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       THRUSTER FLAMES
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .a-flames {
      position: absolute; bottom: -18px; left: 50%;
      transform: translateX(-50%);
      display: flex; gap: 6px;
      opacity: 0; transition: opacity .08s; pointer-events: none;
    }
    .a-flame {
      border-radius: 50% 50% 65% 65%;
      animation: flame-flicker .1s ease-in-out infinite alternate;
    }
    .a-flame.f1 { width: 7px;  height: 16px; background: linear-gradient(to bottom, #fff 0%, #ffe060 28%, #ff8018 66%, transparent 100%); }
    .a-flame.f2 { width: 10px; height: 24px; background: linear-gradient(to bottom, #fff 0%, #ffee80 22%, #ffaa00 55%, #ff4000 80%, transparent 100%); animation-delay: .05s; }
    .a-flame.f3 { width: 7px;  height: 14px; background: linear-gradient(to bottom, #fff 0%, #ffe060 28%, #ff8018 66%, transparent 100%); animation-delay: .03s; }
    @keyframes flame-flicker {
      0%   { transform: scaleX(1)   scaleY(1); }
      100% { transform: scaleX(.72) scaleY(1.14); }
    }
    #site-bot-char.boosting .a-flames { opacity: 1; }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       SLEEP ZZZs
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .a-zzz { position: absolute; top: -4px; right: -9px; pointer-events: none; }
    .a-z {
      position: absolute;
      font: 700 10px "Open Sans",sans-serif;
      color: #88bbff; opacity: 0;
    }
    .a-z.z1 { font-size:  9px; right: 0;   top: 0;    animation: zzz 3s ease-out infinite; }
    .a-z.z2 { font-size: 11px; right: -6px; top:-15px; animation: zzz 3s ease-out infinite 1s; }
    .a-z.z3 { font-size: 13px; right: -4px; top:-30px; animation: zzz 3s ease-out infinite 2s; }
    @keyframes zzz {
      0%   { opacity: 0; transform: translateY(5px) rotate(-8deg) scale(.6); }
      18%  { opacity: .95; transform: translateY(0) rotate(-3deg) scale(1); }
      75%  { opacity: .55; }
      100% { opacity: 0; transform: translateY(-22px) rotate(10deg) scale(.75); }
    }
    #site-bot-char:not(.sleeping) .a-z { animation-play-state: paused; opacity: 0; }

    /* ── Ambient stars ── */
    .a-star {
      position: absolute; background: #ffdf50;
      clip-path: polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);
      opacity: 0; animation: star-pulse 4.5s ease-in-out infinite;
    }
    .a-star.s1 { width:6px;height:6px; top:12px;  left:-11px; animation-delay: 0s; }
    .a-star.s2 { width:4px;height:4px; top:30px;  left:-15px; animation-delay:-1.5s; }
    .a-star.s3 { width:5px;height:5px; top: 8px;  right:-7px; animation-delay:-3.1s; }
    @keyframes star-pulse {
      0%,100%  { opacity: 0; transform: scale(.4) rotate(0deg); }
      30%,68%  { opacity: .85; transform: scale(1) rotate(180deg); }
    }

    /* ═══════════════════════════════════════════════
       BEHAVIOUR STATES
       ═══════════════════════════════════════════ */

    /* ── JUMP  (full S&S arc) ── */
    #site-bot-char.jumping {
      animation: jump-y 1.2s cubic-bezier(.2,.8,.6,1) forwards;
    }
    @keyframes jump-y {
      0%   { transform: translateY(0); }
      7%   { transform: translateY(5px); }       /* anticipation dip */
      32%  { transform: translateY(-56px); }     /* peak */
      55%  { transform: translateY(-56px); }     /* hang time */
      84%  { transform: translateY(-4px); }      /* near land */
      91%  { transform: translateY(4px); }       /* compression on impact */
      96%  { transform: translateY(-5px); }      /* micro bounce */
      100% { transform: translateY(0); }
    }
    #site-bot-char.jumping .a-body-wrap {
      animation: jump-squash 1.2s ease forwards;
    }
    @keyframes jump-squash {
      0%   { transform: rotate(0) scaleX(1)    scaleY(1); }
      7%   { transform: rotate(0) scaleX(1.24) scaleY(.78); }   /* crouch squash */
      14%  { transform: rotate(0) scaleX(.83)  scaleY(1.17); }  /* launch stretch */
      32%  { transform: rotate(0) scaleX(.87)  scaleY(1.13); }  /* peak stretch */
      55%  { transform: rotate(0) scaleX(.87)  scaleY(1.13); }  /* hang */
      82%  { transform: rotate(0) scaleX(.85)  scaleY(1.15); }  /* fall stretch */
      91%  { transform: rotate(0) scaleX(1.34) scaleY(.72); }   /* LAND squash */
      97%  { transform: rotate(0) scaleX(.93)  scaleY(1.07); }  /* bounce */
      100% { transform: rotate(0) scaleX(1)    scaleY(1); }
    }
    /* Shadow synced with jump height */
    #site-bot-char.jumping .a-shadow {
      animation: jump-shadow 1.2s ease forwards;
    }
    @keyframes jump-shadow {
      0%   { transform: translateX(-50%) scaleX(1);    opacity: 1; }
      7%   { transform: translateX(-50%) scaleX(1.28); opacity: 1; }
      32%  { transform: translateX(-50%) scaleX(.32);  opacity: .18; }
      55%  { transform: translateX(-50%) scaleX(.32);  opacity: .18; }
      91%  { transform: translateX(-50%) scaleX(1.42); opacity: 1; }
      100% { transform: translateX(-50%) scaleX(1);    opacity: 1; }
    }
    /* Legs tuck at peak */
    #site-bot-char.jumping .a-leg {
      animation: leg-tuck 1.2s ease forwards;
    }
    @keyframes leg-tuck {
      0%,100% { transform: translateY(0) rotate(0); }
      22%,55% { transform: translateY(-6px) rotate(18deg); }
      91%     { transform: translateY(0) rotate(0); }
    }
    /* Arms fling outward on launch, pull in during hang */
    #site-bot-char.jumping .a-arm.l {
      animation: arm-jump-l 1.2s ease forwards;
    }
    #site-bot-char.jumping .a-arm.r {
      animation: arm-jump-r 1.2s ease forwards;
    }
    @keyframes arm-jump-l {
      0%   { transform: rotate(-26deg); }
      14%  { transform: rotate(-65deg); }
      55%  { transform: rotate(-48deg); }
      91%  { transform: rotate(-20deg); }
      100% { transform: rotate(-26deg); }
    }
    @keyframes arm-jump-r {
      0%   { transform: rotate(26deg); }
      14%  { transform: rotate(65deg); }
      55%  { transform: rotate(48deg); }
      91%  { transform: rotate(20deg); }
      100% { transform: rotate(26deg); }
    }
    /* Antenna whips back on launch, settles */
    #site-bot-char.jumping .a-ant {
      animation: ant-jump 1.2s ease forwards;
    }
    @keyframes ant-jump {
      0%   { transform: rotate(-4deg); }
      14%  { transform: rotate(-20deg); }  /* whip back on launch */
      55%  { transform: rotate(5deg); }
      100% { transform: rotate(-4deg); }
    }

    /* ── SPIN ── */
    #site-bot-char.spinning {
      animation: spin-anim 1.1s cubic-bezier(.4,0,.15,1) forwards;
    }
    @keyframes spin-anim {
      0%   { transform: translateY(-8px) rotate(0deg) scale(1); }
      18%  { transform: translateY(-13px) rotate(72deg) scale(1.1); }   /* slight grow at start */
      82%  { transform: translateY(-8px) rotate(330deg) scale(1.02); }
      93%  { transform: translateY(-8px) rotate(372deg) scale(1); }     /* overshoot */
      100% { transform: translateY(-8px) rotate(360deg) scale(1); }
    }

    /* ── BOOST ── */
    #site-bot-char.boosting {
      animation: boost-anim .3s cubic-bezier(.4,0,.2,1) forwards;
    }
    @keyframes boost-anim {
      0%   { transform: translateY(0) rotate(0)     scaleX(1)   scaleY(1); }
      25%  { transform: translateY(5px) rotate(6deg) scaleX(.94) scaleY(1); }  /* lean-back anticipation */
      100% { transform: translateY(0) rotate(-32deg) scaleX(.88) scaleY(1.12); } /* forward lean + stretch */
    }
    /* Antenna slams forward during boost */
    #site-bot-char.boosting .a-ant {
      animation: ant-boost .3s ease forwards;
    }
    @keyframes ant-boost { 100% { transform: rotate(28deg); } }

    /* ── SLEEP ── */
    #site-bot-char.sleeping {
      animation: sleep-nod 2.4s cubic-bezier(.45,.05,.55,.95) infinite;
    }
    @keyframes sleep-nod {
      0%,100% { transform: translateY(0) rotate(-2deg); }
      40%     { transform: translateY(3px) rotate(-6deg); }
      70%     { transform: translateY(1px) rotate(-3deg); }
    }
    #site-bot-char.sleeping .a-body-wrap {
      animation: sleep-settle 2.4s ease-in-out infinite;
    }
    @keyframes sleep-settle {
      0%,100% { transform: scaleX(1.04) scaleY(.97); }
      50%     { transform: scaleX(1.07) scaleY(.94); }
    }
    #site-bot-char.sleeping .a-visor {
      background: linear-gradient(135deg, #0a1a2a 0%, #03080f 100%) !important;
    }
    #site-bot-char.sleeping .a-eye { opacity: 0; }
    /* Arms droop when asleep */
    #site-bot-char.sleeping .a-arm.l { animation: sleep-arm-l 2.4s ease-in-out infinite !important; }
    #site-bot-char.sleeping .a-arm.r { animation: sleep-arm-r 2.4s ease-in-out infinite !important; }
    @keyframes sleep-arm-l { 0%,100%{transform:rotate(-12deg)} 50%{transform:rotate(-8deg)} }
    @keyframes sleep-arm-r { 0%,100%{transform:rotate( 12deg)} 50%{transform:rotate( 8deg)} }

    /* ── WAVE (both arms alternate) ── */
    #site-bot-char.waving .a-arm.r {
      animation: wave-r .52s cubic-bezier(.4,0,.6,1) 4 !important;
    }
    #site-bot-char.waving .a-arm.l {
      animation: wave-l .52s cubic-bezier(.4,0,.6,1) 4 !important;
      animation-delay: .26s !important;
    }
    @keyframes wave-r { 0%,100%{transform:rotate(26deg)}  46%{transform:rotate(-60deg)} }
    @keyframes wave-l { 0%,100%{transform:rotate(-26deg)} 46%{transform:rotate( 60deg)} }

    /* ── WALK ── */
    #site-bot-char.walking {
      animation: walk-bob .42s cubic-bezier(.45,.05,.55,.95) infinite;
    }
    @keyframes walk-bob {
      0%,100% { transform: translateY(0); }
      50%     { transform: translateY(-5px); }
    }
    #site-bot-char.walking .a-body-wrap {
      animation: walk-sway .42s ease-in-out infinite;
    }
    @keyframes walk-sway {
      0%,100% { transform: rotate(-2.5deg); }
      50%     { transform: rotate( 2.5deg); }
    }
    #site-bot-char.walking .a-shadow {
      animation: walk-shadow .42s ease-in-out infinite;
    }
    @keyframes walk-shadow {
      0%,100% { transform: translateX(-50%) scaleX(1);   opacity: 1; }
      50%     { transform: translateX(-50%) scaleX(.68); opacity: .5; }
    }
    #site-bot-char.walking .a-leg:first-child { animation: walk-leg-a .42s cubic-bezier(.4,0,.6,1) infinite; }
    #site-bot-char.walking .a-leg:last-child  { animation: walk-leg-b .42s cubic-bezier(.4,0,.6,1) infinite; }
    /* Arms counterswing (opposite phase to legs) */
    #site-bot-char.walking .a-arm.l { animation: walk-arm-b .42s cubic-bezier(.4,0,.6,1) infinite !important; }
    #site-bot-char.walking .a-arm.r { animation: walk-arm-a .42s cubic-bezier(.4,0,.6,1) infinite !important; }
    @keyframes walk-leg-a { 0%,100%{transform:rotate(-18deg)} 50%{transform:rotate(18deg)} }
    @keyframes walk-leg-b { 0%,100%{transform:rotate( 18deg)} 50%{transform:rotate(-18deg)} }
    @keyframes walk-arm-a { 0%,100%{transform:rotate(-24deg)} 50%{transform:rotate(24deg)} }
    @keyframes walk-arm-b { 0%,100%{transform:rotate( 24deg)} 50%{transform:rotate(-24deg)} }

    @media(max-width:400px){ #site-bot-wrap{display:none;} }
  `;

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ─────────────────────────────────────────────────────────
     DOM
  ───────────────────────────────────────────────────────── */
  var wrap = document.createElement('div');
  wrap.id  = 'site-bot-wrap';
  wrap.setAttribute('role', 'button');
  wrap.setAttribute('aria-label', 'Astronaut mascot – click for a message');
  wrap.setAttribute('tabindex', '0');

  var bubble = document.createElement('div');
  bubble.id  = 'site-bot-bubble';

  var char = document.createElement('div');
  char.id  = 'site-bot-char';
  char.innerHTML = `
    <div class="a-shadow"></div>
    <div class="a-body-wrap">
      <div class="a-star s1"></div>
      <div class="a-star s2"></div>
      <div class="a-star s3"></div>
      <div class="a-zzz">
        <span class="a-z z1">z</span>
        <span class="a-z z2">z</span>
        <span class="a-z z3">Z</span>
      </div>
      <div class="a-ant"><div class="a-ant-ball"></div></div>
      <div class="a-helmet">
        <div class="a-visor">
          <div class="a-visor-glare"></div>
          <div class="a-visor-glare2"></div>
          <div class="a-eye l"><div class="a-pupil"></div></div>
          <div class="a-eye r"><div class="a-pupil"></div></div>
        </div>
      </div>
      <div class="a-collar"></div>
      <div class="a-shoulder l"></div>
      <div class="a-shoulder r"></div>
      <div class="a-arm l"><div class="a-glove"></div></div>
      <div class="a-backpack"><div class="a-backpack-vent"></div></div>
      <div class="a-body">
        <div class="a-panel">
          <div class="a-led r"></div>
          <div class="a-led g"></div>
        </div>
        <div class="a-badge"></div>
      </div>
      <div class="a-arm r"><div class="a-glove"></div></div>
      <div class="a-waist"></div>
      <div class="a-legs">
        <div class="a-leg"><div class="a-boot"></div></div>
        <div class="a-leg"><div class="a-boot"></div></div>
      </div>
      <div class="a-flames">
        <div class="a-flame f1"></div>
        <div class="a-flame f2"></div>
        <div class="a-flame f3"></div>
      </div>
    </div>
  `;

  var hint = document.createElement('div');
  hint.id  = 'site-bot-hint';
  hint.textContent = 'click me';

  wrap.appendChild(bubble);
  wrap.appendChild(char);
  wrap.appendChild(hint);

  /* ─────────────────────────────────────────────────────────
     STATE HELPERS
  ───────────────────────────────────────────────────────── */
  var bubbleTimer = null;

  function showBubble(text) {
    bubble.textContent = text;
    bubble.classList.add('visible');
    hint.style.display = 'none';
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      bubble.classList.remove('visible');
      hint.style.display = '';
    }, 4500);
  }

  function clearStates() {
    char.classList.remove('walking','jumping','spinning','boosting','sleeping','waving');
  }

  /* ─────────────────────────────────────────────────────────
     BEHAVIOURS
  ───────────────────────────────────────────────────────── */
  var behaviors = {

    walk: function (done) {
      var goLeft   = Math.random() < .5;
      var dist     = 60 + Math.random() * 150;
      var dur      = dist * 16; // ~leisurely walk pace
      var curRight = parseFloat(wrap.style.right) || 24;
      var newRight = goLeft
        ? Math.min(curRight + dist, window.innerWidth - 90)
        : Math.max(curRight - dist, 24);

      char.classList.add('walking');
      char.style.transform  = goLeft ? 'scaleX(-1)' : 'scaleX(1)';
      wrap.style.transition = 'right ' + dur + 'ms linear';
      wrap.style.right      = newRight + 'px';

      setTimeout(function () {
        clearStates();
        char.style.transform  = '';
        wrap.style.transition = 'right .05s linear';
        done();
      }, dur + 80);
    },

    jump: function (done) {
      char.classList.add('jumping');
      showBubble(pickMsg('jump'));
      setTimeout(function () { clearStates(); done(); }, 1300);
    },

    spin: function (done) {
      char.classList.add('spinning');
      showBubble(pickMsg('spin'));
      setTimeout(function () { clearStates(); done(); }, 1200);
    },

    boost: function (done) {
      var goLeft   = Math.random() < .5;
      var dist     = 100 + Math.random() * 200;
      var curRight = parseFloat(wrap.style.right) || 24;
      var newRight = goLeft
        ? Math.min(curRight + dist, window.innerWidth - 90)
        : Math.max(curRight - dist, 24);

      char.classList.add('boosting');
      char.style.transform  = goLeft ? 'scaleX(-1)' : 'scaleX(1)';
      wrap.style.transition = 'right 580ms cubic-bezier(.4,0,.2,1)';
      wrap.style.right      = newRight + 'px';
      showBubble(pickMsg('boost'));

      setTimeout(function () {
        clearStates();
        char.style.transform  = '';
        wrap.style.transition = 'right .05s linear';
        done();
      }, 700);
    },

    sleep: function (done) {
      char.classList.add('sleeping');
      showBubble(pickMsg('sleep'));
      setTimeout(function () { clearStates(); done(); }, 4200);
    },

    multiJump: function (done) {
      var n = 0;
      (function next() {
        if (n++ >= 3) { done(); return; }
        char.classList.add('jumping');
        setTimeout(function () { clearStates(); setTimeout(next, 180); }, 1280);
      }());
    },

    spinWalk: function (done) {
      char.classList.add('spinning');
      setTimeout(function () {
        clearStates();
        setTimeout(function () { behaviors.walk(done); }, 180);
      }, 1200);
    },
  };

  /* ─────────────────────────────────────────────────────────
     SCHEDULER
  ───────────────────────────────────────────────────────── */
  var POOL = ['walk','jump','spin','boost','sleep','multiJump','spinWalk','walk','walk','jump'];

  function schedule() {
    setTimeout(function () {
      var name = POOL[Math.floor(Math.random() * POOL.length)];
      behaviors[name](schedule);
    }, 6000 + Math.random() * 12000);
  }

  /* ─────────────────────────────────────────────────────────
     INTERACTION
  ───────────────────────────────────────────────────────── */
  function onActivate() {
    clearStates();
    void char.offsetWidth; // reflow → restart wave animation cleanly
    char.classList.add('waving');
    showBubble(pickMsg('idle'));
    setTimeout(function () { char.classList.remove('waving'); }, 2400);
  }

  wrap.addEventListener('click', onActivate);
  wrap.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
  });

  /* ─────────────────────────────────────────────────────────
     MOUNT
  ───────────────────────────────────────────────────────── */
  function mount() {
    document.body.appendChild(wrap);
    schedule();
    setTimeout(function () {
      char.classList.add('waving');
      showBubble('Houston, I\'ve landed! 🚀 Click me!');
      setTimeout(function () { char.classList.remove('waving'); }, 2400);
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
