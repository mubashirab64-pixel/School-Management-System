from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils.dateparse import parse_date
from django.db.models import Q

from datetime import date
from calendar import monthrange

from .models import StudentBehaviourRecord, MonthlyBehaviourRecord
from .serializers import StudentBehaviourRecordSerializer, MonthlyBehaviourRecordSerializer


class BehaviourRecordCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StudentBehaviourRecordSerializer


class StudentBehaviourListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, student_id: int):
        qs = StudentBehaviourRecord.objects.filter(student_id=student_id).order_by("-week_start")
        start = request.query_params.get("start_date")
        end = request.query_params.get("end_date")
        if start:
            d = parse_date(start)
            if d:
                qs = qs.filter(week_start__gte=d)
        if end:
            d = parse_date(end)
            if d:
                qs = qs.filter(week_end__lte=d)
        data = StudentBehaviourRecordSerializer(qs, many=True).data
        return Response(data)


def _score_to_percent(metric_key: str, score: int, events_len: int) -> int:
    base = {1: 25, 2: 50, 3: 75, 4: 100}
    if metric_key == "participation":
        if events_len > 0:
            return 100
        if score == 4:
            return 90
    return base.get(int(score or 0), 0)


class ComputeMonthlyBehaviourView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        student_id = int(request.data.get("student") or 0)
        month_str = request.data.get("month")  # YYYY-MM
        if not (student_id and month_str):
            return Response({"detail": "student and month (YYYY-MM) are required"}, status=400)
        year, mon = [int(x) for x in month_str.split("-")]
        first_day = date(year, mon, 1)
        last_day = date(year, mon, monthrange(year, mon)[1])

        qs = StudentBehaviourRecord._base_manager.filter(student_id=student_id, week_end__range=(first_day, last_day))
        if not qs.exists():
            return Response({"detail": "No weekly records in this month"}, status=404)

        metrics_sum = {k: 0 for k in ["punctuality", "obedience", "classBehaviour", "participation", "homework", "respect"]}
        count = qs.count()
        for r in qs:
            m = r.metrics or {}
            evs_len = r.events.count() if hasattr(r, "events") else 0
            for key in metrics_sum.keys():
                metrics_sum[key] += _score_to_percent(key, int(m.get(key) or 0), evs_len)

        metrics_avg = {k: round(v / count) for k, v in metrics_sum.items()}

        org = getattr(request.user, 'organization', None)
        obj, _ = MonthlyBehaviourRecord.objects.update_or_create(
            student_id=student_id,
            month=first_day,
            defaults={
                "organization": org,
                "metrics": metrics_avg,
                "source_range_start": first_day,
                "source_range_end": last_day,
            },
        )
        return Response(MonthlyBehaviourRecordSerializer(obj).data)


class StudentMonthlyBehaviourView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, student_id: int):
        month = request.query_params.get("month")  # YYYY-MM optional
        if month:
            year, mon = [int(x) for x in month.split("-")]
            first_day = date(year, mon, 1)
            obj = MonthlyBehaviourRecord.objects.filter(student_id=student_id, month=first_day).first()
            if not obj:
                return Response({"detail": "No monthly record found", "metrics": {}}, status=200)
            return Response(MonthlyBehaviourRecordSerializer(obj).data)

        # latest by month
        obj = MonthlyBehaviourRecord.objects.filter(student_id=student_id).order_by("-month").first()
        if not obj:
            return Response({"detail": "No monthly record found", "metrics": {}}, status=200)
        return Response(MonthlyBehaviourRecordSerializer(obj).data)


