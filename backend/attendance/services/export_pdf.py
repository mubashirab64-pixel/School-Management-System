"""
Printable attendance summary — PDF.

Scoped through resolve_export_scope() like the CSV and Excel exports, so all
three answer to the same access rules.

Deliberately a *summary*, not the CSV in PDF clothing. A PDF is for reading and
signing: one row per class with its counts and rate, plus the days nobody
submitted. Anyone who wants student-level rows wants the CSV, which is already
better at it and does not paginate them across 40 pages.
"""
from io import BytesIO

from django.http import HttpResponse
from django.utils import timezone

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from attendance.models import Attendance
from attendance.services import calendar_utils
from attendance.services.metrics import attendance_percentage

BRAND = colors.HexColor("#274c77")
MUTED = colors.HexColor("#6b7280")

# Attendance bands, worst first — the first match wins.
RATE_BANDS = (
    (75, colors.HexColor("#dc2626")),
    (90, colors.HexColor("#d97706")),
    (101, colors.HexColor("#16a34a")),
)


def _rate_colour(rate):
    for ceiling, colour in RATE_BANDS:
        if rate < ceiling:
            return colour
    return colors.black


def _page_furniture(canvas, doc, subtitle):
    """Header rule and page number, drawn on every page."""
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(15 * mm, doc.pagesize[1] - 10 * mm, subtitle)
    canvas.drawRightString(
        doc.pagesize[0] - 15 * mm, 10 * mm, f"Page {canvas.getPageNumber()}",
    )
    canvas.setStrokeColor(colors.HexColor("#e5e7eb"))
    canvas.line(
        15 * mm, doc.pagesize[1] - 12 * mm,
        doc.pagesize[0] - 15 * mm, doc.pagesize[1] - 12 * mm,
    )
    canvas.restoreState()


def build_attendance_pdf(classrooms, from_date, to_date, scope, scope_label=""):
    """Render the summary and return the PDF bytes."""
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "title", parent=styles["Title"], fontSize=16, textColor=BRAND,
        alignment=0, spaceAfter=2,
    )
    meta_style = ParagraphStyle(
        "meta", parent=styles["Normal"], fontSize=8.5, textColor=MUTED, spaceAfter=8,
    )
    section_style = ParagraphStyle(
        "section", parent=styles["Heading2"], fontSize=11, textColor=BRAND,
        spaceBefore=10, spaceAfter=4,
    )

    holiday_index = calendar_utils.holiday_index_in_range(
        scope.organization_id, from_date, to_date,
    )

    rows = [["Class", "Teacher", "Students", "Present", "Absent", "Late", "Leave", "Excused", "Rate"]]
    body_styles = []
    totals = {"present": 0, "absent": 0, "late": 0, "leave": 0, "excused": 0, "total": 0}

    classrooms = classrooms.select_related("class_teacher", "grade__level__campus")
    for index, classroom in enumerate(classrooms, start=1):
        agg = Attendance.objects.filter(
            classroom=classroom, date__gte=from_date, date__lte=to_date, is_deleted=False,
        ).values_list(
            "total_students", "present_count", "absent_count",
            "late_count", "leave_count", "excused_count",
        )
        counts = {"total": 0, "present": 0, "absent": 0, "late": 0, "leave": 0, "excused": 0}
        for total, present, absent, late, leave, excused in agg:
            counts["total"] += total
            counts["present"] += present
            counts["absent"] += absent
            counts["late"] += late
            counts["leave"] += leave
            counts["excused"] += excused

        for key in totals:
            totals[key] += counts[key]

        rate = attendance_percentage(
            present=counts["present"], total=counts["total"],
            leave=counts["leave"], excused=counts["excused"],
        )
        # An em-dash, not 0%: a class nobody marked has no rate, and printing
        # 0% next to a real 0% would put two different facts in one column.
        rate_text = f"{rate}%" if counts["total"] else "—"

        rows.append([
            str(classroom),
            classroom.class_teacher.full_name if classroom.class_teacher else "Not assigned",
            str(counts["total"]),
            str(counts["present"]), str(counts["absent"]), str(counts["late"]),
            str(counts["leave"]), str(counts["excused"]), rate_text,
        ])
        if counts["total"]:
            body_styles.append(("TEXTCOLOR", (8, index), (8, index), _rate_colour(rate)))

    overall = attendance_percentage(
        present=totals["present"], total=totals["total"],
        leave=totals["leave"], excused=totals["excused"],
    )
    rows.append([
        "TOTAL", "", str(totals["total"]), str(totals["present"]), str(totals["absent"]),
        str(totals["late"]), str(totals["leave"]), str(totals["excused"]),
        f"{overall}%" if totals["total"] else "—",
    ])

    buffer = BytesIO()
    subtitle = f"Attendance Summary · {from_date} to {to_date}"
    doc = SimpleDocTemplate(
        buffer, pagesize=landscape(A4),
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=18 * mm, bottomMargin=15 * mm,
        title=subtitle,
    )

    working_days = len(
        calendar_utils.working_days_in_range(
            from_date, to_date,
            holiday_index.for_scope(level_ids=scope.level_ids, grade_ids=scope.grade_ids),
        )
    )

    story = [
        Paragraph("Attendance Summary", title_style),
        Paragraph(
            f"{scope_label or 'All classes in scope'} &nbsp;·&nbsp; {from_date} to {to_date} "
            f"&nbsp;·&nbsp; {working_days} working days "
            f"&nbsp;·&nbsp; generated {timezone.now():%d %b %Y, %H:%M}",
            meta_style,
        ),
    ]

    table = Table(rows, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f9fafb")),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ] + body_styles))
    story.append(table)

    story.append(Paragraph(
        "Rate = present ÷ (students − leave − excused). Approved absences are "
        "excluded from the total rather than counted against the class.",
        ParagraphStyle("foot", parent=styles["Normal"], fontSize=7, textColor=MUTED,
                       spaceBefore=6),
    ))

    doc.build(
        story,
        onFirstPage=lambda c, d: _page_furniture(c, d, subtitle),
        onLaterPages=lambda c, d: _page_furniture(c, d, subtitle),
    )
    return buffer.getvalue()


def pdf_response(pdf_bytes, from_date, to_date):
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = (
        f'attachment; filename="attendance_summary_{from_date}_to_{to_date}.pdf"'
    )
    return response


# ─────────────────────────────────────────────────────────────────────────────
#  View
# ─────────────────────────────────────────────────────────────────────────────

from rest_framework.decorators import api_view, permission_classes  # noqa: E402
from rest_framework.permissions import IsAuthenticated  # noqa: E402
from rest_framework.response import Response  # noqa: E402

from attendance.permissions import HasAttendanceViewPermission  # noqa: E402
from attendance.services.export_scope import ExportScopeError, resolve_export_scope  # noqa: E402


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAttendanceViewPermission])
def export_attendance_pdf(request):
    """
    Printable attendance summary.

    GET /api/attendance/export-pdf/?start_date=&end_date=&campus=

    Same scope and date rules as the CSV and Excel exports — they share
    resolve_export_scope(), so there is one answer to what a user may export.
    """
    try:
        classrooms, from_date, to_date, scope = resolve_export_scope(request)
    except ExportScopeError as exc:
        return Response({'error': exc.message}, status=exc.status_code)

    from attendance.services.review_view import _scope_label

    pdf_bytes = build_attendance_pdf(
        classrooms, from_date, to_date, scope, scope_label=_scope_label(scope),
    )
    return pdf_response(pdf_bytes, from_date, to_date)
