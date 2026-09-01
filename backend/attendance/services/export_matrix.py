"""
Matrix-format attendance export — the on-screen grid, as a file.

The old export was one row per student *per day*: a 35-student month ran to
900 near-identical lines that read "ATTENDANCE NOT MARKED". This produces the
same shape people see on the review page — students down the side, dates across
the top, a status letter in each cell — which is what a register actually looks
like.

Reuses _student_matrix from the review view, so the cells, the working-day set,
and the percentage all match the screen rather than being computed a second way.
"""
from attendance.services.review_view import _student_matrix

# Cell text per status. Weekend/holiday/unmarked collapse to something quiet so
# the marked days stand out.
STATUS_LETTER = {
    'present': 'P',
    'absent': 'A',
    'late': 'L',
    'leave': 'Lv',
    'excused': 'Ex',
    'holiday': 'H',
    'weekend': '',
    'unmarked': '',
}


def teacher_name(classroom):
    return classroom.class_teacher.full_name if classroom.class_teacher else 'Not assigned'


def iter_classroom_matrices(classrooms, from_date, to_date, scope):
    """Yield (classroom, matrix) for each classroom, in a stable order.

    `matrix` is exactly what the review roll returns: dates[], students[] with a
    per-date status map and an attendance_pct, and working_days.
    """
    ordered = classrooms.select_related('class_teacher', 'grade__level').order_by(
        'grade__name', 'section',
    )
    for classroom in ordered:
        yield classroom, _student_matrix(scope, from_date, to_date, classroom.id)


def cell_text(matrix_dates, student, date_key):
    """Status letter for one student on one date.

    Weekend/holiday come from the date, not the student, so a day nobody could
    attend never reads as an absence.
    """
    status = student['dates'].get(date_key, 'unmarked')
    return STATUS_LETTER.get(status, '')
