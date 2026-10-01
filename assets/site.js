/* おにぎり〜NIKUKYU〜 — 動きの制御
   - 動きを減らす設定（prefers-reduced-motion）では、切り替え・視差・登場演出をすべて止める
   - GSAP は cdnjs から読み込む。読み込めない環境でも、内容はすべて表示される */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  root.classList.add("js");
  if (reduce) root.classList.add("reduce");

  var head = document.querySelector(".site-head");

  /* --- 確認用リンク（/review/…）で見せているときは、公開前の案であることを上に出す ------ */
  if (/^\/review\//.test(window.location.pathname)) {
    var note = document.createElement("div");
    note.className = "review-note";
    note.setAttribute("role", "note");
    note.innerHTML =
      "<strong>確認用ページ（公開前の案）</strong>" +
      "<span>まだ一般には公開されていません。修正したい箇所があれば、担当者までお知らせください。</span>";
    head.insertBefore(note, head.firstChild);
    var syncHead = function () {
      root.style.setProperty("--head-h", head.offsetHeight + "px");
    };
    syncHead();
    window.addEventListener("resize", syncHead);
  }

  /* --- ヘッダー：下へスクロールで隠れ、上へ戻ると出る ------------------------ */
  var lastY = window.scrollY;
  var ticking = false;
  function onScroll() {
    var y = window.scrollY;
    head.classList.toggle("is-scrolled", y > 40);
    if (y > 360 && y > lastY + 6) head.classList.add("is-hidden");
    else if (y < lastY - 6 || y < 360) head.classList.remove("is-hidden");
    lastY = y;
    ticking = false;
  }
  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  /* --- 全画面メニュー ------------------------------------------------------- */
  var menu = document.getElementById("menu");
  var menuBtn = document.querySelector(".menu-btn");
  function setMenu(open) {
    menu.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) menu.querySelector("a, button").focus();
    else menuBtn.focus();
  }
  menuBtn.addEventListener("click", function () {
    setMenu(!menu.classList.contains("is-open"));
  });
  menu.querySelectorAll("[data-menu-close]").forEach(function (el) {
    el.addEventListener("click", function () {
      setMenu(false);
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menu.classList.contains("is-open")) setMenu(false);
  });

  /* --- 最初の画面の写真：4枚をゆっくり切り替える ------------------------------ */
  (function slideshow() {
    var wrap = document.querySelector(".slides");
    if (!wrap) return;
    var slides = Array.prototype.slice.call(wrap.querySelectorAll(".slide"));
    var dots = Array.prototype.slice.call(document.querySelectorAll(".slides__dot"));
    var pause = document.querySelector(".slides__pause");
    var INTERVAL = 6000;
    var FADE = 1600;
    var index = 0;
    var timer = null;
    var paused = reduce;
    if (reduce && pause) pause.hidden = true;

    function show(next) {
      if (next === index) return;
      var prev = index;
      index = next;
      slides.forEach(function (s, i) {
        s.classList.toggle("is-active", i === index);
        s.classList.toggle("is-prev", i === prev);
      });
      dots.forEach(function (d, i) {
        d.classList.toggle("is-active", i === index);
        if (i === index) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
      var img = slides[(index + 1) % slides.length].querySelector("img");
      if (img && img.loading === "lazy") img.loading = "eager";
      setTimeout(function () {
        slides[prev].classList.remove("is-prev");
      }, FADE);
    }
    function schedule() {
      clearTimeout(timer);
      if (paused || document.hidden || slides.length < 2) return;
      timer = setTimeout(function () {
        show((index + 1) % slides.length);
        schedule();
      }, INTERVAL);
    }
    dots.forEach(function (d, i) {
      d.addEventListener("click", function () {
        show(i);
        schedule();
      });
    });
    if (pause) {
      pause.addEventListener("click", function () {
        paused = !paused;
        pause.setAttribute("aria-pressed", String(paused));
        pause.setAttribute("aria-label", paused ? "自動再生を再開" : "自動再生を一時停止");
        pause.querySelector("span").textContent = paused ? "▶" : "❚❚";
        schedule();
      });
    }
    document.addEventListener("visibilitychange", schedule);
    var next = slides[1] && slides[1].querySelector("img");
    if (next) next.loading = "eager";
    schedule();
  })();

  /* --- コピー（Instagram の ID、DM の文章） ------------------------------------ */
  function copyText(text, btn) {
    var done = function () {
      var old = btn.textContent;
      btn.textContent = "コピーしました";
      setTimeout(function () {
        btn.textContent = old;
      }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        fallback();
      });
    } else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        done();
      } catch (e) {
        btn.textContent = "長押しで選択してください";
      }
      document.body.removeChild(ta);
    }
  }
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var sel = btn.getAttribute("data-copy");
      var src = sel ? document.querySelector(sel) : null;
      var text = src ? (src.value !== undefined ? src.value : src.textContent) : "";
      copyText(text.trim(), btn);
    });
  });

  /* --- お問い合わせ：Instagram の DM に貼る文章を組み立てる -------------------------
     お店の受け口が DM なので、フォームは「送る」のではなく「DM の文章を作る」。
     サーバー側の受け口（メールや CMS の問い合わせ API）ができたら差し替える。 */
  (function form() {
    var f = document.getElementById("contact-form");
    if (!f) return;
    var out = f.querySelector(".form__out");
    var ta = f.querySelector("#f-out");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = function (id) {
        return ((f.querySelector("#" + id) || {}).value || "").trim();
      };
      var lines = ["【" + v("f-kind") + "】", "お名前：" + v("f-name")];
      if (v("f-date")) lines.push("希望日時：" + v("f-date"));
      if (v("f-count")) lines.push("人数・個数：" + v("f-count"));
      lines.push("", v("f-body"), "", "（おにぎり〜NIKUKYU〜 のホームページから）");
      ta.value = lines.join("\n");
      out.hidden = false;
      ta.focus();
      ta.select();
    });
  })();

  /* --- 登場・視差（GSAP） ------------------------------------------------------- */
  if (reduce) {
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.classList.add("is-in");
    });
    return;
  }
  if (!window.gsap || !window.ScrollTrigger) {
    var io2 = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io2.unobserve(en.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      io2.observe(el);
    });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.ticker.lagSmoothing(0);

  // 最初の画面：縦書きの見出しが1行ずつ立ち上がり、文章とボタンが続く
  var intro = gsap.timeline({ defaults: { ease: "power3.out" } });
  intro
    .from(".hero__title .line > span", { yPercent: 110, duration: 1.1, stagger: 0.18 }, 0.25)
    .from(".hero__eyebrow, .hero__lead, .hero__actions, .hero__facts", { y: 22, opacity: 0, duration: 0.9, stagger: 0.1 }, 0.7)
    .from(".slides__ctrl, .scroll-cue", { opacity: 0, duration: 0.8 }, 1.3);

  // スクロールで現れる要素
  ScrollTrigger.batch("[data-reveal]", {
    start: "top 88%",
    once: true,
    onEnter: function (batch) {
      batch.forEach(function (el, i) {
        setTimeout(function () {
          el.classList.add("is-in");
        }, i * 90);
      });
    },
  });

  // 写真の視差
  gsap.utils.toArray("[data-parallax]").forEach(function (el) {
    var amount = parseFloat(el.getAttribute("data-parallax")) || 8;
    gsap.fromTo(
      el,
      { yPercent: -amount },
      {
        yPercent: amount,
        ease: "none",
        scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true },
      }
    );
  });

  // メニューの札：1枚ずつ
  gsap.utils.toArray(".dish").forEach(function (el, i) {
    gsap.from(el, {
      y: 36,
      opacity: 0,
      duration: 0.9,
      delay: (i % 3) * 0.1,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });

  // 店主の小さな写真：遅れて重なる
  gsap.from(".owner__sub", {
    x: -30,
    y: 30,
    opacity: 0,
    duration: 1,
    ease: "power3.out",
    scrollTrigger: { trigger: ".owner__media", start: "top 70%", once: true },
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      ScrollTrigger.refresh();
    });
  }
  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
  });
})();
