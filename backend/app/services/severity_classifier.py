from dataclasses import dataclass
from typing import Optional

from app.services.acne_analyzer import AcneParams
from app.services.pigmentation_analyzer import PigmentationParams
from app.services.wrinkle_analyzer import WrinkleParams
from app.services.pore_analyzer import PoreParams

# Weighted Severity Index: primary parameter carries half the weight, the two
# secondary parameters a quarter each. Final severity is a flat WSI threshold —
# confirmed against experimental_matrix.xlsx's "Referral" column (the column
# that actually drives the remedy lookup, not the sheet's separate "Decision"
# column, which used an earlier majority-vote approach the Referral column
# superseded): <0.33 mild, 0.33-0.66 moderate, >0.66 severe.
_BAND_SCORE = {"mild": 0.0, "moderate": 0.5, "severe": 1.0}
_WEIGHTS = (0.5, 0.25, 0.25)


@dataclass
class SeverityResult:
    severity: str
    wsi: Optional[float]
    flag: Optional[str] = None


def _wsi(primary: str, secondary: str, tertiary: str) -> float:
    w1, w2, w3 = _WEIGHTS
    score = w1 * _BAND_SCORE[primary] + w2 * _BAND_SCORE[secondary] + w3 * _BAND_SCORE[tertiary]
    return round(score, 3)


def _decide(wsi: float) -> str:
    if wsi < 0.33:
        return "mild"
    if wsi <= 0.66:
        return "moderate"
    return "severe"


def _elevated_flag(decision: str, labeled_bands: list) -> Optional[str]:
    """Surfaces any parameter that reads severe even though it was outweighed
    in the overall WSI — matches the matrix's "Moderate with severe X" / "Mild
    with severe X" annotations. No flag once the decision is already severe,
    since calling out a severe reading is redundant at that point."""
    if decision == "severe":
        return None
    severe_labels = [label for label, band in labeled_bands if band == "severe"]
    if not severe_labels:
        return None
    joined = " and ".join(severe_labels)
    return f"{decision.capitalize()} overall, but {joined} read severe — worth a closer look."


def _acne_count_band(v: float) -> str:
    if v > 15:
        return "severe"
    if v >= 6:
        return "moderate"
    return "mild"


def _acne_density_band(v: float) -> str:
    """No standalone lesion-density measurement exists yet, so this uses
    inflammatory_pct (% of lesions that are pustules/nodules) as the secondary
    clustering/severity signal, per the spec's own suggested inflammatory-%
    bands (<20 / 20-50 / >50)."""
    if v > 50:
        return "severe"
    if v >= 20:
        return "moderate"
    return "mild"


def _acne_ri_band(v: float) -> str:
    if v > 35:
        return "severe"
    if v >= 15:
        return "moderate"
    return "mild"


def classify_acne(p: AcneParams) -> SeverityResult:
    count_band = _acne_count_band(p.lesion_count_per_cm2)
    density_band = _acne_density_band(p.inflammatory_pct)
    ri_band = _acne_ri_band(p.redness_index)
    wsi = _wsi(count_band, density_band, ri_band)

    if p.lesion_type == "nodules_cysts":
        return SeverityResult(
            severity="severe",
            wsi=wsi,
            flag="Nodular/cystic lesions present — treated as severe regardless of other readings.",
        )

    decision = _decide(wsi)
    flag = _elevated_flag(
        decision,
        [("lesion count", count_band), ("inflammatory %", density_band), ("redness index", ri_band)],
    )
    return SeverityResult(severity=decision, wsi=wsi, flag=flag)


def _pig_area_band(v: float) -> str:
    if v > 30:
        return "severe"
    if v >= 10:
        return "moderate"
    return "mild"


def _pig_delta_gray_band(v: float) -> str:
    if v > 50:
        return "severe"
    if v >= 20:
        return "moderate"
    return "mild"


def _pig_mi_band(v: float) -> str:
    if v > 100:
        return "severe"
    if v >= 50:
        return "moderate"
    return "mild"


def classify_pigmentation(p: PigmentationParams) -> SeverityResult:
    area_band = _pig_area_band(p.pigmented_area_pct)
    delta_gray_band = _pig_delta_gray_band(p.delta_gray)
    mi_band = _pig_mi_band(p.melanin_index)
    wsi = _wsi(area_band, delta_gray_band, mi_band)

    if p.pigmented_area_pct > 50:
        return SeverityResult(
            severity="severe", wsi=wsi,
            flag="Pigmented area exceeds 50% of the region — treated as severe regardless of other readings.",
        )
    if p.melanin_index > 150 and p.delta_gray > 80:
        return SeverityResult(
            severity="severe", wsi=wsi,
            flag="Very dark, high-contrast pigmentation (MI>150 and ΔGray>80) — treated as severe.",
        )

    decision = _decide(wsi)
    flag = _elevated_flag(
        decision,
        [("pigmented area", area_band), ("ΔGray", delta_gray_band), ("melanin index", mi_band)],
    )
    return SeverityResult(severity=decision, wsi=wsi, flag=flag)


def _wrinkle_count_band(v: float) -> str:
    if v > 10:
        return "severe"
    if v >= 5:
        return "moderate"
    return "mild"


def _wrinkle_length_band(v: float) -> str:
    if v > 40:
        return "severe"
    if v >= 20:
        return "moderate"
    return "mild"


def _wrinkle_depth_band(v: float) -> str:
    if v > 50:
        return "severe"
    if v >= 20:
        return "moderate"
    return "mild"


def classify_wrinkle(p: WrinkleParams) -> SeverityResult:
    count_band = _wrinkle_count_band(p.wrinkle_count_per_cm2)
    length_band = _wrinkle_length_band(p.avg_length_mm)
    depth_band = _wrinkle_depth_band(p.depth_delta_gray)
    wsi = _wsi(count_band, length_band, depth_band)

    decision = _decide(wsi)
    flag = _elevated_flag(
        decision,
        [("wrinkle count", count_band), ("length", length_band), ("depth", depth_band)],
    )
    return SeverityResult(severity=decision, wsi=wsi, flag=flag)


def classify_pore(p: PoreParams) -> SeverityResult:
    """Pore severity isn't part of the weighted-index system (no matrix sheet
    covers it) — kept as a simple OR-threshold rule, wsi=None.

    These thresholds are a best-effort calibration against a handful of real
    photos (see the accuracy investigation that replaced pore_analyzer's old
    absolute-micron claim with these region-relative metrics), not a
    validated clinical calibration — there's no labeled "confirmed enlarged
    pores" dataset to calibrate against yet. Revisit once one exists.

    avg_pore_size_pct is normalized against the analyzed region's own pixel
    count (see pore_analyzer.py), so tightening what counts as "skin" (e.g.
    also excluding eyes/mouth, added after this was first calibrated) shrinks
    that denominator and mechanically inflates the percentage for the same
    real blobs — these thresholds were re-widened to account for that, but
    it means the two size bands aren't on a perfectly stable absolute scale.
    """
    if p.pore_density_pct > 1.5 or p.avg_pore_size_pct > 2.2:
        severity = "severe"
    elif p.pore_density_pct >= 0.5 or p.avg_pore_size_pct >= 1.5:
        severity = "moderate"
    else:
        severity = "mild"
    return SeverityResult(severity=severity, wsi=None, flag=None)
