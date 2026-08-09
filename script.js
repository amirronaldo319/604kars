// 604 Kars — site interactivity

document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- Scroll progress bar ---------- */
const scrollProgress = document.getElementById('scrollProgress');
function updateScrollProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  scrollProgress.style.width = pct + '%';
}
window.addEventListener('scroll', updateScrollProgress, { passive: true });
updateScrollProgress();

/* ---------- Mobile nav ---------- */
const navToggle = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');
navToggle.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});
mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileMenu.classList.remove('open')));

/* ---------- Scroll reveal ---------- */
const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
revealEls.forEach(el => revealObserver.observe(el));

// Fallback: catches elements the observer can miss when a user jumps straight to
// a section (deep-linked #hash on load, prefers-reduced-motion skipping smooth-scroll,
// or restored scroll position) rather than passing through it during a scroll.
function revealVisibleNow() {
  document.querySelectorAll('.reveal:not(.in)').forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.classList.add('in');
      revealObserver.unobserve(el);
    }
  });
}
window.addEventListener('load', revealVisibleNow);
window.addEventListener('hashchange', () => setTimeout(revealVisibleNow, 50));
window.addEventListener('scroll', revealVisibleNow, { passive: true });
if (location.hash) revealVisibleNow();

/* ---------- Hero gauge animation ---------- */
const gaugeArc = document.getElementById('gaugeArc');
const gaugeNum = document.getElementById('gaugeNum');
const ARC_LENGTH = 267;
const TARGET = 82;
let gaugeAnimated = false;

function animateGauge() {
  if (gaugeAnimated) return;
  gaugeAnimated = true;
  const duration = 1400;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(TARGET * eased);
    gaugeNum.textContent = value;
    gaugeArc.setAttribute('stroke-dashoffset', ARC_LENGTH - (ARC_LENGTH * TARGET / 100) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const gaugeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateGauge();
      gaugeObserver.disconnect();
    }
  });
}, { threshold: 0.4 });
gaugeObserver.observe(document.querySelector('.status-panel'));

/* ---------- FAQ accordion ---------- */
document.querySelectorAll('.faq-item').forEach(item => {
  const q = item.querySelector('.faq-q');
  const a = item.querySelector('.faq-a');
  q.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(openItem => {
      if (openItem !== item) {
        openItem.classList.remove('open');
        openItem.querySelector('.faq-a').style.maxHeight = null;
      }
    });
    if (isOpen) {
      item.classList.remove('open');
      a.style.maxHeight = null;
    } else {
      item.classList.add('open');
      a.style.maxHeight = a.scrollHeight + 'px';
    }
  });
});

/* ---------- Earnings calculator ---------- */
const vehicleType = document.getElementById('vehicleType');
const daysAvailable = document.getElementById('daysAvailable');
const utilization = document.getElementById('utilization');
const daysVal = document.getElementById('daysVal');
const utilVal = document.getElementById('utilVal');
const planButtons = document.querySelectorAll('.plan-toggle button');

let currentPlan = 30;

function fmt(n) {
  return Math.round(n).toLocaleString('en-CA');
}

function calculate() {
  const dailyRate = parseFloat(vehicleType.value);
  const cleaningPerTrip = parseFloat(vehicleType.selectedOptions[0].dataset.clean);
  const days = parseInt(daysAvailable.value, 10);
  const util = parseInt(utilization.value, 10);

  daysVal.textContent = days;
  utilVal.textContent = util;

  const tripDays = days * (util / 100);
  const gross = dailyRate * tripDays;
  const fee = gross * (currentPlan / 100);
  const ownerShare = gross - fee;
  const cleaning = tripDays * cleaningPerTrip;
  const maintenance = gross * 0.05;
  const net = ownerShare - cleaning - maintenance;
  const annual = net * 12;

  document.getElementById('grossRev').textContent = '$' + fmt(gross);
  document.getElementById('mgmtFee').textContent = '-$' + fmt(fee);
  document.getElementById('ownerShare').textContent = '$' + fmt(ownerShare);
  document.getElementById('cleaningCost').textContent = '-$' + fmt(cleaning);
  document.getElementById('maintCost').textContent = '-$' + fmt(maintenance);
  document.getElementById('netMonthly').textContent = fmt(Math.max(net, 0));
  document.getElementById('netMonthly2').textContent = '$' + fmt(net);
  document.getElementById('netAnnual').textContent = '$' + fmt(Math.max(annual, 0));
}

[vehicleType, daysAvailable, utilization].forEach(el => el.addEventListener('input', calculate));

planButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    planButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPlan = parseInt(btn.dataset.plan, 10);
    calculate();
  });
});

calculate();

/* ---------- Multi-step contact form ---------- */
const leadForm = document.getElementById('leadForm');
const formSteps = Array.from(leadForm.querySelectorAll('.form-step'));
const progressBars = Array.from(document.querySelectorAll('#formProgress .bar span'));
const stepLabel = document.getElementById('stepLabel');
let currentStep = 1;

function showStep(n) {
  formSteps.forEach(step => step.classList.toggle('active', parseInt(step.dataset.step, 10) === n));
  progressBars.forEach((bar, i) => {
    bar.style.width = (i < n) ? '100%' : '0%';
  });
  stepLabel.textContent = `Step ${n} of ${formSteps.length}`;
}

function validateStep(n) {
  const step = formSteps[n - 1];
  const inputs = step.querySelectorAll('input[required], select[required]');
  for (const input of inputs) {
    if (!input.checkValidity()) {
      input.reportValidity();
      return false;
    }
  }
  return true;
}

leadForm.querySelectorAll('.form-next').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!validateStep(currentStep)) return;
    currentStep = Math.min(currentStep + 1, formSteps.length);
    showStep(currentStep);
  });
});

leadForm.querySelectorAll('.form-back').forEach(btn => {
  btn.addEventListener('click', () => {
    currentStep = Math.max(currentStep - 1, 1);
    showStep(currentStep);
  });
});

leadForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateStep(currentStep)) return;

  const data = new FormData(leadForm);
  const subject = encodeURIComponent(`New vehicle lead: ${data.get('fullName')}`);
  const body = encodeURIComponent(
    `Full Name: ${data.get('fullName')}\n` +
    `Email: ${data.get('email')}\n` +
    `Phone: ${data.get('phone')}\n` +
    `Location: ${data.get('location')}\n`
  );
  window.location.href = `mailto:604kars@gmail.com?subject=${subject}&body=${body}`;

  leadForm.style.display = 'none';
  document.querySelector('.form-progress').style.display = 'none';
  document.querySelector('.form-step-label').style.display = 'none';
  document.getElementById('formSuccess').style.display = 'block';
});
