/* ============================================================
   604 KARS — interactions
   Motion is spring-based rather than duration-based so every
   animation can be interrupted and redirected mid-flight, and
   so gestures hand their velocity off to the animation that
   follows them. No framework.
   ============================================================ */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ----------------------------------------------------------
     Spring
     Parameterised the way Apple exposes it — damping ratio and
     response — rather than mass/stiffness/damping.
       damping  1.0 = critically damped (no overshoot)
                <1  = overshoots; use only after a momentum gesture
       response     = seconds to reach the target, roughly
     Retargeting mid-flight keeps the current value AND velocity,
     which is what stops a reversal feeling like a brick wall.
     ---------------------------------------------------------- */
  function createSpring(options) {
    var damping = options.damping === undefined ? 1 : options.damping;
    var response = options.response === undefined ? 0.4 : options.response;
    var onUpdate = options.onUpdate;
    var onRest = options.onRest;
    var w0 = (2 * Math.PI) / response;

    var value = options.from || 0;
    var target = value;
    var velocity = 0;
    var raf = null;
    var last = 0;

    function frame(now) {
      var dt = (now - last) / 1000;
      last = now;
      // A backgrounded tab can hand us a huge dt; clamp so the
      // integrator can't explode on the first frame back.
      if (dt > 1 / 30) dt = 1 / 30;
      if (dt <= 0) { raf = requestAnimationFrame(frame); return; }

      // Sub-step the integration so stiff springs stay stable.
      var steps = Math.max(1, Math.ceil(dt * 240));
      var h = dt / steps;
      for (var i = 0; i < steps; i++) {
        var x = value - target;
        var accel = -w0 * w0 * x - 2 * damping * w0 * velocity;
        velocity += accel * h;
        value += velocity * h;
      }

      if (Math.abs(value - target) < 0.002 && Math.abs(velocity) < 0.02) {
        value = target;
        velocity = 0;
        raf = null;
        onUpdate(value, 0);
        if (onRest) onRest();
        return;
      }

      onUpdate(value, velocity);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (raf === null) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    return {
      get value() { return value; },
      get velocity() { return velocity; },
      get target() { return target; },
      get isAnimating() { return raf !== null; },

      // Animate to a target, optionally inheriting a gesture's velocity.
      to: function (next, initialVelocity) {
        target = next;
        if (initialVelocity !== undefined) velocity = initialVelocity;
        if (reduceMotion.matches) {
          this.stop();
          value = target;
          velocity = 0;
          onUpdate(value, 0);
          if (onRest) onRest();
          return;
        }
        start();
      },

      // Drive the value directly — used for 1:1 pointer tracking,
      // where the finger, not a spring, is the source of truth.
      track: function (next) {
        this.stop();
        value = next;
        onUpdate(value, 0);
      },

      reset: function (next) {
        this.stop();
        value = target = next;
        velocity = 0;
        onUpdate(value, 0);
      },

      stop: function () {
        if (raf !== null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
      }
    };
  }

  /* Progressive resistance past a boundary. The `limit` argument is
     the asymptote — the furthest the value can ever travel past the
     edge, no matter how hard the drag. */
  function rubberband(overshoot, limit) {
    var c = 0.55;
    return (overshoot * limit * c) / (limit + c * Math.abs(overshoot));
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ----------------------------------------------------------
     Year stamp
     ---------------------------------------------------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ----------------------------------------------------------
     Press feedback — on pointer-down, not on release.
     Waiting for click to acknowledge a press feels dead.
     ---------------------------------------------------------- */
  var PRESSABLE = '.btn, .plan-toggle button';
  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest && e.target.closest(PRESSABLE);
    if (el) el.classList.add('is-pressed');
  }, { passive: true });

  function clearPressed() {
    var pressed = document.querySelectorAll('.is-pressed');
    for (var i = 0; i < pressed.length; i++) pressed[i].classList.remove('is-pressed');
  }
  document.addEventListener('pointerup', clearPressed, { passive: true });
  document.addEventListener('pointercancel', clearPressed, { passive: true });
  window.addEventListener('blur', clearPressed);

  /* ----------------------------------------------------------
     Scroll-driven chrome: progress bar and the nav's edge effect.
     Batched into one rAF so we never lay out inside a scroll event.
     ---------------------------------------------------------- */
  var scrollProgress = document.getElementById('scrollProgress');
  var scrollQueued = false;

  function onScrollFrame() {
    scrollQueued = false;

    if (scrollProgress) {
      var scrollable = document.documentElement.scrollHeight - window.innerHeight;
      var pct = scrollable > 0 ? window.scrollY / scrollable : 0;
      scrollProgress.style.transform = 'scaleX(' + clamp(pct, 0, 1) + ')';
    }

    // The nav separates itself from content progressively over the
    // first 80px of scroll rather than snapping a hard rule on.
    var edge = clamp(window.scrollY / 80, 0, 1);
    document.documentElement.style.setProperty('--nav-edge', edge.toFixed(3));

    revealVisible();
  }

  function requestScrollFrame() {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(onScrollFrame);
    }
  }

  window.addEventListener('scroll', requestScrollFrame, { passive: true });
  window.addEventListener('resize', requestScrollFrame, { passive: true });

  /* ----------------------------------------------------------
     Scroll reveal
     An observer handles the common case; the direct check covers
     everything already on screen at load, after a hash jump, or
     when a restored scroll position skips the intersection.
     ---------------------------------------------------------- */
  var revealObserver = null;
  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('in');
          revealObserver.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });

    var toReveal = document.querySelectorAll('.reveal');
    for (var r = 0; r < toReveal.length; r++) revealObserver.observe(toReveal[r]);
  }

  function revealVisible() {
    var pending = document.querySelectorAll('.reveal:not(.in)');
    for (var i = 0; i < pending.length; i++) {
      var rect = pending[i].getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        pending[i].classList.add('in');
        if (revealObserver) revealObserver.unobserve(pending[i]);
      }
    }
  }

  // No IntersectionObserver at all: show everything rather than
  // leaving content stuck invisible.
  if (!revealObserver) {
    var all = document.querySelectorAll('.reveal');
    for (var a = 0; a < all.length; a++) all[a].classList.add('in');
  }

  window.addEventListener('load', revealVisible);
  window.addEventListener('hashchange', function () { setTimeout(revealVisible, 60); });
  revealVisible();
  requestScrollFrame();

  /* ----------------------------------------------------------
     Collapsible — spring-driven height.
     Grabbing it mid-open and closing it again picks up from the
     current height with the current velocity, so there's no jump.
     ---------------------------------------------------------- */
  function createCollapsible(container, inner, opts) {
    opts = opts || {};
    var isOpen = false;

    var spring = createSpring({
      damping: 1,
      response: opts.response || 0.34,
      onUpdate: function (h) { container.style.height = Math.max(0, h) + 'px'; },
      onRest: function () {
        // Let an open panel size itself again so it stays correct
        // if the text reflows or the window resizes.
        if (isOpen) container.style.height = 'auto';
      }
    });

    return {
      get isOpen() { return isOpen; },
      open: function () {
        if (isOpen) return;
        isOpen = true;
        spring.to(inner.offsetHeight);
      },
      close: function () {
        if (!isOpen) return;
        isOpen = false;
        // Pin the current rendered height before animating to zero,
        // otherwise 'auto' gives the spring nothing to start from.
        if (container.style.height === 'auto') {
          spring.reset(container.offsetHeight);
        }
        spring.to(0);
      },
      toggle: function () { this.isOpen ? this.close() : this.open(); }
    };
  }

  /* ----------------------------------------------------------
     Mobile menu — enters and leaves along the same path
     ---------------------------------------------------------- */
  var navToggle = document.getElementById('navToggle');
  var mobileMenu = document.getElementById('mobileMenu');
  if (navToggle && mobileMenu) {
    var menuInner = mobileMenu.querySelector('.mobile-menu-inner');
    var menu = createCollapsible(mobileMenu, menuInner, { response: 0.32 });

    navToggle.addEventListener('click', function () {
      menu.toggle();
      navToggle.setAttribute('aria-expanded', String(menu.isOpen));
    });

    var menuLinks = mobileMenu.querySelectorAll('a');
    for (var m = 0; m < menuLinks.length; m++) {
      menuLinks[m].addEventListener('click', function () {
        menu.close();
        navToggle.setAttribute('aria-expanded', 'false');
      });
    }

    // Leaving the mobile breakpoint should not strand an open panel.
    window.matchMedia('(min-width: 54.0625rem)').addEventListener('change', function (e) {
      if (e.matches && menu.isOpen) {
        menu.close();
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ----------------------------------------------------------
     FAQ accordion
     ---------------------------------------------------------- */
  var faqItems = document.querySelectorAll('.faq-item');
  var faqPanels = [];

  for (var f = 0; f < faqItems.length; f++) {
    (function (item) {
      var button = item.querySelector('.faq-q');
      var panel = item.querySelector('.faq-a');
      var inner = item.querySelector('.faq-a-inner');
      if (!button || !panel || !inner) return;

      var collapsible = createCollapsible(panel, inner);
      faqPanels.push({ item: item, button: button, collapsible: collapsible });

      button.addEventListener('click', function () {
        var opening = !collapsible.isOpen;

        for (var i = 0; i < faqPanels.length; i++) {
          var other = faqPanels[i];
          if (other.item !== item && other.collapsible.isOpen) {
            other.collapsible.close();
            other.item.classList.remove('open');
            other.button.setAttribute('aria-expanded', 'false');
          }
        }

        collapsible.toggle();
        item.classList.toggle('open', opening);
        button.setAttribute('aria-expanded', String(opening));
      });
    })(faqItems[f]);
  }

  /* ----------------------------------------------------------
     Slider
     The native <input type="range"> stays in the DOM and remains
     the source of truth for keyboard and assistive tech. On top of
     it sits a pointer-driven visual layer: 1:1 with the finger,
     honouring where the thumb was grabbed, resisting past the ends,
     and handing the release velocity to the settle spring so there
     is no seam between dragging and animating.

     Deliberately NOT momentum-projected: a slider should come to
     rest where you let go, not somewhere a flick threw it.
     ---------------------------------------------------------- */
  function upgradeSlider(root) {
    var input = root.querySelector('.slider-input');
    var track = root.querySelector('.slider-track');
    var fill = root.querySelector('.slider-fill');
    var thumb = root.querySelector('.slider-thumb');
    if (!input || !track || !fill || !thumb) return;

    var min = parseFloat(input.min) || 0;
    var max = parseFloat(input.max) || 100;
    var step = parseFloat(input.step) || 1;
    var MAX_OVERSHOOT = 14; // px the thumb can ever travel past an end

    var dragging = false;
    var activePointer = null;
    var grabOffset = 0;
    var samples = [];

    function width() { return track.getBoundingClientRect().width; }

    function valueToPx(value) {
      var w = width();
      if (max === min) return 0;
      return ((value - min) / (max - min)) * w;
    }

    function pxToValue(px) {
      var w = width();
      if (w === 0) return min;
      var raw = min + (px / w) * (max - min);
      var snapped = Math.round(raw / step) * step;
      // Re-round to step precision so 0.1-style steps don't drift.
      var decimals = (String(step).split('.')[1] || '').length;
      return clamp(parseFloat(snapped.toFixed(decimals)), min, max);
    }

    function paint(px) {
      var w = width();
      thumb.style.transform = 'translate3d(' + px + 'px,0,0)';
      fill.style.transform = 'scaleX(' + (w ? clamp(px / w, 0, 1) : 0) + ')';
    }

    var spring = createSpring({
      damping: 1,
      response: 0.3,
      onUpdate: paint
    });

    function syncFromInput(animate) {
      var px = valueToPx(parseFloat(input.value));
      if (animate) spring.to(px); else spring.reset(px);
    }

    function commit(value) {
      if (parseFloat(input.value) === value) return;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function positionFromEvent(e) {
      return e.clientX - track.getBoundingClientRect().left;
    }

    root.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;

      var pointerPx = positionFromEvent(e);
      var thumbPx = valueToPx(parseFloat(input.value));
      var onThumb = Math.abs(pointerPx - thumbPx) <= 18;

      dragging = true;
      activePointer = e.pointerId;
      samples = [{ x: pointerPx, t: e.timeStamp }];
      root.classList.add('is-dragging');

      // Grabbing the thumb preserves the offset so the thumb doesn't
      // jump under the finger. Pressing the bare track means there's
      // nothing to preserve — the thumb comes to the finger instead.
      if (onThumb) {
        grabOffset = pointerPx - thumbPx;
      } else {
        grabOffset = 0;
        commit(pxToValue(pointerPx));
      }

      spring.track(clamp(pointerPx - grabOffset, -MAX_OVERSHOOT, width() + MAX_OVERSHOOT));

      // Capture keeps tracking alive when the pointer leaves the
      // element. It can reject a pointer the browser no longer knows
      // about, which must not abort the rest of the gesture setup.
      try { root.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }

      // Keep the keyboard surface in sync with what was just touched.
      input.focus({ preventScroll: true });
      e.preventDefault();
    });

    root.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== activePointer) return;

      var pointerPx = positionFromEvent(e);
      samples.push({ x: pointerPx, t: e.timeStamp });
      if (samples.length > 6) samples.shift();

      var desired = pointerPx - grabOffset;
      var w = width();
      var visual;

      if (desired < 0) {
        visual = -rubberband(-desired, MAX_OVERSHOOT);
      } else if (desired > w) {
        visual = w + rubberband(desired - w, MAX_OVERSHOOT);
      } else {
        visual = desired;
      }

      // The visual follows the finger continuously; the value is
      // clamped and stepped. Both update on every move — feedback
      // during the gesture, not only at the end.
      spring.track(visual);
      commit(pxToValue(clamp(desired, 0, w)));
    });

    function endDrag(e) {
      if (!dragging || (e && e.pointerId !== activePointer)) return;
      dragging = false;
      activePointer = null;
      root.classList.remove('is-dragging');

      // Release velocity in px/s from the recent pointer history.
      var velocity = 0;
      if (samples.length >= 2) {
        var first = samples[0];
        var last = samples[samples.length - 1];
        var dt = (last.t - first.t) / 1000;
        if (dt > 0) velocity = (last.x - first.x) / dt;
      }
      samples = [];

      // Settle onto the exact step position, continuing at the speed
      // the finger was moving so drag and animation share a seam.
      spring.to(valueToPx(parseFloat(input.value)), velocity);
    }

    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', endDrag);

    // Keyboard and programmatic changes animate; drags already painted.
    input.addEventListener('input', function () {
      if (!dragging) syncFromInput(true);
    });

    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        if (!dragging) syncFromInput(false);
      }).observe(track);
    } else {
      window.addEventListener('resize', function () {
        if (!dragging) syncFromInput(false);
      });
    }

    syncFromInput(false);
  }

  var sliders = document.querySelectorAll('.slider');
  for (var s = 0; s < sliders.length; s++) upgradeSlider(sliders[s]);

  /* ----------------------------------------------------------
     Earnings calculator

     Order of operations. The previous version omitted Turo's own
     host fee entirely, which overstated owner take-home by roughly
     35-50%, and left out depreciation, the largest real cost of
     renting a car out.

       grossTripRevenue = dailyRate x tripDays      (guest-facing price)
       turoHostFee      = gross x (1 - retention)   (Turo's cut, shown)
       turoPayout       = gross - turoHostFee       (what the host receives)
       mgmtFee          = turoPayout x planPercent  (on payout, not gross)
       ownerShare       = turoPayout - mgmtFee
       trips            = tripDays / avgTripLength  (a 3-day rental is
                          cleaned once, not three times)
       cleaning         = trips x cleaningPerTrip
       maintenance      = gross x 8%
       depreciation     = tripDays x perTripDay     (mileage-driven, so
                          this one really does scale with days)
       ownerNet         = ownerShare - cleaning - maintenance - depreciation
     ---------------------------------------------------------- */
  var vehicleType = document.getElementById('vehicleType');
  var protectionPlan = document.getElementById('protectionPlan');
  var daysAvailable = document.getElementById('daysAvailable');
  var utilization = document.getElementById('utilization');
  var tripLength = document.getElementById('tripLength');

  if (vehicleType && protectionPlan && daysAvailable && utilization && tripLength) {
    var daysVal = document.getElementById('daysVal');
    var utilVal = document.getElementById('utilVal');
    var tripLenVal = document.getElementById('tripLenVal');
    var planButtons = document.querySelectorAll('.plan-toggle button');
    var currentPlan = 30;

    var MAINTENANCE_RATE = 0.08;

    function money(n) {
      return Math.round(n).toLocaleString('en-CA');
    }

    function setText(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function calculate() {
      var vehicle = vehicleType.selectedOptions[0];
      var dailyRate = parseFloat(vehicle.dataset.rate);
      var cleaningPerTrip = parseFloat(vehicle.dataset.clean);
      var depreciationPerTripDay = parseFloat(vehicle.dataset.depreciation);
      var retention = parseFloat(protectionPlan.selectedOptions[0].dataset.retention);

      var days = parseInt(daysAvailable.value, 10);
      var util = parseInt(utilization.value, 10);
      var avgTripLength = parseInt(tripLength.value, 10);

      if (daysVal) daysVal.textContent = days;
      if (utilVal) utilVal.textContent = util;
      if (tripLenVal) tripLenVal.textContent = avgTripLength;

      var tripDays = days * (util / 100);
      var trips = tripDays / avgTripLength;
      var grossTripRevenue = dailyRate * tripDays;
      var turoHostFee = grossTripRevenue * (1 - retention);
      var turoPayout = grossTripRevenue - turoHostFee;
      var mgmtFee = turoPayout * (currentPlan / 100);
      var ownerShare = turoPayout - mgmtFee;
      var cleaning = trips * cleaningPerTrip;
      var maintenance = grossTripRevenue * MAINTENANCE_RATE;
      var depreciation = tripDays * depreciationPerTripDay;
      var net = ownerShare - cleaning - maintenance - depreciation;

      setText('tripCount', (Math.round(trips * 10) / 10).toLocaleString('en-CA'));
      setText('grossRev', '$' + money(grossTripRevenue));
      setText('turoFee', '-$' + money(turoHostFee));
      setText('turoPayout', '$' + money(turoPayout));
      setText('mgmtFee', '-$' + money(mgmtFee));
      setText('ownerShare', '$' + money(ownerShare));
      setText('cleaningCost', '-$' + money(cleaning));
      setText('maintCost', '-$' + money(maintenance));
      setText('depreciationCost', '-$' + money(depreciation));
      setText('netMonthly', money(net));
      setText('netMonthly2', '$' + money(net));
      setText('netAnnual', '$' + money(net * 12));
    }

    vehicleType.addEventListener('input', calculate);
    protectionPlan.addEventListener('input', calculate);
    daysAvailable.addEventListener('input', calculate);
    utilization.addEventListener('input', calculate);
    tripLength.addEventListener('input', calculate);

    for (var p = 0; p < planButtons.length; p++) {
      planButtons[p].addEventListener('click', function () {
        for (var i = 0; i < planButtons.length; i++) {
          planButtons[i].classList.remove('active');
          planButtons[i].setAttribute('aria-pressed', 'false');
        }
        this.classList.add('active');
        this.setAttribute('aria-pressed', 'true');
        currentPlan = parseInt(this.dataset.plan, 10);
        calculate();
      });
    }

    calculate();
  }

  /* ----------------------------------------------------------
     Multi-step contact form
     ---------------------------------------------------------- */
  var leadForm = document.getElementById('leadForm');
  if (leadForm) {
    var formSteps = Array.prototype.slice.call(leadForm.querySelectorAll('.form-step'));
    var progressBars = Array.prototype.slice.call(document.querySelectorAll('#formProgress .bar'));
    var stepLabel = document.getElementById('stepLabel');
    var currentStep = 1;

    function showStep(n, animate) {
      for (var i = 0; i < formSteps.length; i++) {
        var isActive = parseInt(formSteps[i].dataset.step, 10) === n;
        formSteps[i].classList.toggle('active', isActive);
        formSteps[i].classList.remove('entering');
        if (isActive && animate) {
          // Reflow so the animation restarts on every step change.
          void formSteps[i].offsetWidth;
          formSteps[i].classList.add('entering');
          var focusable = formSteps[i].querySelector('input, select');
          if (focusable) focusable.focus({ preventScroll: true });
        }
      }
      for (var b = 0; b < progressBars.length; b++) {
        progressBars[b].classList.toggle('filled', b < n);
      }
      if (stepLabel) stepLabel.textContent = 'Step ' + n + ' of ' + formSteps.length;
    }

    function validateStep(n) {
      var step = formSteps[n - 1];
      var inputs = step.querySelectorAll('input[required], select[required]');
      for (var i = 0; i < inputs.length; i++) {
        if (!inputs[i].checkValidity()) {
          inputs[i].reportValidity();
          return false;
        }
      }
      return true;
    }

    var nextButtons = leadForm.querySelectorAll('.form-next');
    for (var nb = 0; nb < nextButtons.length; nb++) {
      nextButtons[nb].addEventListener('click', function () {
        if (!validateStep(currentStep)) return;
        currentStep = Math.min(currentStep + 1, formSteps.length);
        showStep(currentStep, true);
      });
    }

    var backButtons = leadForm.querySelectorAll('.form-back');
    for (var bb = 0; bb < backButtons.length; bb++) {
      backButtons[bb].addEventListener('click', function () {
        currentStep = Math.max(currentStep - 1, 1);
        showStep(currentStep, true);
      });
    }

    // Enter should advance a step rather than submit a partial form.
    leadForm.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && currentStep < formSteps.length) {
        e.preventDefault();
        if (validateStep(currentStep)) {
          currentStep = Math.min(currentStep + 1, formSteps.length);
          showStep(currentStep, true);
        }
      }
    });

    leadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateStep(currentStep)) return;

      var data = new FormData(leadForm);
      var subject = encodeURIComponent('New vehicle lead: ' + data.get('fullName'));
      var body = encodeURIComponent(
        'Full Name: ' + data.get('fullName') + '\n' +
        'Email: ' + data.get('email') + '\n' +
        'Phone: ' + data.get('phone') + '\n' +
        'Location: ' + data.get('location') + '\n'
      );
      window.location.href = 'mailto:604kars@gmail.com?subject=' + subject + '&body=' + body;

      leadForm.style.display = 'none';
      var progress = document.querySelector('.form-progress');
      var label = document.querySelector('.form-step-label');
      if (progress) progress.style.display = 'none';
      if (label) label.style.display = 'none';
      var success = document.getElementById('formSuccess');
      if (success) success.style.display = 'block';
    });

    showStep(1, false);
  }
})();
