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
  const isOpen = mobileMenu.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});
mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  mobileMenu.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
}));

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
        openItem.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      }
    });
    if (isOpen) {
      item.classList.remove('open');
      a.style.maxHeight = null;
      q.setAttribute('aria-expanded', 'false');
    } else {
      item.classList.add('open');
      a.style.maxHeight = a.scrollHeight + 'px';
      q.setAttribute('aria-expanded', 'true');
    }
  });
});

/* ---------- Earnings calculator ----------
 * Order of operations (per Aug 2026 audit — previous version omitted the
 * Turo host fee entirely and understated real owner take-home by 35-50%):
 *   grossTripRevenue = dailyRate * tripDays          (guest-facing trip price)
 *   turoHostFee       = grossTripRevenue * (1 - retention)   -- Turo's cut, shown as its own line
 *   turoPayout        = grossTripRevenue - turoHostFee       -- what the host actually receives from Turo
 *   mgmtFee           = turoPayout * managementPlanPercent   -- computed on payout, not gross
 *   ownerShare        = turoPayout - mgmtFee
 *   cleaning          = tripDays * cleaningPerTrip
 *   maintenance       = grossTripRevenue * 0.08               -- raised from 5%, still an estimate
 *   depreciation      = tripDays * depreciationPerTripDay      -- previously missing entirely
 *   ownerNet          = ownerShare - cleaning - maintenance - depreciation
 */
const vehicleType = document.getElementById('vehicleType');
const protectionPlan = document.getElementById('protectionPlan');
const daysAvailable = document.getElementById('daysAvailable');
const utilization = document.getElementById('utilization');
const daysVal = document.getElementById('daysVal');
const utilVal = document.getElementById('utilVal');
const planButtons = document.querySelectorAll('.plan-toggle button');

let currentPlan = 30;

/** @param {number} n @returns {string} */
function fmt(n) {
  return Math.round(n).toLocaleString('en-CA');
}

function calculate() {
  const dailyRate = parseFloat(vehicleType.selectedOptions[0].dataset.rate);
  const cleaningPerTrip = parseFloat(vehicleType.selectedOptions[0].dataset.clean);
  const depreciationPerTrip = parseFloat(vehicleType.selectedOptions[0].dataset.depreciation);
  const retention = parseFloat(protectionPlan.selectedOptions[0].dataset.retention);
  const days = parseInt(daysAvailable.value, 10);
  const util = parseInt(utilization.value, 10);

  daysVal.textContent = days;
  utilVal.textContent = util;

  const tripDays = days * (util / 100);
  const grossTripRevenue = dailyRate * tripDays;
  const turoHostFee = grossTripRevenue * (1 - retention);
  const turoPayout = grossTripRevenue - turoHostFee;
  const mgmtFee = turoPayout * (currentPlan / 100);
  const ownerShare = turoPayout - mgmtFee;
  const cleaning = tripDays * cleaningPerTrip;
  const maintenance = grossTripRevenue * 0.08;
  const depreciation = tripDays * depreciationPerTrip;
  const net = ownerShare - cleaning - maintenance - depreciation;
  const annual = net * 12;

  document.getElementById('grossRev').textContent = '$' + fmt(grossTripRevenue);
  document.getElementById('turoFee').textContent = '-$' + fmt(turoHostFee);
  document.getElementById('turoPayout').textContent = '$' + fmt(turoPayout);
  document.getElementById('mgmtFee').textContent = '-$' + fmt(mgmtFee);
  document.getElementById('ownerShare').textContent = '$' + fmt(ownerShare);
  document.getElementById('cleaningCost').textContent = '-$' + fmt(cleaning);
  document.getElementById('maintCost').textContent = '-$' + fmt(maintenance);
  document.getElementById('depreciationCost').textContent = '-$' + fmt(depreciation);
  document.getElementById('netMonthly').textContent = fmt(net);
  document.getElementById('netMonthly2').textContent = '$' + fmt(net);
  document.getElementById('netAnnual').textContent = '$' + fmt(annual);
}

[vehicleType, protectionPlan, daysAvailable, utilization].forEach(el => el.addEventListener('input', calculate));

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
