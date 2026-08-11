// Mock data — realistic, spec-aligned. Used to drive every screen.
// Replace with live API calls when backend lands.

export type ProgramId = "aeris-v500" | "portis-pump" | "vitalus-monitor";

export interface Program {
  id: ProgramId;
  name: string;
  subtitle: string;
  stage: string;
  maturity: number; // 0-100
  requirements: number;
  standards: number;
  coverage: number;
  bomParts: number;
  savingsPerUnit: number;
  swReqs: number;
  hwReqs: number;
}

export const programs: Program[] = [
  {
    id: "aeris-v500",
    name: "Aeris V500",
    subtitle: "Critical-Care Ventilator",
    stage: "Verification",
    maturity: 85,
    requirements: 428,
    standards: 10,
    coverage: 87,
    bomParts: 342,
    savingsPerUnit: 218,
    swReqs: 236,
    hwReqs: 192,
  },
  {
    id: "portis-pump",
    name: "Portis P200",
    subtitle: "Portable Infusion Pump",
    stage: "Decomposition",
    maturity: 20,
    requirements: 96,
    standards: 4,
    coverage: 12,
    bomParts: 74,
    savingsPerUnit: 41,
    swReqs: 48,
    hwReqs: 48,
  },
  {
    id: "vitalus-monitor",
    name: "Vitalus M12",
    subtitle: "Patient Monitor (Sustaining)",
    stage: "Sustaining",
    maturity: 98,
    requirements: 512,
    standards: 12,
    coverage: 99,
    bomParts: 287,
    savingsPerUnit: 164,
    swReqs: 301,
    hwReqs: 211,
  },
];

export const coverageTrend = [
  { week: "W-12", unit: 41, integ: 22, system: 8 },
  { week: "W-10", unit: 49, integ: 31, system: 14 },
  { week: "W-8", unit: 58, integ: 42, system: 22 },
  { week: "W-6", unit: 66, integ: 51, system: 30 },
  { week: "W-4", unit: 74, integ: 60, system: 41 },
  { week: "W-2", unit: 82, integ: 70, system: 55 },
  { week: "Now", unit: 91, integ: 82, system: 68 },
];

export const complianceReadiness = [
  { month: "Jan", weighted: 42 },
  { month: "Feb", weighted: 51 },
  { month: "Mar", weighted: 58 },
  { month: "Apr", weighted: 66 },
  { month: "May", weighted: 74 },
  { month: "Jun", weighted: 81 },
  { month: "Jul", weighted: 87 },
];

export const workflowStages = [
  { name: "Decompose", pct: 100 },
  { name: "Classify", pct: 96 },
  { name: "Map compliance", pct: 91 },
  { name: "Generate tests", pct: 84 },
  { name: "Optimize BOM", pct: 72 },
];

export interface AgentEvent {
  id: string;
  time: string;
  actor: "agent" | "human";
  actorName: string;
  message: string;
  entity?: string;
  severity?: "info" | "warn" | "critical" | "success";
}

export const agentActivity: AgentEvent[] = [
  {
    id: "e1",
    time: "2 min ago",
    actor: "agent",
    actorName: "Requirement→Test Generator",
    message: "Generated 14 proposed test cases for HW-221 (blower drive)",
    entity: "HW-221",
    severity: "info",
  },
  {
    id: "e2",
    time: "6 min ago",
    actor: "agent",
    actorName: "Verification Runner",
    message: "TC-08840 apnea backup timing FAILED — 4.2s vs BC-06 threshold 4.0s",
    entity: "REQ-1058",
    severity: "critical",
  },
  {
    id: "e3",
    time: "18 min ago",
    actor: "human",
    actorName: "L. Okafor · Compliance Lead",
    message: "Approved 3 boundary conditions for IEC 81001-5-1",
    severity: "success",
  },
  {
    id: "e4",
    time: "34 min ago",
    actor: "agent",
    actorName: "CTS/CTQ Classifier (Beta)",
    message: "Proposed CTS classification for 7 requirements — awaiting review",
    severity: "warn",
  },
  {
    id: "e5",
    time: "1 h ago",
    actor: "agent",
    actorName: "Alternate-Vendor Agent",
    message: "Identified qualified alternate for SEN-O2-G1 (City Tech → Sensirion)",
    entity: "SEN-O2-G1",
    severity: "info",
  },
  {
    id: "e6",
    time: "2 h ago",
    actor: "human",
    actorName: "M. Chen · Test Engineer",
    message: "Overrode classification on REQ-0431 (CTQ → CTS) with rationale",
    severity: "success",
  },
];

export const standards = [
  {
    id: "IEC 60601-1",
    body: "IEC",
    category: "Safety",
    coverage: 96,
    reqs: 118,
    status: "Aligned",
  },
  { id: "IEC 60601-1-2", body: "IEC", category: "EMC", coverage: 92, reqs: 41, status: "Aligned" },
  { id: "IEC 62304", body: "IEC", category: "Software", coverage: 91, reqs: 82, status: "Aligned" },
  { id: "IEC 81001-5-1", body: "IEC", category: "Cyber", coverage: 78, reqs: 26, status: "Gap" },
  { id: "ISO 14971", body: "ISO", category: "Risk", coverage: 94, reqs: 63, status: "Aligned" },
  { id: "ISO 13485", body: "ISO", category: "Quality", coverage: 89, reqs: 48, status: "Partial" },
  {
    id: "IEC 62366-1",
    body: "IEC",
    category: "Usability",
    coverage: 85,
    reqs: 22,
    status: "Partial",
  },
  {
    id: "ISO 80601-2-12",
    body: "ISO",
    category: "Safety",
    coverage: 93,
    reqs: 71,
    status: "Aligned",
  },
  {
    id: "FDA 21 CFR 820",
    body: "FDA",
    category: "Quality",
    coverage: 88,
    reqs: 44,
    status: "Partial",
  },
  {
    id: "MDR 2017/745",
    body: "EU",
    category: "Regulatory",
    coverage: 82,
    reqs: 39,
    status: "Partial",
  },
];

export const radarCoverage = [
  { area: "Safety", current: 94, target: 98 },
  { area: "Software", current: 91, target: 95 },
  { area: "Risk", current: 94, target: 96 },
  { area: "Quality", current: 88, target: 95 },
  { area: "Usability", current: 85, target: 92 },
  { area: "Cyber", current: 78, target: 90 },
];

export const boundaryConditions = [
  {
    id: "BC-01",
    parameter: "Tidal volume accuracy",
    threshold: "±4%",
    drives: "CTS",
    reqs: 12,
    source: "ISO 80601-2-12 §201.12.4.101",
  },
  {
    id: "BC-02",
    parameter: "Peak pressure clamp",
    threshold: "≤ 60 cmH2O",
    drives: "CTS",
    reqs: 8,
    source: "ISO 80601-2-12 §201.12.4.108",
  },
  {
    id: "BC-03",
    parameter: "FiO2 delivery accuracy",
    threshold: "±3% abs",
    drives: "CTS",
    reqs: 6,
    source: "ISO 80601-2-12 §201.12.4.103",
  },
  {
    id: "BC-04",
    parameter: "Alarm audibility (bed)",
    threshold: "≥ 65 dBA @ 1m",
    drives: "CTQ",
    reqs: 5,
    source: "IEC 60601-1-8",
  },
  {
    id: "BC-05",
    parameter: "Battery runtime (transport)",
    threshold: "≥ 45 min",
    drives: "CTQ",
    reqs: 4,
    source: "Benchmark (Hamilton C6)",
  },
  {
    id: "BC-06",
    parameter: "Apnea backup ventilation start",
    threshold: "≤ 4.0 s",
    drives: "CTS",
    reqs: 3,
    source: "ISO 80601-2-12 §201.12.1.103",
  },
  {
    id: "BC-07",
    parameter: "PEEP stability window",
    threshold: "±1 cmH2O",
    drives: "CTQ",
    reqs: 7,
    source: "Benchmark (Dräger Evita)",
  },
  {
    id: "BC-08",
    parameter: "SW cybersecurity update SLA",
    threshold: "≤ 30 days",
    drives: "CTS",
    reqs: 6,
    source: "IEC 81001-5-1 §5.2",
  },
  {
    id: "BC-09",
    parameter: "Trigger response latency",
    threshold: "≤ 100 ms",
    drives: "CTS",
    reqs: 5,
    source: "ISO 80601-2-12 §201.12.4.107",
  },
  {
    id: "BC-10",
    parameter: "Humidifier reach temp",
    threshold: "≥ 37°C in 15 min",
    drives: "CTQ",
    reqs: 4,
    source: "ISO 8185",
  },
];

export interface Requirement {
  id: string;
  statement: string;
  domain: "SW" | "HW";
  class: "CTS" | "CTQ" | "Standard";
  risk: "High" | "Medium" | "Low";
  standard: string;
  bc: string;
  coverage: number;
  result: "Pass" | "Fail" | "Running" | "Pending";
}

export const requirements: Requirement[] = [
  {
    id: "REQ-1058",
    statement: "System shall deliver backup ventilation within 4.0s of apnea detection",
    domain: "SW",
    class: "CTS",
    risk: "High",
    standard: "ISO 80601-2-12",
    bc: "BC-06",
    coverage: 100,
    result: "Fail",
  },
  {
    id: "REQ-1042",
    statement: "Blower shall achieve setpoint pressure within ±2 cmH2O",
    domain: "HW",
    class: "CTS",
    risk: "High",
    standard: "ISO 80601-2-12",
    bc: "BC-02",
    coverage: 100,
    result: "Pass",
  },
  {
    id: "REQ-1103",
    statement: "FiO2 sensor drift shall not exceed 1% / 24h",
    domain: "HW",
    class: "CTS",
    risk: "High",
    standard: "ISO 80601-2-12",
    bc: "BC-03",
    coverage: 100,
    result: "Pass",
  },
  {
    id: "REQ-2201",
    statement: "Alarm shall be audible ≥ 65 dBA at 1m distance",
    domain: "HW",
    class: "CTQ",
    risk: "Medium",
    standard: "IEC 60601-1-8",
    bc: "BC-04",
    coverage: 100,
    result: "Pass",
  },
  {
    id: "REQ-3009",
    statement: "Battery shall provide ≥ 45 min transport runtime at nominal load",
    domain: "HW",
    class: "CTQ",
    risk: "Medium",
    standard: "Benchmark",
    bc: "BC-05",
    coverage: 100,
    result: "Pass",
  },
  {
    id: "REQ-1120",
    statement: "UI shall lock ventilation params during patient session unless unlocked",
    domain: "SW",
    class: "CTS",
    risk: "High",
    standard: "IEC 62366-1",
    bc: "BC-08",
    coverage: 92,
    result: "Running",
  },
  {
    id: "REQ-1131",
    statement: "Security patches shall be applied within 30 days of release",
    domain: "SW",
    class: "CTS",
    risk: "High",
    standard: "IEC 81001-5-1",
    bc: "BC-08",
    coverage: 66,
    result: "Pending",
  },
  {
    id: "REQ-0431",
    statement: "System shall log every parameter change with timestamp and user",
    domain: "SW",
    class: "CTS",
    risk: "High",
    standard: "FDA 21 CFR Part 11",
    bc: "—",
    coverage: 100,
    result: "Pass",
  },
  {
    id: "REQ-2145",
    statement: "Trigger sensitivity response ≤ 100 ms",
    domain: "SW",
    class: "CTS",
    risk: "High",
    standard: "ISO 80601-2-12",
    bc: "BC-09",
    coverage: 100,
    result: "Pass",
  },
  {
    id: "REQ-3140",
    statement: "PEEP shall be maintained within ±1 cmH2O across cycles",
    domain: "HW",
    class: "CTQ",
    risk: "Medium",
    standard: "Benchmark",
    bc: "BC-07",
    coverage: 88,
    result: "Running",
  },
  {
    id: "REQ-4020",
    statement: "Humidifier shall reach 37°C within 15 min from cold start",
    domain: "HW",
    class: "CTQ",
    risk: "Low",
    standard: "ISO 8185",
    bc: "BC-10",
    coverage: 100,
    result: "Pass",
  },
  {
    id: "REQ-4051",
    statement: "Touchscreen shall register input within 80 ms",
    domain: "HW",
    class: "CTQ",
    risk: "Low",
    standard: "Benchmark",
    bc: "—",
    coverage: 100,
    result: "Pass",
  },
];

// `LBL` (labelling & IFU) and level 5 exist for generated breakdowns, which
// decompose System → Domain → Module → Element → Unit. The pre-authored mock
// trees below only use SW/HW/SYS and levels 1-4.
export interface BreakdownNode {
  id: string;
  name: string;
  domain: "SW" | "HW" | "LBL" | "SYS";
  level: 1 | 2 | 3 | 4 | 5;
  reqs: number;
  classification?: "CTS" | "CTQ" | "Standard";
  children?: BreakdownNode[];
}

export const breakdown: BreakdownNode = {
  id: "SYS-0",
  name: "Aeris V500 System",
  domain: "SYS",
  level: 1,
  reqs: 428,
  children: [
    {
      id: "SW-0",
      name: "Ventilation Software Stack",
      domain: "SW",
      level: 2,
      reqs: 236,
      children: [
        {
          id: "SW-100",
          name: "Breath control loop",
          domain: "SW",
          level: 3,
          reqs: 72,
          classification: "CTS",
        },
        {
          id: "SW-120",
          name: "Alarms & monitoring",
          domain: "SW",
          level: 3,
          reqs: 58,
          classification: "CTS",
          children: [
            {
              id: "SW-122",
              name: "Apnea detection service",
              domain: "SW",
              level: 4,
              reqs: 14,
              classification: "CTS",
            },
            {
              id: "SW-124",
              name: "Priority alarm queue",
              domain: "SW",
              level: 4,
              reqs: 12,
              classification: "CTS",
            },
          ],
        },
        {
          id: "SW-140",
          name: "Clinician UI",
          domain: "SW",
          level: 3,
          reqs: 61,
          classification: "CTQ",
        },
        {
          id: "SW-160",
          name: "Cybersecurity services",
          domain: "SW",
          level: 3,
          reqs: 45,
          classification: "CTS",
        },
      ],
    },
    {
      id: "HW-0",
      name: "Ventilator Hardware",
      domain: "HW",
      level: 2,
      reqs: 192,
      children: [
        {
          id: "HW-200",
          name: "Pneumatic subsystem",
          domain: "HW",
          level: 3,
          reqs: 84,
          classification: "CTS",
          children: [
            {
              id: "HW-221",
              name: "Blower drive assembly",
              domain: "HW",
              level: 4,
              reqs: 22,
              classification: "CTS",
            },
            {
              id: "HW-232",
              name: "Inspiratory valve",
              domain: "HW",
              level: 4,
              reqs: 18,
              classification: "CTS",
            },
            {
              id: "HW-241",
              name: "Expiratory flow sensor",
              domain: "HW",
              level: 4,
              reqs: 14,
              classification: "CTS",
            },
          ],
        },
        {
          id: "HW-300",
          name: "Control PCBA",
          domain: "HW",
          level: 3,
          reqs: 54,
          classification: "CTS",
          children: [
            {
              id: "HW-311",
              name: "MCU + safety co-processor",
              domain: "HW",
              level: 4,
              reqs: 20,
              classification: "CTS",
            },
            {
              id: "HW-322",
              name: "Power management IC",
              domain: "HW",
              level: 4,
              reqs: 12,
              classification: "CTQ",
            },
          ],
        },
        {
          id: "HW-400",
          name: "Enclosure & mounts",
          domain: "HW",
          level: 3,
          reqs: 24,
          classification: "Standard",
        },
        {
          id: "HW-500",
          name: "Battery pack",
          domain: "HW",
          level: 3,
          reqs: 30,
          classification: "CTQ",
        },
      ],
    },
  ],
};

export interface BomLine {
  id: string;
  part: string;
  vendor: string;
  alternates: number;
  unitCost: number;
  leadTime: string;
  risk: "Low" | "Medium" | "High";
  failureEffect: string;
  saving: number;
  cts: boolean;
}

export const bom: BomLine[] = [
  {
    id: "MTR-BLW-01",
    part: "Brushless blower motor 24V",
    vendor: "Nidec Copal",
    alternates: 2,
    unitCost: 184.5,
    leadTime: "8 wk",
    risk: "Medium",
    failureEffect: "Loss of ventilation",
    saving: 22.0,
    cts: true,
  },
  {
    id: "VLV-INS-02",
    part: "Proportional inspiratory valve",
    vendor: "IMI Norgren",
    alternates: 1,
    unitCost: 96.2,
    leadTime: "12 wk",
    risk: "High",
    failureEffect: "Pressure runaway",
    saving: 8.4,
    cts: true,
  },
  {
    id: "SEN-FLO-03",
    part: "Bidirectional flow sensor",
    vendor: "Sensirion",
    alternates: 2,
    unitCost: 78.0,
    leadTime: "6 wk",
    risk: "Low",
    failureEffect: "Volume miscalc",
    saving: 12.5,
    cts: true,
  },
  {
    id: "SEN-O2-G1",
    part: "Galvanic O2 sensor",
    vendor: "City Tech",
    alternates: 3,
    unitCost: 34.0,
    leadTime: "4 wk",
    risk: "Low",
    failureEffect: "FiO2 misread",
    saving: 6.8,
    cts: true,
  },
  {
    id: "MCU-STM-01",
    part: "MCU STM32H7",
    vendor: "STMicro",
    alternates: 1,
    unitCost: 12.4,
    leadTime: "20 wk",
    risk: "High",
    failureEffect: "Control loss",
    saving: 0,
    cts: true,
  },
  {
    id: "PMI-TI-01",
    part: "Power management IC",
    vendor: "Texas Instruments",
    alternates: 2,
    unitCost: 6.2,
    leadTime: "10 wk",
    risk: "Medium",
    failureEffect: "Reset",
    saving: 1.1,
    cts: false,
  },
  {
    id: "BAT-LI-01",
    part: "Li-ion pack 6S 5Ah",
    vendor: "Inspired Energy",
    alternates: 2,
    unitCost: 142.0,
    leadTime: "8 wk",
    risk: "Medium",
    failureEffect: "Runtime loss",
    saving: 18.0,
    cts: false,
  },
  {
    id: "DIS-TFT-01",
    part: '10.1" TFT display',
    vendor: "AUO",
    alternates: 3,
    unitCost: 58.4,
    leadTime: "6 wk",
    risk: "Low",
    failureEffect: "UI loss",
    saving: 9.2,
    cts: false,
  },
  {
    id: "PSU-MW-01",
    part: "Medical PSU 150W",
    vendor: "Mean Well",
    alternates: 2,
    unitCost: 84.0,
    leadTime: "6 wk",
    risk: "Low",
    failureEffect: "Mains loss",
    saving: 7.3,
    cts: false,
  },
  {
    id: "HUM-FP-01",
    part: "Heated humidifier module",
    vendor: "Fisher & Paykel",
    alternates: 1,
    unitCost: 210.0,
    leadTime: "10 wk",
    risk: "Medium",
    failureEffect: "Circuit dry",
    saving: 14.0,
    cts: false,
  },
];

export const costBySubsystem = [
  { name: "Pneumatic", value: 412 },
  { name: "Control PCBA", value: 186 },
  { name: "Power / Battery", value: 232 },
  { name: "Display / UI", value: 118 },
  { name: "Enclosure", value: 74 },
  { name: "Humidification", value: 210 },
];

export interface AgentDef {
  id: string;
  name: string;
  group: "Requirements" | "Verification" | "Hardware";
  status: "Ready" | "Beta" | "Planned";
  description: string;
  runs: number;
  successRate: number;
}

export const agents: AgentDef[] = [
  {
    id: "a1",
    name: "Product Decomposition",
    group: "Requirements",
    status: "Ready",
    description: "Decomposes product scope into SW/HW/SYS breakdown tree to part level.",
    runs: 214,
    successRate: 98,
  },
  {
    id: "a2",
    name: "Compliance Mapper",
    group: "Requirements",
    status: "Ready",
    description: "Maps requirements to standards clauses; derives boundary conditions.",
    runs: 341,
    successRate: 96,
  },
  {
    id: "a3",
    name: "CTS/CTQ Classifier",
    group: "Requirements",
    status: "Beta",
    description: "Classifies each requirement per boundary conditions and risk profile.",
    runs: 178,
    successRate: 87,
  },
  {
    id: "a4",
    name: "SRS Generator",
    group: "Verification",
    status: "Beta",
    description: "Drafts SRS sections from approved requirements and standards.",
    runs: 62,
    successRate: 84,
  },
  {
    id: "a5",
    name: "Requirement→Test Generator",
    group: "Verification",
    status: "Ready",
    description: "Produces unit/integration/system test cases per requirement.",
    runs: 502,
    successRate: 95,
  },
  {
    id: "a6",
    name: "Coverage & Traceability Analyzer",
    group: "Verification",
    status: "Ready",
    description: "Recomputes V-model coverage and traceability spine live.",
    runs: 1240,
    successRate: 99,
  },
  {
    id: "a7",
    name: "BOM Agent",
    group: "Hardware",
    status: "Ready",
    description: "Generates BOM from HW breakdown and vendor catalogs.",
    runs: 138,
    successRate: 97,
  },
  {
    id: "a8",
    name: "Price Optimization Agent",
    group: "Hardware",
    status: "Ready",
    description: "Identifies unit-cost savings without touching CTS-flagged parts.",
    runs: 96,
    successRate: 94,
  },
  {
    id: "a9",
    name: "Alternate-Vendor Agent",
    group: "Hardware",
    status: "Ready",
    description: "Qualifies second sources per part with lead-time and risk deltas.",
    runs: 88,
    successRate: 92,
  },
  {
    id: "a10",
    name: "Design-Review Composer",
    group: "Verification",
    status: "Planned",
    description: "Assembles design-review packet from live traceability data.",
    runs: 0,
    successRate: 0,
  },
];

export interface AgentRun {
  id: string;
  agent: string;
  triggeredBy: string;
  scope: string;
  status: "queued" | "running" | "succeeded" | "failed" | "needs-approval";
  duration: string;
  when: string;
}

export const agentRuns: AgentRun[] = [
  {
    id: "run-8842",
    agent: "Requirement→Test Generator",
    triggeredBy: "M. Chen",
    scope: "HW-221 subtree",
    status: "running",
    duration: "01:24",
    when: "2 min ago",
  },
  {
    id: "run-8841",
    agent: "CTS/CTQ Classifier",
    triggeredBy: "event: BC-06 approved",
    scope: "12 requirements",
    status: "needs-approval",
    duration: "00:52",
    when: "12 min ago",
  },
  {
    id: "run-8840",
    agent: "Verification Runner",
    triggeredBy: "schedule: nightly",
    scope: "SW-120",
    status: "failed",
    duration: "03:11",
    when: "34 min ago",
  },
  {
    id: "run-8839",
    agent: "Compliance Mapper",
    triggeredBy: "event: new standard",
    scope: "IEC 81001-5-1",
    status: "succeeded",
    duration: "02:04",
    when: "1 h ago",
  },
  {
    id: "run-8838",
    agent: "Alternate-Vendor Agent",
    triggeredBy: "S. Patel",
    scope: "SEN-O2-G1",
    status: "succeeded",
    duration: "00:41",
    when: "1 h ago",
  },
  {
    id: "run-8837",
    agent: "BOM Agent",
    triggeredBy: "event: breakdown v3.2",
    scope: "HW-200 subtree",
    status: "succeeded",
    duration: "01:52",
    when: "2 h ago",
  },
  {
    id: "run-8836",
    agent: "SRS Generator",
    triggeredBy: "L. Okafor",
    scope: "SW-140",
    status: "queued",
    duration: "—",
    when: "2 h ago",
  },
  {
    id: "run-8835",
    agent: "Product Decomposition",
    triggeredBy: "R. Vasquez",
    scope: "Portis P200 root",
    status: "succeeded",
    duration: "04:22",
    when: "3 h ago",
  },
];

export interface Approval {
  id: string;
  kind:
    | "Classification override"
    | "Compliance mapping"
    | "Test case approval"
    | "SRS section"
    | "BOM change"
    | "Safety failure disposition";
  entity: string;
  proposal: string;
  by: string;
  when: string;
  priority: "High" | "Medium" | "Low";
}

export const approvals: Approval[] = [
  {
    id: "ap-1",
    kind: "Safety failure disposition",
    entity: "REQ-1058 · TC-08840",
    proposal: "Apnea backup 4.2s exceeds BC-06 4.0s threshold. Recommend retest with FW 2.3.1-rc3.",
    by: "Verification Runner",
    when: "34 min ago",
    priority: "High",
  },
  {
    id: "ap-2",
    kind: "Classification override",
    entity: "REQ-0431",
    proposal: "Reclassify CTQ → CTS (Part 11 audit trail is safety-adjacent).",
    by: "M. Chen · Test Engineer",
    when: "48 min ago",
    priority: "High",
  },
  {
    id: "ap-3",
    kind: "Compliance mapping",
    entity: "IEC 81001-5-1 → SW-160",
    proposal: "Auto-mapped 6 requirements under §5.2 patch SLA.",
    by: "Compliance Mapper",
    when: "1 h ago",
    priority: "Medium",
  },
  {
    id: "ap-4",
    kind: "Test case approval",
    entity: "HW-221 · 14 cases",
    proposal: "Generated cases covering blower drive envelope + edge current profile.",
    by: "Requirement→Test Generator",
    when: "2 min ago",
    priority: "Medium",
  },
  {
    id: "ap-5",
    kind: "SRS section",
    entity: "SRS §4.3 Alarms",
    proposal: "Drafted 22 pages covering IEC 60601-1-8 alarm categories.",
    by: "SRS Generator (Beta)",
    when: "3 h ago",
    priority: "Medium",
  },
  {
    id: "ap-6",
    kind: "BOM change",
    entity: "SEN-O2-G1",
    proposal: "Approve Sensirion as alternate to City Tech; unit −$3.20; lead −2 wk.",
    by: "Alternate-Vendor Agent",
    when: "1 h ago",
    priority: "Low",
  },
];

export interface AuditEntry {
  id: string;
  ts: string;
  user: string;
  role: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: string;
  after?: string;
}

export const auditTrail: AuditEntry[] = [
  {
    id: "au-1",
    ts: "2026-07-01 14:22:07Z",
    user: "M. Chen",
    role: "Test Engineer",
    action: "override",
    entityType: "Requirement",
    entityId: "REQ-0431",
    before: "CTQ",
    after: "CTS",
  },
  {
    id: "au-2",
    ts: "2026-07-01 14:04:11Z",
    user: "L. Okafor",
    role: "Compliance Lead",
    action: "approve",
    entityType: "BoundaryCondition",
    entityId: "BC-06",
    before: "proposed",
    after: "active",
  },
  {
    id: "au-3",
    ts: "2026-07-01 13:58:52Z",
    user: "system",
    role: "Verification Runner",
    action: "execute",
    entityType: "TestCase",
    entityId: "TC-08840",
    after: "fail",
  },
  {
    id: "au-4",
    ts: "2026-07-01 13:41:19Z",
    user: "S. Patel",
    role: "Hardware Engineer",
    action: "approve-alternate",
    entityType: "Part",
    entityId: "SEN-O2-G1",
    before: "City Tech",
    after: "Sensirion",
  },
  {
    id: "au-5",
    ts: "2026-07-01 12:12:04Z",
    user: "R. Vasquez",
    role: "Systems Engineer",
    action: "trigger-agent",
    entityType: "AgentRun",
    entityId: "run-8835",
    after: "queued",
  },
  {
    id: "au-6",
    ts: "2026-07-01 11:55:00Z",
    user: "A. Bermejo",
    role: "Program Manager",
    action: "generate-export",
    entityType: "Report",
    entityId: "DHF-2026-07-01",
    after: "generated",
  },
  {
    id: "au-7",
    ts: "2026-07-01 10:32:44Z",
    user: "L. Okafor",
    role: "Compliance Lead",
    action: "edit",
    entityType: "Standard",
    entityId: "IEC 81001-5-1",
    before: "coverage 74%",
    after: "coverage 78%",
  },
  {
    id: "au-8",
    ts: "2026-07-01 09:12:20Z",
    user: "system",
    role: "Compliance Mapper",
    action: "propose",
    entityType: "Mapping",
    entityId: "IEC 81001-5-1→SW-160",
    after: "pending",
  },
];

export const integrations = [
  {
    name: "Windchill (PLM)",
    vendor: "PTC",
    status: "Active",
    lastSync: "3 min ago",
    records: 1284,
    sync: "real-time",
  },
  {
    name: "Polarion (ALM)",
    vendor: "Siemens",
    status: "Active",
    lastSync: "8 min ago",
    records: 4218,
    sync: "real-time",
  },
  {
    name: "SAP S/4HANA (ERP)",
    vendor: "SAP",
    status: "Degraded",
    lastSync: "42 min ago",
    records: 812,
    sync: "scheduled",
  },
  {
    name: "DocuSign (e-Signature)",
    vendor: "DocuSign",
    status: "Active",
    lastSync: "12 min ago",
    records: 96,
    sync: "real-time",
  },
  {
    name: "Jira Test Rig",
    vendor: "Atlassian",
    status: "Active",
    lastSync: "6 min ago",
    records: 2140,
    sync: "real-time",
  },
  {
    name: "SES Email Gateway",
    vendor: "AWS",
    status: "Active",
    lastSync: "1 min ago",
    records: 3082,
    sync: "real-time",
  },
];

export const users = [
  {
    name: "R. Vasquez",
    role: "Systems Engineer",
    programs: ["Aeris V500", "Portis P200"],
    last: "12 min ago",
  },
  {
    name: "L. Okafor",
    role: "Compliance Lead",
    programs: ["Aeris V500", "Vitalus M12"],
    last: "3 min ago",
  },
  { name: "M. Chen", role: "Test Engineer", programs: ["Aeris V500"], last: "just now" },
  {
    name: "S. Patel",
    role: "Hardware Engineer",
    programs: ["Aeris V500", "Portis P200"],
    last: "1 h ago",
  },
  {
    name: "A. Bermejo",
    role: "Program Manager",
    programs: ["Aeris V500", "Portis P200", "Vitalus M12"],
    last: "24 min ago",
  },
  { name: "K. Novak", role: "Admin", programs: ["All"], last: "2 h ago" },
];

export const notifications = [
  {
    id: "n1",
    text: "TC-08840 failed — REQ-1058 disposition required",
    severity: "critical",
    when: "34 min ago",
  },
  {
    id: "n2",
    text: "6 items pending in your Approvals Queue",
    severity: "warn",
    when: "12 min ago",
  },
  { id: "n3", text: "SAP S/4HANA sync degraded — retrying", severity: "warn", when: "42 min ago" },
  { id: "n4", text: "DHF export completed", severity: "info", when: "1 h ago" },
];

// ── Scope intake → auto breakdown ────────────────────────────────────────────
// Drives the "New Breakdown" page. Generation is simulated: the uploaded scope
// file's contents are NOT parsed. `scopeIngestStages` labels the fake progress
// animation; `generatedBreakdown` is the pre-authored tree revealed afterward.
// `sampleScopeDoc` is the single source for both the "Download sample" action and
// the in-app format preview.

export const scopeIngestStages = [
  "Parsing requirements",
  "Identifying subsystems",
  "Splitting hardware / software",
  "Classifying CTS / CTQ",
  "Finalizing decomposition",
];

export const sampleScopeDoc = `# Product Scope — Aeris V500 Critical-Care Ventilator
Program: Aeris V500 · Doc v1.0 · Author: A. Bermejo · 2026-07-02

## 1. Intended Use & Indications
Invasive and non-invasive ventilation for adult and pediatric patients in
critical-care and intra-hospital transport settings.

## 2. Operating Environment & Users
Hospital ICU, ED, and transport. Primary users: respiratory therapists,
intensivists, nurses. Line + battery powered; -20…50 °C transport range.

## 3. Regulatory Context
Device class: IIb (EU MDR) / Class II (FDA). Target markets: US, EU.
Governing standards: ISO 80601-2-12, IEC 60601-1-8, IEC 62366-1,
IEC 81001-5-1, ISO 8185, FDA 21 CFR Part 11.

## 4. Performance Targets
| Parameter                     | Target            |
|-------------------------------|-------------------|
| Backup ventilation on apnea   | ≤ 4.0 s           |
| Pressure setpoint accuracy    | ± 2 cmH₂O         |
| Trigger response              | ≤ 100 ms          |
| Transport battery runtime     | ≥ 45 min          |
| Alarm loudness                | ≥ 65 dBA @ 1 m    |

## 5. Functional Capabilities (software)
- Closed-loop breath control (volume/pressure modes)
- Alarms & monitoring — apnea detection, prioritized alarm queue
- Clinician touchscreen UI with session parameter locking
- Cybersecurity services — audit logging, patch management

## 6. Physical & Hardware Constraints
- Pneumatic delivery: blower, inspiratory valve, expiratory flow sensor
- Control PCBA: safety co-processor, power management
- Enclosure & mounts (transport-rated), heated humidifier
- Internal battery pack for ≥ 45 min transport

## 7. Interfaces
HL7/EMR export, nurse-call relay, USB service port, Wi-Fi (WPA2-Ent).

## 8. Constraints & Targets
BOM cost target: ≤ $2,050/unit · savings target $246/unit · first ship Q4.

## 9. Out of Scope / Assumptions
Neonatal ventilation, disposable circuit manufacturing, cloud analytics.
`;

// Pre-authored decomposition revealed after the simulated analysis. Mirrors the
// scope doc: §5 → software subtree, §6 → hardware subtree. Uses GEN-* ids so it
// reads as a fresh generation rather than a copy of `breakdown`.
export const generatedBreakdown: BreakdownNode = {
  id: "GEN-SYS-0",
  name: "Aeris V500 System",
  domain: "SYS",
  level: 1,
  reqs: 431,
  children: [
    {
      id: "GEN-SW-0",
      name: "Ventilation Software Stack",
      domain: "SW",
      level: 2,
      reqs: 238,
      children: [
        {
          id: "GEN-SW-100",
          name: "Breath control loop",
          domain: "SW",
          level: 3,
          reqs: 74,
          classification: "CTS",
          children: [
            {
              id: "GEN-SW-102",
              name: "Volume-control mode",
              domain: "SW",
              level: 4,
              reqs: 26,
              classification: "CTS",
            },
            {
              id: "GEN-SW-104",
              name: "Pressure-control mode",
              domain: "SW",
              level: 4,
              reqs: 24,
              classification: "CTS",
            },
          ],
        },
        {
          id: "GEN-SW-120",
          name: "Alarms & monitoring",
          domain: "SW",
          level: 3,
          reqs: 60,
          classification: "CTS",
          children: [
            {
              id: "GEN-SW-122",
              name: "Apnea detection service",
              domain: "SW",
              level: 4,
              reqs: 15,
              classification: "CTS",
            },
            {
              id: "GEN-SW-124",
              name: "Priority alarm queue",
              domain: "SW",
              level: 4,
              reqs: 13,
              classification: "CTS",
            },
          ],
        },
        {
          id: "GEN-SW-140",
          name: "Clinician touchscreen UI",
          domain: "SW",
          level: 3,
          reqs: 59,
          classification: "CTQ",
        },
        {
          id: "GEN-SW-160",
          name: "Cybersecurity services",
          domain: "SW",
          level: 3,
          reqs: 45,
          classification: "CTS",
        },
      ],
    },
    {
      id: "GEN-HW-0",
      name: "Ventilator Hardware",
      domain: "HW",
      level: 2,
      reqs: 193,
      children: [
        {
          id: "GEN-HW-200",
          name: "Pneumatic delivery subsystem",
          domain: "HW",
          level: 3,
          reqs: 86,
          classification: "CTS",
          children: [
            {
              id: "GEN-HW-221",
              name: "Blower drive assembly",
              domain: "HW",
              level: 4,
              reqs: 22,
              classification: "CTS",
            },
            {
              id: "GEN-HW-232",
              name: "Inspiratory valve",
              domain: "HW",
              level: 4,
              reqs: 18,
              classification: "CTS",
            },
            {
              id: "GEN-HW-241",
              name: "Expiratory flow sensor",
              domain: "HW",
              level: 4,
              reqs: 15,
              classification: "CTS",
            },
          ],
        },
        {
          id: "GEN-HW-300",
          name: "Control PCBA",
          domain: "HW",
          level: 3,
          reqs: 53,
          classification: "CTS",
          children: [
            {
              id: "GEN-HW-311",
              name: "MCU + safety co-processor",
              domain: "HW",
              level: 4,
              reqs: 20,
              classification: "CTS",
            },
            {
              id: "GEN-HW-322",
              name: "Power management IC",
              domain: "HW",
              level: 4,
              reqs: 12,
              classification: "CTQ",
            },
          ],
        },
        {
          id: "GEN-HW-400",
          name: "Enclosure & transport mounts",
          domain: "HW",
          level: 3,
          reqs: 24,
          classification: "Standard",
        },
        {
          id: "GEN-HW-500",
          name: "Heated humidifier module",
          domain: "HW",
          level: 3,
          reqs: 12,
          classification: "CTQ",
        },
        {
          id: "GEN-HW-600",
          name: "Internal battery pack",
          domain: "HW",
          level: 3,
          reqs: 18,
          classification: "CTQ",
        },
      ],
    },
  ],
};
