"""Program context fed to the agents.

Mirrors the subset of `src/lib/mock-data.ts` the agents need so their output is
grounded in the same Aeris V500 program the UI shows. Kept as plain dicts and
rendered to compact text blocks that get injected into prompts.
"""
from __future__ import annotations

import json

PROGRAM = {
    "id": "aeris-v500",
    "name": "Aeris V500",
    "subtitle": "Critical-Care Ventilator",
    "stage": "Verification",
    "requirements": 428,
    "swReqs": 236,
    "hwReqs": 192,
    "device_class": "IIb (EU MDR) / Class II (FDA)",
    "intended_use": (
        "Invasive and non-invasive ventilation for adult and pediatric patients in "
        "critical-care and intra-hospital transport settings."
    ),
}

REQUIREMENTS = [
    {"id": "REQ-1058", "statement": "System shall deliver backup ventilation within 4.0s of apnea detection", "domain": "SW", "class": "CTS", "risk": "High", "standard": "ISO 80601-2-12", "bc": "BC-06", "coverage": 100, "result": "Fail"},
    {"id": "REQ-1042", "statement": "Blower shall achieve setpoint pressure within ±2 cmH2O", "domain": "HW", "class": "CTS", "risk": "High", "standard": "ISO 80601-2-12", "bc": "BC-02", "coverage": 100, "result": "Pass"},
    {"id": "REQ-1103", "statement": "FiO2 sensor drift shall not exceed 1% / 24h", "domain": "HW", "class": "CTS", "risk": "High", "standard": "ISO 80601-2-12", "bc": "BC-03", "coverage": 100, "result": "Pass"},
    {"id": "REQ-2201", "statement": "Alarm shall be audible ≥ 65 dBA at 1m distance", "domain": "HW", "class": "CTQ", "risk": "Medium", "standard": "IEC 60601-1-8", "bc": "BC-04", "coverage": 100, "result": "Pass"},
    {"id": "REQ-3009", "statement": "Battery shall provide ≥ 45 min transport runtime at nominal load", "domain": "HW", "class": "CTQ", "risk": "Medium", "standard": "Benchmark", "bc": "BC-05", "coverage": 100, "result": "Pass"},
    {"id": "REQ-1120", "statement": "UI shall lock ventilation params during patient session unless unlocked", "domain": "SW", "class": "CTS", "risk": "High", "standard": "IEC 62366-1", "bc": "BC-08", "coverage": 92, "result": "Running"},
    {"id": "REQ-1131", "statement": "Security patches shall be applied within 30 days of release", "domain": "SW", "class": "CTS", "risk": "High", "standard": "IEC 81001-5-1", "bc": "BC-08", "coverage": 66, "result": "Pending"},
    {"id": "REQ-0431", "statement": "System shall log every parameter change with timestamp and user", "domain": "SW", "class": "CTS", "risk": "High", "standard": "FDA 21 CFR Part 11", "bc": "—", "coverage": 100, "result": "Pass"},
    {"id": "REQ-2145", "statement": "Trigger sensitivity response ≤ 100 ms", "domain": "SW", "class": "CTS", "risk": "High", "standard": "ISO 80601-2-12", "bc": "BC-09", "coverage": 100, "result": "Pass"},
    {"id": "REQ-3140", "statement": "PEEP shall be maintained within ±1 cmH2O across cycles", "domain": "HW", "class": "CTQ", "risk": "Medium", "standard": "Benchmark", "bc": "BC-07", "coverage": 88, "result": "Running"},
    {"id": "REQ-4020", "statement": "Humidifier shall reach 37°C within 15 min from cold start", "domain": "HW", "class": "CTQ", "risk": "Low", "standard": "ISO 8185", "bc": "BC-10", "coverage": 100, "result": "Pass"},
    {"id": "REQ-4051", "statement": "Touchscreen shall register input within 80 ms", "domain": "HW", "class": "CTQ", "risk": "Low", "standard": "Benchmark", "bc": "—", "coverage": 100, "result": "Pass"},
]

STANDARDS = [
    {"id": "IEC 60601-1", "category": "Safety", "coverage": 96, "status": "Aligned"},
    {"id": "IEC 60601-1-2", "category": "EMC", "coverage": 92, "status": "Aligned"},
    {"id": "IEC 62304", "category": "Software", "coverage": 91, "status": "Aligned"},
    {"id": "IEC 81001-5-1", "category": "Cyber", "coverage": 78, "status": "Gap"},
    {"id": "ISO 14971", "category": "Risk", "coverage": 94, "status": "Aligned"},
    {"id": "ISO 13485", "category": "Quality", "coverage": 89, "status": "Partial"},
    {"id": "IEC 62366-1", "category": "Usability", "coverage": 85, "status": "Partial"},
    {"id": "ISO 80601-2-12", "category": "Safety", "coverage": 93, "status": "Aligned"},
    {"id": "FDA 21 CFR 820", "category": "Quality", "coverage": 88, "status": "Partial"},
    {"id": "MDR 2017/745", "category": "Regulatory", "coverage": 82, "status": "Partial"},
]

BOUNDARY_CONDITIONS = [
    {"id": "BC-01", "parameter": "Tidal volume accuracy", "threshold": "±4%", "drives": "CTS", "source": "ISO 80601-2-12 §201.12.4.101"},
    {"id": "BC-02", "parameter": "Peak pressure clamp", "threshold": "≤ 60 cmH2O", "drives": "CTS", "source": "ISO 80601-2-12 §201.12.4.108"},
    {"id": "BC-03", "parameter": "FiO2 delivery accuracy", "threshold": "±3% abs", "drives": "CTS", "source": "ISO 80601-2-12 §201.12.4.103"},
    {"id": "BC-04", "parameter": "Alarm audibility (bed)", "threshold": "≥ 65 dBA @ 1m", "drives": "CTQ", "source": "IEC 60601-1-8"},
    {"id": "BC-05", "parameter": "Battery runtime (transport)", "threshold": "≥ 45 min", "drives": "CTQ", "source": "Benchmark (Hamilton C6)"},
    {"id": "BC-06", "parameter": "Apnea backup ventilation start", "threshold": "≤ 4.0 s", "drives": "CTS", "source": "ISO 80601-2-12 §201.12.1.103"},
    {"id": "BC-07", "parameter": "PEEP stability window", "threshold": "±1 cmH2O", "drives": "CTQ", "source": "Benchmark (Dräger Evita)"},
    {"id": "BC-08", "parameter": "SW cybersecurity update SLA", "threshold": "≤ 30 days", "drives": "CTS", "source": "IEC 81001-5-1 §5.2"},
    {"id": "BC-09", "parameter": "Trigger response latency", "threshold": "≤ 100 ms", "drives": "CTS", "source": "ISO 80601-2-12 §201.12.4.107"},
    {"id": "BC-10", "parameter": "Humidifier reach temp", "threshold": "≥ 37°C in 15 min", "drives": "CTQ", "source": "ISO 8185"},
]

# HW breakdown (subsystem → children), used by the BOM/decomposition agents.
HW_BREAKDOWN = {
    "Pneumatic subsystem": ["Blower drive assembly", "Inspiratory valve", "Expiratory flow sensor"],
    "Control PCBA": ["MCU + safety co-processor", "Power management IC"],
    "Enclosure & mounts": [],
    "Battery pack": [],
    "Heated humidifier": [],
}

SW_BREAKDOWN = {
    "Breath control loop": ["Volume-control mode", "Pressure-control mode"],
    "Alarms & monitoring": ["Apnea detection service", "Priority alarm queue"],
    "Clinician UI": [],
    "Cybersecurity services": [],
}

BOM = [
    {"id": "MTR-BLW-01", "part": "Brushless blower motor 24V", "vendor": "Nidec Copal", "alternates": 2, "unitCost": 184.5, "leadTime": "8 wk", "risk": "Medium", "cts": True},
    {"id": "VLV-INS-02", "part": "Proportional inspiratory valve", "vendor": "IMI Norgren", "alternates": 1, "unitCost": 96.2, "leadTime": "12 wk", "risk": "High", "cts": True},
    {"id": "SEN-FLO-03", "part": "Bidirectional flow sensor", "vendor": "Sensirion", "alternates": 2, "unitCost": 78.0, "leadTime": "6 wk", "risk": "Low", "cts": True},
    {"id": "SEN-O2-G1", "part": "Galvanic O2 sensor", "vendor": "City Tech", "alternates": 3, "unitCost": 34.0, "leadTime": "4 wk", "risk": "Low", "cts": True},
    {"id": "MCU-STM-01", "part": "MCU STM32H7", "vendor": "STMicro", "alternates": 1, "unitCost": 12.4, "leadTime": "20 wk", "risk": "High", "cts": True},
    {"id": "PMI-TI-01", "part": "Power management IC", "vendor": "Texas Instruments", "alternates": 2, "unitCost": 6.2, "leadTime": "10 wk", "risk": "Medium", "cts": False},
    {"id": "BAT-LI-01", "part": "Li-ion pack 6S 5Ah", "vendor": "Inspired Energy", "alternates": 2, "unitCost": 142.0, "leadTime": "8 wk", "risk": "Medium", "cts": False},
    {"id": "DIS-TFT-01", "part": '10.1" TFT display', "vendor": "AUO", "alternates": 3, "unitCost": 58.4, "leadTime": "6 wk", "risk": "Low", "cts": False},
    {"id": "PSU-MW-01", "part": "Medical PSU 150W", "vendor": "Mean Well", "alternates": 2, "unitCost": 84.0, "leadTime": "6 wk", "risk": "Low", "cts": False},
    {"id": "HUM-FP-01", "part": "Heated humidifier module", "vendor": "Fisher & Paykel", "alternates": 1, "unitCost": 210.0, "leadTime": "10 wk", "risk": "Medium", "cts": False},
]


def _j(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2)


def program_header() -> str:
    return (
        f"PROGRAM: {PROGRAM['name']} — {PROGRAM['subtitle']} (stage: {PROGRAM['stage']}).\n"
        f"Device class: {PROGRAM['device_class']}. Intended use: {PROGRAM['intended_use']}\n"
        f"{PROGRAM['requirements']} requirements total ({PROGRAM['swReqs']} SW / {PROGRAM['hwReqs']} HW)."
    )


def requirements_block() -> str:
    return "REQUIREMENTS:\n" + _j(REQUIREMENTS)


def standards_block() -> str:
    return "STANDARDS:\n" + _j(STANDARDS)


def boundary_conditions_block() -> str:
    return "BOUNDARY CONDITIONS:\n" + _j(BOUNDARY_CONDITIONS)


def hw_breakdown_block() -> str:
    return "HARDWARE BREAKDOWN:\n" + _j(HW_BREAKDOWN)


def sw_breakdown_block() -> str:
    return "SOFTWARE BREAKDOWN:\n" + _j(SW_BREAKDOWN)


def bom_block() -> str:
    return "CURRENT BOM (unit costs in USD, cts=critical-to-safety):\n" + _j(BOM)
