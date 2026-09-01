"""Deterministic grade ordering derived from the STRUCTURAL codes assigned at
campus setup — not from hardcoded grade names.

`Grade.order` was historically left at 0 for every grade, so anything that
needed to rank grades (grade progression KPI, sorted grade lists) had nothing
to sort by. Rather than hardcode a name→rank table in each caller, we derive a
sort value from the codes the system already stamps on levels and grades when a
campus/level/grade is created:

    level.code  e.g.  C05-L2-M      → the "L2" is the education band
    grade.code  e.g.  C05-L2-M-G3   → the trailing "G3" is the grade within it

Primary sort = level band (L1 Pre-Primary < L2 Primary < L3 Secondary < L4
Higher-Secondary). Secondary sort = the grade code suffix. Because the same
grade name always maps to the same band by convention, `grade_order_value`
gives every "Grade I" (etc.) the same number across campuses — which is what the
KPI relies on when it maps a snapshot's grade NAME back to an order.

`Grade.save()` calls this so order is maintained on every write; the
`backfill_grade_order` command fills it for rows created before this existed.
"""
import re

# Rank of a non-numeric grade WITHIN its level, keyed by the code suffix the
# model stamps at creation. Covers both KGI/KGII and the KG1/KG2 spelling.
_SUFFIX_RANK = {
    'N': 0,
    'KGI': 1, 'KG1': 1,
    'KGII': 2, 'KG2': 2,
    'SC': 3,
}

_UNKNOWN_LEVEL = 9   # a grade with an unparseable level sorts after the known bands
_UNKNOWN_RANK = 50   # a custom/unparseable grade sorts mid-band, never at the top


def _level_number(level_code):
    m = re.search(r'L(\d+)', level_code or '')
    return int(m.group(1)) if m else _UNKNOWN_LEVEL


def _suffix(grade_code, level_code):
    """The grade-specific tail of the code. grade.code is always
    ``{level.code}-{suffix}``, so stripping the level prefix is robust even when
    the campus code itself contains spaces or dashes."""
    if grade_code and level_code and grade_code.startswith(level_code + '-'):
        return grade_code[len(level_code) + 1:]
    return (grade_code or '').rsplit('-', 1)[-1]


def _within_rank(suffix):
    suffix = (suffix or '').upper()
    if suffix in _SUFFIX_RANK:
        return _SUFFIX_RANK[suffix]
    m = re.fullmatch(r'G(\d+)', suffix)          # G1 … G12
    if m:
        return int(m.group(1))
    m = re.fullmatch(r'GRAD-?(\d*)', suffix)     # Higher-Secondary fallback code
    if m:
        return int(m.group(1) or 0)
    return _UNKNOWN_RANK


def grade_order_value(grade_code, level_code):
    """A stable, comparable sort order for a grade from its structural codes.

    Same inputs always yield the same value, so a grade name maps consistently
    across campuses. Band dominates (×100) so every Primary grade outranks every
    Pre-Primary grade regardless of the within-band numbers.
    """
    return _level_number(level_code) * 100 + _within_rank(_suffix(grade_code, level_code))
