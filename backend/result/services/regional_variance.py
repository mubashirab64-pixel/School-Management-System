"""Regional Score Variance: compare the school's own subject averages against
external regional benchmarks (RegionalBenchmark).

Variance (percentage points) = school_avg − regional_avg, per subject. A positive
variance means the school is above the regional average for that subject.
"""
from django.db.models import Avg, F, ExpressionWrapper, FloatField, Q

from result.models import SubjectMark, RegionalBenchmark

# Non-academic rows that shouldn't count toward a subject average.
_BEHAVIOUR_KEYS = ('behaviour', 'behavior', 'homework', 'hygiene', 'observation', 'discipline', 'remarks')


def _is_behaviour(name):
    n = (name or '').lower()
    return any(k in n for k in _BEHAVIOUR_KEYS)


def _school_subject_averages(academic_year, exam_type=None, campus_id=None, grade=None):
    """{subject_name: avg_percentage} for approved results in scope.

    Percentage per mark = obtained/total×100 (theory); rows with total_marks<=0
    are excluded so the division is safe. Uses .objects so the caller's org
    context scopes it — call from an authenticated request.
    """
    pct = ExpressionWrapper(F('obtained_marks') * 100.0 / F('total_marks'), output_field=FloatField())
    qs = SubjectMark.objects.filter(
        result__status='approved', result__is_deleted=False,
        result__academic_year=academic_year, total_marks__gt=0)
    if exam_type:
        qs = qs.filter(result__exam_type=exam_type)
    if campus_id:
        qs = qs.filter(result__student__campus_id=campus_id)
    if grade:
        qs = qs.filter(result__student__current_grade=grade)

    out = {}
    for r in qs.values('subject_name').annotate(avg=Avg(pct)):
        if _is_behaviour(r['subject_name']):
            continue
        out[r['subject_name']] = round(r['avg'] or 0, 1)
    return out


def _benchmark_map(organization_id, academic_year, exam_type=None, grade=None):
    """{subject_name: regional_avg} choosing the most specific matching row.

    Preference: exam_type match > blank exam_type; grade match > blank (all-grades).
    Org-owned rows win over shared (organization is null) rows.
    """
    rows = RegionalBenchmark.objects.filter(academic_year=academic_year).filter(
        Q(organization_id=organization_id) | Q(organization__isnull=True))

    exam = exam_type or ''
    gr = grade or ''

    def score(row):
        # higher = more specific / more preferred
        s = 0
        if row.exam_type == exam and exam:
            s += 4
        elif not row.exam_type:
            s += 1
        if row.grade == gr and gr:
            s += 4
        elif not row.grade:
            s += 1
        if row.organization_id == organization_id:
            s += 2
        return s

    best = {}
    for row in rows:
        # skip rows that target a *different* grade/exam than asked for
        if row.grade and gr and row.grade != gr:
            continue
        if row.exam_type and exam and row.exam_type != exam:
            continue
        cur = best.get(row.subject_name)
        if cur is None or score(row) > score(cur):
            best[row.subject_name] = row
    return {name: round(row.average_percentage, 1) for name, row in best.items()}


def subject_variance(organization_id, academic_year, exam_type=None, campus_id=None, grade=None):
    """Per-subject school avg vs regional benchmark + variance.

    Returns only subjects present in BOTH the school's results and the benchmark
    set (a variance needs both sides). Sorted worst-variance first so the biggest
    gaps surface at the top.
    """
    school = _school_subject_averages(academic_year, exam_type, campus_id, grade)
    regional = _benchmark_map(organization_id, academic_year, exam_type, grade)

    rows = []
    for subject, school_avg in school.items():
        if subject not in regional:
            continue
        regional_avg = regional[subject]
        variance = round(school_avg - regional_avg, 1)
        rows.append({
            'subject': subject,
            'school_avg': school_avg,
            'regional_avg': regional_avg,
            'variance': variance,
            'direction': 'above' if variance > 0 else 'below' if variance < 0 else 'equal',
        })
    rows.sort(key=lambda r: r['variance'])

    matched = len(rows)
    avg_variance = round(sum(r['variance'] for r in rows) / matched, 1) if matched else 0
    return {
        'academic_year': academic_year,
        'exam_type': exam_type,
        'grade': grade,
        'subjects': rows,
        'matched_subjects': matched,
        'avg_variance': avg_variance,
        'has_data': matched > 0,
        'benchmark_source': _source_label(organization_id, academic_year),
    }


def _source_label(organization_id, academic_year):
    row = RegionalBenchmark.objects.filter(academic_year=academic_year).filter(
        Q(organization_id=organization_id) | Q(organization__isnull=True)
    ).exclude(source='').first()
    return row.source if row else ''
