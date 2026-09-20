"""
Regression suite for app/services/severity_classifier.py — flagged in DEPLOY.md
as the module rewritten the most and the least covered by tests, since it's
what turns raw analyzer measurements into the severity shown to patients and
used for treatment recommendations.

Thresholds asserted here are the ones documented in severity_classifier.py
itself (calibrated against experimental_matrix.xlsx) — this suite exists to
catch accidental changes to those numbers, not to re-derive them.
"""

from app.services.acne_analyzer import AcneParams
from app.services.pigmentation_analyzer import PigmentationParams
from app.services.wrinkle_analyzer import WrinkleParams
from app.services.pore_analyzer import PoreParams
from app.services.severity_classifier import (
    classify_acne,
    classify_pigmentation,
    classify_wrinkle,
    classify_pore,
    _acne_count_band,
    _pig_area_band,
    _wrinkle_count_band,
)


def _acne(count=0.0, inflammatory_pct=0.0, redness_index=0.0, lesion_type="comedones"):
    return AcneParams(
        lesion_count_per_cm2=count,
        redness_index=redness_index,
        lesion_type=lesion_type,
        inflammatory_pct=inflammatory_pct,
    )


class TestClassifyAcne:
    def test_all_mild_bands_give_mild(self):
        result = classify_acne(_acne(count=1, inflammatory_pct=1, redness_index=1))
        assert result.severity == "mild"
        assert result.wsi == 0.0

    def test_all_severe_bands_give_severe(self):
        result = classify_acne(_acne(count=20, inflammatory_pct=60, redness_index=40))
        assert result.severity == "severe"
        assert result.wsi == 1.0

    def test_nodules_cysts_always_severe_regardless_of_other_readings(self):
        # Every other parameter reads mild -- lesion_type alone must still force severe.
        result = classify_acne(_acne(count=1, inflammatory_pct=1, redness_index=1, lesion_type="nodules_cysts"))
        assert result.severity == "severe"
        assert "regardless" in result.flag

    def test_count_band_boundaries(self):
        # _acne_count_band: <6 mild, 6-15 moderate, >15 severe. Tested directly
        # rather than through classify_acne(), since a single band elevated
        # against two mild secondaries doesn't necessarily cross the overall
        # WSI decision thresholds (weighted 0.5/0.25/0.25) -- see
        # test_all_severe_bands_give_severe for that combined behavior.
        assert _acne_count_band(5.9) == "mild"
        assert _acne_count_band(6) == "moderate"
        assert _acne_count_band(15) == "moderate"
        assert _acne_count_band(15.1) == "severe"

    def test_single_severe_band_alone_reaches_moderate_not_severe(self):
        # count_band=severe (weight 0.5) with both secondaries mild gives
        # wsi=0.5, which lands in the 0.33-0.66 "moderate" range -- a single
        # elevated parameter isn't enough to reach "severe" on its own.
        result = classify_acne(_acne(count=20, inflammatory_pct=1, redness_index=1))
        assert result.severity == "moderate"

    def test_elevated_flag_surfaces_a_severe_secondary_reading(self):
        # Count (primary, weight 0.5) mild + one severe secondary isn't enough to
        # push the overall WSI to severe, but should still be flagged.
        result = classify_acne(_acne(count=1, inflammatory_pct=60, redness_index=1))
        assert result.severity != "severe"
        assert result.flag is not None
        assert "inflammatory" in result.flag.lower()

    def test_no_flag_when_decision_is_already_severe(self):
        result = classify_acne(_acne(count=20, inflammatory_pct=60, redness_index=40))
        assert result.flag is None


def _pigmentation(area=0.0, delta_gray=0.0, mi=0.0):
    return PigmentationParams(pigmented_area_pct=area, delta_gray=delta_gray, melanin_index=mi)


class TestClassifyPigmentation:
    def test_all_mild_bands_give_mild(self):
        result = classify_pigmentation(_pigmentation(area=1, delta_gray=1, mi=1))
        assert result.severity == "mild"

    def test_area_over_50_pct_always_severe(self):
        # Hits the hard override even though delta_gray/MI alone would be mild.
        result = classify_pigmentation(_pigmentation(area=51, delta_gray=1, mi=1))
        assert result.severity == "severe"
        assert "50%" in result.flag

    def test_dark_high_contrast_override(self):
        # MI>150 and delta_gray>80 together force severe even with a small area.
        result = classify_pigmentation(_pigmentation(area=5, delta_gray=81, mi=151))
        assert result.severity == "severe"
        assert "MI>150" in result.flag

    def test_high_mi_alone_does_not_trigger_the_combined_override(self):
        # MI>150 without delta_gray>80 should fall through to the normal WSI vote,
        # not the combined-override shortcut.
        result = classify_pigmentation(_pigmentation(area=1, delta_gray=1, mi=151))
        assert result.severity != "severe" or "MI>150" not in (result.flag or "")

    def test_area_band_boundaries(self):
        # _pig_area_band: <10 mild, 10-30 moderate, >30 severe. Tested directly
        # for the same reason as acne's count band -- see that test's comment.
        assert _pig_area_band(9.9) == "mild"
        assert _pig_area_band(10) == "moderate"
        assert _pig_area_band(30) == "moderate"
        assert _pig_area_band(30.1) == "severe"


def _wrinkle(count=0.0, length=0.0, depth=0.0):
    return WrinkleParams(wrinkle_count_per_cm2=count, avg_length_mm=length, depth_delta_gray=depth, density_pct=0.0)


class TestClassifyWrinkle:
    def test_all_mild_bands_give_mild(self):
        result = classify_wrinkle(_wrinkle(count=1, length=1, depth=1))
        assert result.severity == "mild"

    def test_all_severe_bands_give_severe(self):
        result = classify_wrinkle(_wrinkle(count=11, length=41, depth=51))
        assert result.severity == "severe"

    def test_count_band_boundaries(self):
        # _wrinkle_count_band: <5 mild, 5-10 moderate, >10 severe. Tested
        # directly for the same reason as acne's count band -- see that test's
        # comment.
        assert _wrinkle_count_band(4.9) == "mild"
        assert _wrinkle_count_band(5) == "moderate"
        assert _wrinkle_count_band(10) == "moderate"
        assert _wrinkle_count_band(10.1) == "severe"

    def test_no_hard_overrides_exist_for_wrinkle(self):
        # Unlike acne/pigmentation, wrinkle severity has no special-case override --
        # even an extreme secondary reading alone can't reach severe on its own,
        # since it's weighted 0.25 against the WSI's <0.33/<=0.66 thresholds.
        result = classify_wrinkle(_wrinkle(count=1, length=1000, depth=1))
        assert result.severity != "severe"


def _pore(density=0.0, size=0.0):
    return PoreParams(pore_density_pct=density, avg_pore_size_pct=size)


class TestClassifyPore:
    def test_mild(self):
        assert classify_pore(_pore(density=0.1, size=0.1)).severity == "mild"

    def test_moderate_by_density(self):
        assert classify_pore(_pore(density=0.5, size=0.1)).severity == "moderate"

    def test_moderate_by_size(self):
        assert classify_pore(_pore(density=0.1, size=1.5)).severity == "moderate"

    def test_severe_by_density(self):
        assert classify_pore(_pore(density=1.6, size=0.1)).severity == "severe"

    def test_severe_by_size(self):
        assert classify_pore(_pore(density=0.1, size=2.3)).severity == "severe"

    def test_pore_has_no_wsi_or_flag(self):
        result = classify_pore(_pore(density=0.1, size=0.1))
        assert result.wsi is None
        assert result.flag is None
