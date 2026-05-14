/* ============================================================
   6P Veri Shield — Demo Logic
   ============================================================
   This file controls page navigation and the live risk-analysis
   animation. Function names mirror the pseudocode in our report
   so the theory-to-implementation link is traceable during the
   demo (rubric requirement).
============================================================ */

// ============================================================
// CONFIG
// ============================================================
const TOTAL_PAGES = 14;
const AMBER_THRESHOLD = 2;   // urgency keywords needed to flag amber
const RED_THRESHOLD = 4;     // additional severity to flag red

let currentPage = 1;
let callTimerInterval = null;
let callSeconds = 0;
let riskSequenceTimers = [];

// ============================================================
// PAGE NAVIGATION
// ============================================================
function goToPage(pageNum) {
  // Clean up any running animations from previous page
  clearRiskSequence();
  stopCallTimer();

  // Hide all pages, show target page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${pageNum}`);
  if (target) {
    target.classList.add('active');
    currentPage = pageNum;
    updateIndicator();
    onPageEnter(pageNum);
  }
}

function nextPage() {
  if (currentPage < TOTAL_PAGES) goToPage(currentPage + 1);
}

function prevPage() {
  if (currentPage > 1) goToPage(currentPage - 1);
}

function updateIndicator() {
  const indicator = document.getElementById('pageIndicator');
  if (indicator) indicator.textContent = `Page ${currentPage} / ${TOTAL_PAGES}`;
}

// Page-specific entry hooks
function onPageEnter(pageNum) {
  switch (pageNum) {
    case 6:
      // Start the active call animation when we hit page 6
      startCallTimer();
      runRiskSequence();
      break;
  }
}

// ============================================================
// CONSENT CHECKBOX VALIDATION (Page 3)
// Demonstrates ACM 1.6 — Explicit Informed Consent
// Button stays disabled until ALL boxes are ticked.
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const checkboxes = document.querySelectorAll('.consent-check');
  const consentBtn = document.getElementById('consentBtn');

  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const allChecked = Array.from(checkboxes).every(c => c.checked);
      if (consentBtn) {
        if (allChecked) {
          consentBtn.classList.remove('disabled');
          consentBtn.disabled = false;
        } else {
          consentBtn.classList.add('disabled');
          consentBtn.disabled = true;
        }
      }
    });
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') nextPage();
    if (e.key === 'ArrowLeft') prevPage();
  });
});

// ============================================================
// CALL TIMER (Page 6 — active call)
// ============================================================
function startCallTimer() {
  callSeconds = 0;
  const timerEl = document.getElementById('callTimer');
  if (!timerEl) return;
  timerEl.textContent = '00:00';

  callTimerInterval = setInterval(() => {
    callSeconds++;
    const m = String(Math.floor(callSeconds / 60)).padStart(2, '0');
    const s = String(callSeconds % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }, 1000);
}

function stopCallTimer() {
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
}

// ============================================================
// RISK ANALYSIS SEQUENCE — the demo centerpiece
// ============================================================
// This is what the live call screen animates through:
//   1. Green state (low risk)  — call begins normally
//   2. Amber state (elevated)  — urgency keywords detected
//   3. Red state (high)        — payment + secrecy keywords
//   4. Auto-advance to high-risk modal
//
// Function names match the pseudocode in our report so the
// theory-to-implementation link is traceable.
// ============================================================

function clearRiskSequence() {
  riskSequenceTimers.forEach(t => clearTimeout(t));
  riskSequenceTimers = [];
}

function runRiskSequence() {
  // Stage 1: Green — initial greeting (0-4 seconds)
  setRiskLevel('green', 'Low', 'No unusual signals');
  setTranscript('"Hi Sarah, hope your week is going well..."', null);

  // Stage 2: Amber — urgency keywords appear (4 seconds in)
  riskSequenceTimers.push(setTimeout(() => {
    const score = analyzeRisk({
      keywords: ['urgent', 'confidential'],
      hasPaymentRequest: false
    });
    applyRiskScore(score);
    setTranscript(
      '"...I need you to handle something <mark>urgent</mark> and <mark>confidential</mark> for me today..."',
      '⚠ Risk indicators detected: urgency keywords'
    );
  }, 4000));

  // Stage 3: Red — payment + secrecy keywords appear (9 seconds in)
  riskSequenceTimers.push(setTimeout(() => {
    const score = analyzeRisk({
      keywords: ['urgent', 'confidential', 'transfer', 'do not tell anyone'],
      hasPaymentRequest: true
    });
    applyRiskScore(score);
    setTranscript(
      '"...transfer <mark class="danger">€2.3 million</mark> to this account today. <mark class="danger">Don\'t tell anyone</mark>."',
      '⚠ High risk: payment request + secrecy + urgency'
    );
  }, 9000));

  // Stage 4: Auto-advance to high-risk modal (13 seconds in)
  riskSequenceTimers.push(setTimeout(() => {
    goToPage(7);
  }, 13000));
}

// ============================================================
// analyzeRisk(callContext)
// ============================================================
// ETHICAL DECISION POINT — Utilitarian Harm Minimisation
//   We weigh aggregate harm prevented (millions in fraud) against
//   friction caused (verification delay). Combined score drives
//   risk level.
//
// ETHICAL DECISION POINT — Deontological Honesty (ACM 1.3)
//   Function NEVER returns "fake" or "definite fraud" — only
//   "low / elevated / high risk". We communicate uncertainty
//   honestly rather than overclaim certainty.
// ============================================================
function analyzeRisk(callContext) {
  const keywordScore = callContext.keywords.length;
  const paymentBonus = callContext.hasPaymentRequest ? 2 : 0;
  const combined = keywordScore + paymentBonus;

  if (combined >= RED_THRESHOLD) {
    return { level: 'red', label: 'High', subtitle: 'Verification required' };
  }
  if (combined >= AMBER_THRESHOLD) {
    return { level: 'amber', label: 'Elevated', subtitle: 'Unverified identity' };
  }
  return { level: 'green', label: 'Low', subtitle: 'No unusual signals' };
}

function applyRiskScore(score) {
  setRiskLevel(score.level, score.label, score.subtitle);
}

// ============================================================
// UI UPDATE HELPERS
// ============================================================
function setRiskLevel(level, label, subtitle) {
  const gauge = document.getElementById('riskGauge');
  const labelEl = document.getElementById('riskLabel');
  const subEl = document.getElementById('riskSubtitle');
  if (!gauge) return;

  gauge.classList.remove('risk-green', 'risk-amber', 'risk-red');
  gauge.classList.add(`risk-${level}`);
  if (labelEl) labelEl.textContent = label;
  if (subEl) subEl.textContent = subtitle;
}

function setTranscript(text, alert) {
  const textEl = document.getElementById('transcriptText');
  const alertEl = document.getElementById('transcriptAlert');
  if (textEl) textEl.innerHTML = text;
  if (alertEl) {
    if (alert) {
      alertEl.textContent = alert;
      alertEl.classList.remove('hidden');
    } else {
      alertEl.classList.add('hidden');
    }
  }
}

// ============================================================
// DEV NAV TOGGLE
// Hide controls during final demo. Press 'h' to show again.
// ============================================================
function toggleDevNav() {
  const nav = document.getElementById('devNav');
  if (nav) nav.classList.toggle('hidden');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') toggleDevNav();
});