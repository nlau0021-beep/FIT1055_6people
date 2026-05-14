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
const TOTAL_PAGES = 14;          // main demo flow length (1..14)
const MAX_PAGE_ID = 18;          // including alternative-path branches
const AMBER_THRESHOLD = 2;       // urgency keywords needed to flag amber
const RED_THRESHOLD = 4;         // additional severity to flag red

let currentPage = 1;
let previousPage = null;
let callTimerInterval = null;
let callSeconds = 0;
let riskSequenceTimers = [];
let approveAutoAdvanceTimer = null;

// ============================================================
// PAGE NAVIGATION
// ============================================================
function goToPage(pageNum) {
  // Clean up any running animations from previous page
  clearRiskSequence();
  stopCallTimer();
  if (approveAutoAdvanceTimer) { clearTimeout(approveAutoAdvanceTimer); approveAutoAdvanceTimer = null; }

  // Track where we came from (used by alternative-path dashboard rendering)
  previousPage = currentPage;

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
  // Smart "next" handling:
  // - Main flow (1..14): step linearly through the demo
  // - Alternative-path pages (15, 16, 17): each has its own outbound route
  //   already wired in the HTML, but if the user hits Next from an alt page,
  //   route them back into a sensible place in the main flow.
  if (currentPage >= 1 && currentPage < TOTAL_PAGES) {
    goToPage(currentPage + 1);
  } else if (currentPage === 15) {
    // False-positive branch → jump to dashboard
    goToPage(12);
  } else if (currentPage === 16) {
    // Approve-mobile branch → desktop confirmation
    goToPage(17);
  } else if (currentPage === 17) {
    // Desktop approved → dashboard
    goToPage(12);
  } else if (currentPage === 18) {
    // Declined branch → dashboard
    goToPage(12);
  }
}

function prevPage() {
  if (currentPage > 1 && currentPage <= TOTAL_PAGES) {
    goToPage(currentPage - 1);
  } else if (currentPage === 15) {
    goToPage(7);   // back to high-risk modal
  } else if (currentPage === 16) {
    goToPage(9);   // back to mobile approval prompt
  } else if (currentPage === 17) {
    goToPage(16);  // back to mobile approve success
  } else if (currentPage === 18) {
    goToPage(5);   // back to incoming call
  }
}

function updateIndicator() {
  const indicator = document.getElementById('pageIndicator');
  if (!indicator) return;
  // For alternative branches, show their actual ID instead of pretending
  // they're part of the main 14-page count.
  if (currentPage > TOTAL_PAGES) {
    indicator.textContent = `Alt path ${currentPage} / ${MAX_PAGE_ID}`;
  } else {
    indicator.textContent = `Page ${currentPage} / ${TOTAL_PAGES}`;
  }
}

// Page-specific entry hooks
function onPageEnter(pageNum) {
  switch (pageNum) {
    case 4:
      setEnrollDate();
      break;
    case 6:
      // Start the active call animation
      startCallTimer();
      runRiskSequence();
      break;
    case 11:
      setBlockedTime();
      break;
    case 12:
      setDashboardWeek();
      updateLatestIncident();
      break;
    case 15:
      // False-positive branch — log timestamp
      setFalsePositiveTime();
      break;
    case 16:
      // Approve-mobile branch — auto-advance to desktop confirmation
      // after 2.5s so the audience sees the success state, then the
      // bigger desktop confirmation arrives without a manual click.
      approveAutoAdvanceTimer = setTimeout(() => {
        goToPage(17);
      }, 2500);
      break;
    case 17:
      setApprovedTime();
      break;
    case 18:
      setDeclinedTime();
      break;
  }
}

// ============================================================
// DATE / TIME FORMATTERS
// ============================================================
// These keep the prototype feeling live — dates update whenever
// the demo is shown rather than being frozen at build time.
// ============================================================

function setEnrollDate() {
  const el = document.getElementById('enrollDate');
  if (!el) return;
  el.textContent = formatDate(new Date());
}

function setBlockedTime() {
  const el = document.getElementById('blockedTime');
  if (!el) return;
  el.textContent = formatDateTime(new Date());
}

function setFalsePositiveTime() {
  const el = document.getElementById('falsePositiveTime');
  if (!el) return;
  el.textContent = formatDateTime(new Date());
}

function setApprovedTime() {
  const el = document.getElementById('approvedTime');
  if (!el) return;
  el.textContent = formatDateTime(new Date());
}

function setDeclinedTime() {
  const el = document.getElementById('declinedTime');
  if (!el) return;
  el.textContent = formatDateTime(new Date());
}

function setDashboardWeek() {
  const el = document.getElementById('dashboardWeek');
  if (!el) return;
  const today = new Date();
  const day = today.getDay();
  const offsetToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + offsetToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const monthName = sunday.toLocaleString('en-US', { month: 'long' });
  el.textContent = `Week of ${monday.getDate()}–${sunday.getDate()} ${monthName} ${sunday.getFullYear()}`;
}

function formatDate(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateTime(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)}, ${hh}:${mm}`;
}

// ============================================================
// LATEST INCIDENT — adapts to which path the user just walked
// ============================================================
// When the user reaches the dashboard, highlight the most recent
// event according to where they came from:
//   - From page 11 (blocked):       High risk, Blocked
//   - From page 15 (false positive): Elevated risk, Reviewed
//   - From page 17 (approved):       High risk, Approved
//   - Anywhere else (e.g. direct):   default to Blocked
//
// Only the highlighted row changes. The four older rows stay
// fixed so the dashboard looks like an established system.
// ============================================================
function updateLatestIncident() {
  const timeEl    = document.getElementById('latestIncidentTime');
  const outcomeEl = document.getElementById('latestIncidentOutcome');
  const rowEl     = document.getElementById('latestIncidentRow');
  if (!timeEl || !outcomeEl || !rowEl) return;

  let outcome = 'Blocked — denied by device';
  let riskHTML = '<span class="risk-pill risk-pill-red">High</span>';
  let theoryHTML = '<span class="theory-pill theory-deon">Deontological</span>';

  if (previousPage === 15) {
    outcome = 'Reviewed — marked false positive';
    riskHTML = '<span class="risk-pill risk-pill-amber">Elevated</span>';
    theoryHTML = '<span class="theory-pill theory-virt">Virtue · Justice</span>';
  } else if (previousPage === 17) {
    outcome = 'Approved — passkey verified';
    riskHTML = '<span class="risk-pill risk-pill-red">High</span>';
    theoryHTML = '<span class="theory-pill theory-util">Utilitarian</span>';
  } else if (previousPage === 18) {
    outcome = 'Declined — user-initiated, no data processed';
    riskHTML = '<span class="risk-pill risk-pill-green">N/A</span>';
    theoryHTML = '<span class="theory-pill theory-deon">Deontological · Autonomy</span>';
  }

  timeEl.textContent = 'just now';
  outcomeEl.textContent = outcome;

  // Direct children of the row: time, recipient, risk-wrapper, outcome, theory-wrapper
  const directCells = Array.from(rowEl.children).filter(el => el.tagName === 'SPAN');
  if (directCells.length >= 5) {
    directCells[2].innerHTML = riskHTML;
    directCells[4].innerHTML = theoryHTML;
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