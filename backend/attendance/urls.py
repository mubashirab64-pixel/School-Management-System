from django.urls import path
from . import views
from .views import AuditLogListView, RecoverEntityView
from .services.backfill_view import backfill_permissions_in_scope
from .services.chronic_view import chronic_absentees
from .services.student_calendar_view import student_attendance_calendar
from .services.staff_calendar_view import staff_attendance_calendar
from .services.reminder_view import remind_teacher, remind_all_teachers
from .services.export_pdf import export_attendance_pdf
from .services.review_view import (
    attendance_review, attendance_review_daily, attendance_review_missing,
)

app_name = 'attendance'

urlpatterns = [
    # ── Unified Attendance Review (role-adaptive drill-down) ──
    # NOTE: 'review/missing/' must precede 'review/<int:attendance_id>/' below,
    # which is the unrelated legacy approve action. Django matches in order.
    path('review/', attendance_review, name='attendance_review'),
    path('review/daily/', attendance_review_daily, name='attendance_review_daily'),
    path('review/missing/', attendance_review_missing, name='attendance_review_missing'),
    path('review/chronic-absentees/', chronic_absentees, name='chronic_absentees'),
    path('review/remind/', remind_teacher, name='remind_teacher'),
    path('review/remind-all/', remind_all_teachers, name='remind_all_teachers'),

    # Attendance list for dashboard
    path('', views.get_attendance_list, name='attendance_list'),

    # Per-campus attendance % (org-admin Campus Comparison)
    path('campus_stats/', views.get_campus_attendance_stats, name='campus_attendance_stats'),
    path('daily_stats/', views.get_daily_attendance_stats, name='daily_attendance_stats'),
    
    # Attendance marking
    path('mark/', views.mark_attendance, name='mark_attendance'),
    path('mark-bulk/', views.mark_bulk_attendance, name='mark_bulk_attendance'),
    
    # Class attendance
    path('class/<int:classroom_id>/', views.get_class_attendance, name='class_attendance'),
    path('class/<int:classroom_id>/students/', views.get_class_students, name='class_students'),
    path('class/<int:classroom_id>/summary/', views.get_attendance_summary, name='attendance_summary'),
    path('class/<int:classroom_id>/attendance/<str:date>/', views.get_attendance_for_date, name='attendance_for_date'),
    
    # Student attendance
    path('student/<int:student_id>/', views.get_student_attendance, name='student_attendance'),
    path('student/<int:student_id>/monthly/', views.get_student_monthly_attendance, name='student_monthly_attendance'),
    path('student/<int:student_id>/calendar/', student_attendance_calendar, name='student_attendance_calendar'),
    
    # Teacher classes
    path('teacher/classes/', views.get_teacher_classes, name='teacher_classes'),
    
    # Edit attendance
    path('edit/<int:attendance_id>/', views.edit_attendance, name='edit_attendance'),
    
    # Coordinator endpoints
    path('coordinator/classes/', views.get_coordinator_classes, name='coordinator_classes'),
    path('level/<int:level_id>/summary/', views.get_level_attendance_summary, name='level_attendance_summary'),
    
    # State management
    path('submit/<int:attendance_id>/', views.submit_attendance, name='submit_attendance'),
    path('review/<int:attendance_id>/', views.review_attendance, name='review_attendance'),
    path('finalize/<int:attendance_id>/', views.finalize_attendance, name='finalize_attendance'),
    path('coordinator-approve/<int:attendance_id>/', views.coordinator_approve_attendance, name='coordinator_approve_attendance'),
    path('coordinator-bulk-approve/', views.coordinator_bulk_approve_attendance, name='coordinator_bulk_approve_attendance'),
    path('reopen/<int:attendance_id>/', views.reopen_attendance, name='reopen_attendance'),
    
    # Backfill permissions
    path('backfill/grant/', views.grant_backfill_permission, name='grant_backfill_permission'),
    # Teacher-scoped: "what access do I hold?" — filters granted_to=request.user.
    path('backfill/permissions/', views.get_backfill_permissions, name='get_backfill_permissions'),
    # Coordinator-scoped: "what access exists across my classes?"
    path('backfill/in-scope/', backfill_permissions_in_scope, name='backfill_in_scope'),
    
    # Holiday management
    path('holidays/create/', views.create_holiday, name='create_holiday'),
    path('holidays/', views.get_holidays, name='get_holidays'),
    path('holidays/<int:holiday_id>/', views.update_holiday, name='update_holiday'),
    path('holidays/<int:holiday_id>/delete/', views.delete_holiday, name='delete_holiday'),
    
    # Real-time metrics
    path('metrics/realtime/', views.get_realtime_attendance_metrics, name='realtime_metrics'),
    
    # Delete logs (audit trail)
    path('delete-logs/', views.get_delete_logs, name='delete_logs'),

    # Extended audit log + recovery
    path('audit-logs/', AuditLogListView.as_view(), name='audit_logs'),
    path('audit-logs/<int:pk>/recover/', RecoverEntityView.as_view(), name='audit_log_recover'),


    # Staff Attendance (manual marking)
    path('staff/', views.staff_attendance_list, name='staff_attendance_list'),
    path('staff/mark/', views.staff_attendance_mark, name='staff_attendance_mark'),
    path('staff/summary/', views.staff_attendance_summary, name='staff_attendance_summary'),
    path('staff/daily_stats/', views.staff_daily_attendance_stats, name='staff_daily_attendance_stats'),
    path('staff/history/', views.staff_attendance_history, name='staff_attendance_history'),
    path('staff/export-csv/', views.staff_export_csv, name='staff_export_csv'),
    path('staff/<int:user_id>/calendar/', staff_attendance_calendar, name='staff_attendance_calendar'),

    # ZKTeco Universal ADMS Paths (Machine default paths)
    path('iclock/cdata', views.zkteco_push, name='zkteco_push_universal'),
    path('iclock/getrequest', views.zkteco_push, name='zkteco_push_getrequest'),
    path('iclock/registry', views.zkteco_push, name='zkteco_push_registry'),
    path('iclock/push', views.zkteco_push, name='zkteco_push_v2'),

    # ZKTeco Push (Front-end alias)
    path('zkteco/push/', views.zkteco_push, name='zkteco_push'),

    # ZKTeco Device Management
    path('zkteco/devices/', views.zkteco_devices, name='zkteco_devices'),
    path('zkteco/devices/<int:device_id>/', views.zkteco_device_detail, name='zkteco_device_detail'),

    # ZKTeco Employee Mappings
    path('zkteco/mappings/', views.zkteco_mappings, name='zkteco_mappings'),
    path('zkteco/mappings/<int:mapping_id>/', views.zkteco_mapping_detail, name='zkteco_mapping_detail'),
    path('zkteco/unmapped-staff/', views.zkteco_unmapped_staff, name='zkteco_unmapped_staff'),


    # Employee Individual Timings
    path('employee-timings/', views.employee_timings_list, name='employee_timings_list'),
    path('employee-timings/save/', views.employee_timings_bulk_save, name='employee_timings_bulk_save'),
    path('export-csv/', views.export_attendance_csv, name='export_attendance_csv'),
    path('export-excel/', views.export_attendance_excel, name='export_attendance_excel'),
    path('export-pdf/', export_attendance_pdf, name='export_attendance_pdf'),
]
