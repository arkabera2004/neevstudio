"""Regulatory grounding for infusion-pump requirement generation.

Sourced from `info doc/Infusion_Pump_Requirements_Research.md`, which fact-checked
each claim against primary sources (FDA, IEC, WHO, peer-reviewed clinical
literature). This exists because the difference between a credible requirement
and a plausible-sounding one is a real number with a real clause behind it, and
the model cannot be trusted to recall those unprompted.

Only claims the research marked [Verified] or [Sourced] are carried here.
"""
from __future__ import annotations

# ── Standards that govern this device class ──────────────────────────────────
# IEC 60601-1-8 is called out deliberately: the client's own sample REG-* list
# omits it entirely, yet alarms are their second-largest FDA-flagged hazard
# category. It is a gap the platform should surface unprompted.
STANDARDS = """\
STANDARDS GOVERNING VOLUMETRIC / PCA INFUSION PUMPS:
- IEC 60601-1 — general basic safety & essential performance (umbrella standard).
- IEC 60601-2-24:2012 (2nd ed.) — PARTICULAR standard for infusion pumps and
  controllers. The single most important standard for this device class.
  Table 201.101 designates flow-rate accuracy, protection against unintended
  bolus and occlusion, and high-priority alarm signalling as ESSENTIAL PERFORMANCE.
- IEC 60601-1-2 — EMC (electromagnetic compatibility).
- IEC 60601-1-8 — alarm systems. FDA's infusion-pump 510(k) guidance explicitly
  recommends occlusion / air-in-line / free-flow / dose-limit / battery alarms be
  shown to meet this standard.
- IEC 60601-1-11 — home healthcare environment; IEC 60601-1-12 — EMS environment.
  Both require accuracy testing REPEATED across temperature, humidity and
  barometric-pressure ranges. A single ambient-condition test is insufficient.
- IEC 62304 — medical device software lifecycle. Infusion pump dosing/alarm logic
  is normally software safety Class C (highest).
- IEC 62366 — usability engineering. Requires use-related risk analysis, a
  critical-task list, and BOTH formative and summative usability testing.
- ISO 14971 — risk management. FDA's 2025 cybersecurity guidance treats
  cybersecurity risk as a subset of ISO 14971, layered with ANSI/AAMI SW96 and
  AAMI TIR57.
- ISO 13485 — quality management system.
- ISO 15223-1:2021 (4th edition) — labelling symbols. Added 25 new symbols vs the
  2016 edition, including the "MD" medical-device symbol and a distinct UDI
  carrier symbol. A 2024 amendment changed "EC REP" to "EU-REP".
- 21 CFR 880.5725 — FDA classification (Class II, 510(k) pathway).
"""

# ── Concrete, testable numbers ───────────────────────────────────────────────
# The client's samples are all "shall comply" with no figures behind them. These
# are the figures that turn a promise into a requirement.
BENCHMARKS = """\
CONCRETE NUMERIC BENCHMARKS AND TEST METHODS (use these — never invent figures):

Accuracy test method (IEC 60601-2-24, fully specified — not left open):
- Test rate 25 mL/h for volumetric pumps/controllers; 5 mL/h for syringe/container pumps.
- Minimum selectable rate must be >= 1 mL/h.
- Test fluid: ISO 3696 Class III water (or a representative fluid for drug-specific devices).
- Test needle: 18-gauge per ISO 7864.
- Sampling: fixed 15-minute windows for continuous/volumetric pumps; "shot cycle"
  (start of one injection to the next) for syringe/PCA-style pumps.

Air-in-line fault response (IEC 60601-2-24 — a real formula, encode it):
- On a single fault in the air-detection system, the pump must stop delivery and
  alarm within a time LESS THAN (tubing volume between air detector and patient
  connection) / (pump maximum flow rate).

Occlusion alarm disclosure (IEC 60601-2-24 — an IFU obligation, not just a design one):
- The manufacturer must state maximum time-to-alarm at minimum rate, intermediate
  rate, and minimum selectable rate, at BOTH the minimum and maximum selectable
  occlusion pressure threshold, and state whether tubing temperature/length
  affects that timing.

WHO infusion-device technical specification (independent procurement benchmark):
- Flow accuracy +/-5% or better (+/-2% for syringe pumps with dedicated syringes).
- Selectable occlusion pressure trigger levels of at least 300, 500 and 900 mmHg.
- Audible alarm >= 45 dB, with momentary silence capped under 2 minutes.
- Mandatory free-flow protection and air-trapping in the IV set.
- Anti-bolus system to limit pressure release when an occlusion clears.
- Drug library of 250+ medications with a dose-rate entry mode (DERS).
- Manufacturer holds ISO 13485 and/or ISO 9001; minimum 2-year warranty;
  5-year spares/consumables availability.
"""

# ── Known gaps in the client's sample documents ──────────────────────────────
# Fed to the model so it flags these as origin="gap" rather than silently
# reproducing the source document's omissions.
KNOWN_GAPS = """\
GAPS COMMONLY ABSENT FROM INFUSION-PUMP REQUIREMENT SETS — flag these as origin="gap"
when the source document does not cover them:

1. Numeric thresholds. "Shall comply with IEC 60601-1" is a promise, not a
   requirement. Every accuracy, timing and pressure figure needs a real number and
   a test method behind it.
2. Drug library / Dose Error Reduction System (DERS) — near-universal on modern
   smart pumps; WHO's spec requires 250+ medications and a dose-rate entry mode.
3. Cybersecurity per FDA's final guidance of 27 June 2025 (FD&C Act s.524B). Every
   premarket submission for a "cyber device" must include: (a) a cybersecurity
   management plan, continually maintained; (b) processes providing reasonable
   assurance of cybersecurity; (c) a Software Bill of Materials (SBOM).
   Authentication and encrypted comms alone do not satisfy this.
4. IEC 62366 usability engineering as an explicit PROCESS — use-related risk
   analysis, critical-task list, formative AND summative testing. FDA states that
   mitigating a use-safety hazard through labelling or training alone is
   "generally not acceptable"; the device must be designed against the error.
5. IEC 60601-1-8 alarm-system conformance — frequently omitted from the standards
   list despite alarms being a top FDA-flagged hazard category.
6. Environmental-extremes testing (IEC 60601-1-11 / -1-12) — accuracy re-tested
   across temperature, humidity and barometric pressure, not a single ambient test.
7. PCA/PIEB-specific controls — lockout intervals, clinician override with tiered
   access control, cumulative dose caps across ALL dosing paths.
8. Combination-product consideration if the pump ships paired to a specific drug
   formulation (FDA Office of Combination Products consultation).
9. Labelling currency — ISO 15223-1:2021 4th-edition symbol set, e-IFU rules
   (EU MDR permits e-IFU only for specific categories, and a paper copy must still
   be provided within 7 days of request at no cost).
"""

# ── FDA history: why this device class is scrutinised ────────────────────────
FDA_HISTORY = """\
WHY FDA SCRUTINISES THIS CATEGORY (verified against four independent FDA sources):
- 2005-2009: ~56,000 adverse event reports associated with infusion pumps
  (~1% deaths, ~34% serious injuries, ~62% malfunctions), and 87 recalls
  (70 Class II, 14 Class I).
- Most common problem categories: SOFTWARE DEFECTS, USER INTERFACE issues, and
  mechanical/electrical failures — the pattern was industry-wide, not
  concentrated in one manufacturer or pump type.
- Documented failure examples FDA cites: a "key bounce" defect registering one
  keystroke as two (turning "0" into "00" — a 10x dosing error); pumps failing to
  activate their own pre-programmed alarms; ambiguous on-screen units (lbs vs kg).
- This drove FDA's Infusion Pump Improvement Initiative (2010), a Total Product
  Life Cycle guidance, and inspections of all 20 registered US manufacturers.
"""

# ── PIEB / PCA therapy grounding ─────────────────────────────────────────────
# The client asked for requirements for a therapy mode they sent NO document
# about. Without this block the model would produce plausible fiction. The
# dose-stacking hazard below is the single most valuable thing here: it is a
# real, documented, still-unresolved gap in a shipping product.
PIEB = """\
PROGRAMMABLE INTERMITTENT EPIDURAL BOLUS (PIEB) — CLINICAL AND SAFETY GROUNDING:

What it is:
- PIEB delivers the epidural maintenance dose as AUTOMATED BOLUSES AT SET INTERVALS
  rather than a continuous steady rate. It is typically combined with PCEA
  (patient-controlled epidural analgesia) — a patient-triggered demand dose layered
  on top, subject to a lockout interval.
- It is a PUMP PROGRAMMING / MODE feature, not a different hardware category.
  Existing epidural pumps with PCEA capability can deliver it.
- FDA explicitly recognises PCA infusion pumps as a distinct specialty category
  defined by the patient self-administration feature.

Real-world dosing parameters (from an NHS clinical protocol and two published
clinical studies — realistic reference points, not a universal standard):
- Automated bolus: 7-8 mL every 45-60 minutes.
- PCEA demand bolus: 6-7 mL with a 10-20 minute lockout.
- Initial lockout at protocol start: 20 minutes before the first PCEA dose.
- Combined maximum hourly dose: capped below 30 mL/hour across BOTH auto-bolus
  and PCEA sources.
- Clinician override: a separate "clinician bolus" function requiring an elevated
  access code, used for test/loading doses and breakthrough pain.

Clinical evidence: PIEB+PCEA shows longer time to first manual rescue bolus
(~180 -> ~210 min), fewer rescue interventions, and higher maternal satisfaction
versus continuous epidural infusion, with no significant difference in adverse
safety outcomes. Caveat: a NICE evidence review found low-certainty evidence
overall and one signal of possibly increased instrumental delivery — position PIEB
as an additional option, not a guaranteed superior replacement.

*** THE SAFETY-CRITICAL GAP — surface this, it is the highest-value finding ***
A documented, still-current gap in at least one commercial PIEB implementation
(CME Bodyguard): administering a CLINICIAN BOLUS DOES NOT RESET OR DELAY THE TIMER
for the next automated bolus or PCEA dose. A patient can therefore receive an
additional bolus shortly after a clinician dose — a DOSE-STACKING risk. The only
mitigation in that implementation is a MANUAL staff action (a "+/- delay
auto-bolus" button): the device does not enforce safety by default, it relies on
staff remembering to act.
Scope this honestly: it is a real, documented gap in at least one common
implementation — NOT a property of all PIEB pumps by design.

Requirements that should follow from that hazard:
- Configurable auto-bolus volume and interval, independently settable from the
  PCEA demand dose and lockout.
- DEVICE-ENFORCED (not procedure-dependent) cumulative dose-cap logic across ALL
  dosing paths — auto-bolus, PCEA and clinician bolus combined — rather than three
  independently-timed mechanisms that can stack.
- Any clinician-initiated bolus either automatically re-arms/delays the next
  scheduled auto-bolus and PCEA availability, or — if that is not the design
  choice — the residual risk is explicitly documented and the delay action is a
  mandatory, system-prompted step rather than an optional manual button.
- Tiered access control (distinct codes/roles) for starting the protocol, giving a
  clinician bolus, and reprogramming parameters.
- A distinct test-dose/loading-dose workflow before the automated maintenance
  program begins.
- Configurable initial lockout period effective from protocol start, independent
  of the pump's steady-state lockout value.
"""


# ── Citable standards whitelist ──────────────────────────────────────────────
# The compliance matrix lives or dies on its citations: a plausible-looking
# standard with an invented edition year is worse than no citation at all,
# because a TE reviewer will check it. The model may cite ONLY from this list,
# and must reproduce the strings verbatim — edition years included.
STANDARDS_WHITELIST = """\
CITABLE STANDARDS — use ONLY these strings, copied EXACTLY (edition years included).
Never cite a standard that is not on this list unless the requirement text itself
names one; if unsure of an edition, cite the family standard without a year.

- IEC 60601-1:2005+AMD1:2012+AMD2:2020   (general basic safety & essential performance)
- IEC 60601-1-2:2014+AMD1:2020           (EMC — ed. 4.1; there is NO standalone ":2020" edition)
- IEC 60601-1-6:2010+AMD1:2013+AMD2:2020 (usability, collateral)
- IEC 60601-1-8:2006+AMD1:2012+AMD2:2020 (alarm systems)
- IEC 60601-1-11:2015                    (home healthcare environment)
- IEC 60601-2-24:2012                    (PARTICULAR standard for infusion pumps)
- IEC 62304:2006+AMD1:2015               (medical device software lifecycle)
- IEC 62366-1:2015+AMD1:2020             (usability engineering)
- ISO 14971:2019                         (risk management)
- IEC/TR 24971:2020                      (ISO 14971 guidance)
- ISO 13485:2016                         (quality management system)
- IEC 81001-5-1:2021                     (health software security lifecycle)
- IEC 62133-2:2017                       (lithium secondary cell safety)
- IEC 60068-2-27                         (mechanical shock)
- IEC 60068-2-64                         (vibration, broadband random)
- ISO 15223-1:2021                       (labelling symbols)
- ISO 80369-6                            (NRFit neuraxial small-bore connectors)
- 21 CFR 801                             (FDA device labelling)
- 21 CFR Part 830                        (UDI)
- 21 CFR 820.30                          (design controls)
- 21 CFR 880.5725                        (infusion pump classification)
- EU MDR 2017/745                        (EU regulation)
- ANSI/AAMI SW96                         (medical device security risk management)
- ANSI Z535                              (safety-sign & label format)
- FD&C Act §524B                         (cybersecurity, FDA final guidance 27 Jun 2025)

Cite several where genuinely applicable, separated by "; ". Add a clause where you
are confident of it (e.g. "IEC 60601-2-24:2012 Table 201.101"), never otherwise.
"""

# ── CTS/CTQ classification rubric ────────────────────────────────────────────
# Grounds the dedicated classification pass (app/classify). The breakdown
# pipeline assigns a preliminary class inline; this rubric is for the formal
# second pass that confirms or overturns it, so it also states what a valid
# outcome looks like — agreement is not a failure.
CLASSIFICATION_RUBRIC = """\
CRITICALITY CLASSIFICATION RUBRIC (ISO 14971 risk-based):
- CTS (Critical to Safety) — the requirement's failure path reaches the patient
  directly. For an infusion device this is the essential-performance territory of
  IEC 60601-2-24 Table 201.101: dose delivery and accuracy, occlusion detection,
  air-in-line detection, free-flow prevention, unintended-bolus protection,
  alarm generation and annunciation, safe-state transition, wrong-route
  protection. If the requirement failing IS the harm path, it is CTS.
- CTQ (Critical to Quality) — failure degrades performance, usability,
  reliability or availability without a direct harm path: battery runtime,
  workflow efficiency, connectivity, logging with clinical relevance,
  serviceability, environmental robustness that surfaces as detectable
  malfunction first.
- Standard — everything else: identification, documentation, configuration
  display, diagnostics reporting, general housekeeping.

CLASSIFICATION DISCIPLINE:
- You are given each requirement's PRELIMINARY classification from the
  decomposition pass. Agreement is a valid outcome — do NOT reclassify to look
  busy. Overturn a class only when the rubric clearly says so, and state the
  reason in the rationale.
- Guard against CTS-inflation: "could conceivably contribute to harm" is CTQ,
  not CTS. The hardware behind a safety function (PCB coating, vibration
  survival) is usually CTQ — its failure surfaces as a detectable malfunction
  before it becomes a harm path.
- Labelling is almost never CTS on its own — a label does not deliver therapy.
  Reserve CTS labelling for content whose absence directly causes a dosing or
  route error (e.g. a neuraxial wrong-route warning).
- RISK follows the same consequence-of-failure logic (High/Medium/Low), judged
  independently of class: a CTS requirement with strong upstream mitigations can
  be Medium; a CTQ requirement gating therapy availability can be High.
- CONFIDENCE: High = the statement alone decides it under this rubric.
  Medium = decided, but a reasonable reviewer could argue. Low = the decision
  depends on design context the statement does not carry — flag for SME review.
"""

# Compliance approaches that name a real verification activity. The failure mode
# this prevents is "compliance approach: comply with the standard", which reads
# as filler to the DHF reviewer the document is written for.
COMPLIANCE_METHODS = """\
COMPLIANCE APPROACH — name a REAL verification activity, never a restatement of the
requirement. Draw from: gravimetric flow-accuracy / trumpet-curve testing per
IEC 60601-2-24; simulated upstream and downstream occlusion testing at the stated
pressure thresholds; calibrated air-bolus injection testing; free-flow protection
test; single-fault injection testing; accredited-laboratory IEC 60601-1 /
-1-2 EMC test report; environmental chamber re-test across temperature, humidity
and barometric pressure; battery run-down and IEC 62133-2 cell certification;
formative and summative usability studies per IEC 62366-1; static analysis and
unit/integration testing per IEC 62304 with traceable protocol IDs; penetration
testing and SBOM review per FD&C §524B; label print-durability and accelerated
ageing tests; symbol-conformance inspection against ISO 15223-1:2021; GUDID
submission and barcode verification; design-review and traceability audit.
"""


def base_grounding() -> str:
    """Grounding applied to every run."""
    return "\n".join([STANDARDS, BENCHMARKS, KNOWN_GAPS])


def matrix_grounding(doc_type: str) -> str:
    """Grounding for compliance-matrix enrichment.

    Deliberately narrower than `base_grounding()`: enrichment annotates
    requirements that already exist, so the gap catalogue is noise here, while
    the citable-standards whitelist and the verification-method list are what
    keep the five generated columns defensible.
    """
    blocks = [STANDARDS_WHITELIST, COMPLIANCE_METHODS, BENCHMARKS]
    if doc_type == "labeling":
        blocks.append(
            "LABELLING NOTE: labelling requirements are almost never High risk on "
            "their own — a label does not deliver therapy. Use Low for symbol, "
            "identifier and legibility items and Medium where the labelling carries "
            "a safety warning, a contraindication or dosing information the user "
            "depends on. Reserve High for a labelling failure that would directly "
            "cause patient harm, which is rare."
        )
    if doc_type == "software":
        blocks.append(
            "SOFTWARE SAFETY CLASSIFICATION (IEC 62304): assign Class C where a "
            "software failure could lead to death or serious injury — dosing and "
            "delivery control, dose-limit enforcement, alarm generation, safe-state "
            "transition, sensor-driven protection. Class B where failure could cause "
            "non-serious injury — monitoring, logging with clinical relevance, "
            "connectivity affecting therapy indirectly. Class A for support functions "
            "with no injury path — diagnostics reporting, configuration display."
        )
    return "\n".join(blocks)


def classification_grounding() -> str:
    """Grounding for the dedicated CTS/CTQ classification pass.

    The rubric carries the decision logic; the whitelist keeps citations
    checkable; the benchmarks keep boundary-condition thresholds real.
    """
    return "\n".join([CLASSIFICATION_RUBRIC, STANDARDS_WHITELIST, BENCHMARKS])


def concept_grounding(concept: str) -> str:
    """Extra grounding selected by concept keywords.

    Only PIEB/PCA/epidural has curated research behind it today. Anything else
    falls back to the base grounding rather than inventing domain facts.
    """
    lowered = concept.lower()
    triggers = ("pieb", "epidural", "pcea", "pca", "bolus", "analgesia")
    if any(t in lowered for t in triggers):
        return PIEB + "\n" + FDA_HISTORY
    return FDA_HISTORY
