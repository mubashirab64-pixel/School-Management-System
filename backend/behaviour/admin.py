from django.contrib import admin
from .models import StudentBehaviourRecord, StudentEventParticipation, MonthlyBehaviourRecord


class StudentEventParticipationInline(admin.TabularInline):
    model = StudentEventParticipation
    extra = 0


# @admin.register(StudentBehaviourRecord)
class StudentBehaviourRecordAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "student",
        "organization",
        "week_start",
        "week_end",
        "punctuality_percent",
        "obedience_percent",
        "class_behaviour_percent",
        "participation_percent",
        "homework_percent",
        "respect_percent",
        "events_count",
        "created_at",
    )
    list_filter = ("organization", "week_start", "week_end")
    search_fields = ("student__name", "student__student_code", "student__student_id")
    inlines = [StudentEventParticipationInline]

    @staticmethod
    def _score_to_percent(key: str, score: int, events_len: int) -> int:
        base = {1: 25, 2: 50, 3: 75, 4: 100}
        if key == "participation":
            if events_len > 0:
                return 100
            if score == 4:
                return 90
        return base.get(int(score or 0), 0)

    def _metric_percent(self, obj: StudentBehaviourRecord, key: str) -> int:
        m = obj.metrics or {}
        evs = obj.events.count() if hasattr(obj, "events") else 0
        return self._score_to_percent(key, int(m.get(key) or 0), evs)

    def punctuality_percent(self, obj):
        return self._metric_percent(obj, "punctuality")

    punctuality_percent.short_description = "Punctuality %"

    def obedience_percent(self, obj):
        return self._metric_percent(obj, "obedience")

    obedience_percent.short_description = "Obedience %"

    def class_behaviour_percent(self, obj):
        return self._metric_percent(obj, "classBehaviour")

    class_behaviour_percent.short_description = "Class Bhv %"

    def participation_percent(self, obj):
        return self._metric_percent(obj, "participation")

    participation_percent.short_description = "Participation %"

    def homework_percent(self, obj):
        return self._metric_percent(obj, "homework")

    homework_percent.short_description = "Homework %"

    def respect_percent(self, obj):
        return self._metric_percent(obj, "respect")

    respect_percent.short_description = "Respect %"

    def events_count(self, obj):
        return obj.events.count()

    events_count.short_description = "Events"


# @admin.register(MonthlyBehaviourRecord)
class MonthlyBehaviourRecordAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "organization", "month", "created_at")
    list_filter = ("organization", "month")
    search_fields = ("student__name", "student__student_code", "student__student_id")


