"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Banknote, Wallet, AlertTriangle, Percent, Users, CheckCircle2,
  CircleDollarSign, ArrowRight, Loader2,
} from "lucide-react"
import Link from "next/link"
import { feeService } from "@/services/feeService"

// Brand-consistent palette (matches donor / fees dashboards).
const TREND_COLLECTED = "#16a34a"
const TREND_EXPECTED = "#6096ba"
const STATUS_COLORS: Record<string, string> = {
  paid: "#16a34a",
  partial: "#f59e0b",
  unpaid: "#dc2626",
}

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i).toLocaleString("default", { month: "short" })
)

function rs(v: number | undefined | null) {
  return `Rs ${Number(v || 0).toLocaleString()}`
}

function KpiCard({ icon, label, value, sub, tone = "default" }: {
  icon: React.ReactNode; label: string; value: string; sub?: string
  tone?: "default" | "good" | "danger" | "warn"
}) {
  const cls =
    tone === "danger" ? "text-rose-600"
      : tone === "good" ? "text-emerald-600"
        : tone === "warn" ? "text-amber-600"
          : "text-[#274c77]"
  return (
    <Card className="border border-gray-100">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-gray-50 ${cls}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className={`text-2xl font-black ${cls} truncate`}>{value}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AccountsNetworkDashboard({ campusName }: { campusName?: string }) {
  const now = new Date()
  const [range, setRange] = useState({
    fromMonth: now.getMonth() + 1, fromYear: now.getFullYear(),
    toMonth: now.getMonth() + 1, toYear: now.getFullYear(),
  })
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const years = useMemo(() => {
    const y = now.getFullYear()
    return [y - 2, y - 1, y, y + 1]
  }, [now])

  useEffect(() => {
    let alive = true
    setLoading(true)
    // Backend locks a campus accountant to their own campus, so no campus_id
    // is needed here — the collection report is already scoped for them.
    feeService.getCollectionReport({
      month_from: range.fromMonth, year_from: range.fromYear,
      month_to: range.toMonth, year_to: range.toYear,
    })
      .then((res) => { if (alive) setData(res) })
      .catch((e) => { console.error("Collection report failed", e); if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [range])

  const collected = Number(data?.collected || 0)
  const expected = Number(data?.total_expected || 0)
  const pending = Number(data?.pending || 0)
  const rate = expected > 0 ? (collected / expected) * 100 : 0

  const list: any[] = data?.student_wise_list || []
  const paidCount = list.filter((s) => s.status === "paid").length
  const partialCount = list.filter((s) => s.status === "partial").length
  const unpaidCount = list.filter((s) => s.status === "unpaid").length

  const statusData = [
    { name: "Paid", value: paidCount, key: "paid" },
    { name: "Partial", value: partialCount, key: "partial" },
    { name: "Unpaid", value: unpaidCount, key: "unpaid" },
  ].filter((d) => d.value > 0)

  const defaulters = useMemo(
    () => [...list]
      .filter((s) => Number(s.pending) > 0)
      .sort((a, b) => Number(b.pending) - Number(a.pending))
      .slice(0, 8),
    [list]
  )

  const trend = data?.trend_data || []

  return (
    <div className="space-y-6">
      {/* Header + range selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#274c77] flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-[#6096ba]" />
            Financial Overview{campusName ? ` — ${campusName}` : ""}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Fee collection, outstanding balances and defaulters for your campus.
          </p>
        </div>
        <div className="flex items-end gap-2 flex-wrap no-print">
          <RangeSelect label="From" month={range.fromMonth} year={range.fromYear} years={years}
            onMonth={(m) => setRange((p) => ({ ...p, fromMonth: m }))}
            onYear={(y) => setRange((p) => ({ ...p, fromYear: y }))} />
          <RangeSelect label="To" month={range.toMonth} year={range.toYear} years={years}
            onMonth={(m) => setRange((p) => ({ ...p, toMonth: m }))}
            onYear={(y) => setRange((p) => ({ ...p, toYear: y }))} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading financial data…
        </div>
      ) : (
        <>
          {/* Primary money KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={<Banknote className="h-5 w-5" />} label="Expected"
              value={rs(expected)} sub="Total billed for period" />
            <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} label="Collected"
              value={rs(collected)} tone="good" sub={`${rate.toFixed(1)}% of expected`} />
            <KpiCard icon={<Wallet className="h-5 w-5" />} label="Outstanding"
              value={rs(pending)} tone="danger" sub="Yet to be recovered" />
            <KpiCard icon={<Percent className="h-5 w-5" />} label="Collection Rate"
              value={`${rate.toFixed(0)}%`} tone={rate >= 75 ? "good" : rate >= 50 ? "warn" : "danger"} />
          </div>

          {/* Student count KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={<Users className="h-5 w-5" />} label="Billed Students" value={String(list.length)} />
            <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} label="Fully Paid" value={String(paidCount)} tone="good" />
            <KpiCard icon={<CircleDollarSign className="h-5 w-5" />} label="Partially Paid" value={String(partialCount)} tone="warn" />
            <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="Defaulters" value={String(unpaidCount)} tone="danger" sub="No payment yet" />
          </div>

          {/* Trend + status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border border-gray-100 lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#274c77]">Revenue Trend (12 months)</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gCollected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={TREND_COLLECTED} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={TREND_COLLECTED} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gExpected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={TREND_EXPECTED} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={TREND_EXPECTED} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                    <Tooltip formatter={(v: any) => rs(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="expected" name="Expected" stroke={TREND_EXPECTED} fill="url(#gExpected)" strokeWidth={2} />
                    <Area type="monotone" dataKey="collected" name="Collected" stroke={TREND_COLLECTED} fill="url(#gCollected)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-gray-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#274c77]">Payment Status</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                {statusData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">No fee records for this period.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {statusData.map((d) => <Cell key={d.key} fill={STATUS_COLORS[d.key]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Defaulters table */}
          <Card className="border border-gray-100">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-[#274c77]">Top Outstanding Balances</CardTitle>
              <Link href="/admin/fees" className="text-xs font-semibold text-[#6096ba] hover:text-[#274c77] flex items-center gap-1 no-print">
                Fees Management <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {defaulters.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No outstanding balances 🎉</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                        <th className="px-4 py-2 font-semibold">Student</th>
                        <th className="px-4 py-2 font-semibold">Code</th>
                        <th className="px-4 py-2 font-semibold text-right">Billed</th>
                        <th className="px-4 py-2 font-semibold text-right">Paid</th>
                        <th className="px-4 py-2 font-semibold text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {defaulters.map((s) => (
                        <tr key={s.student_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                          <td className="px-4 py-2.5 font-medium text-gray-700">{s.student_name || "—"}</td>
                          <td className="px-4 py-2.5 text-gray-400">{s.student_code || "—"}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{rs(s.total)}</td>
                          <td className="px-4 py-2.5 text-right text-emerald-600">{rs(s.paid)}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-rose-600">{rs(s.pending)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function RangeSelect({ label, month, year, years, onMonth, onYear }: {
  label: string; month: number; year: number; years: number[]
  onMonth: (m: number) => void; onYear: (y: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
      <div className="flex gap-1">
        <select value={month} onChange={(e) => onMonth(Number(e.target.value))}
          className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => onYear(Number(e.target.value))}
          className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  )
}
