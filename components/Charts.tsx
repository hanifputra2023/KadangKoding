// Reusable mini SVG line chart for dashboard stat trends
interface MiniChartProps {
  data: number[]
  color?: string
  height?: number
  width?: number
  filled?: boolean
}

export default function MiniChart({
  data,
  color = '#059669',
  height = 40,
  width = 80,
  filled = true,
}: MiniChartProps) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((v, i) => {
    const x = Number(((i / (data.length - 1)) * width).toFixed(3))
    const y = Number((height - ((v - min) / range) * (height - 4) - 2).toFixed(3))
    return `${x},${y}`
  })

  const polyline = points.join(' ')
  const fillPath = `M ${points[0]} L ${points.join(' L ')} L ${width},${height} L 0,${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {filled && (
        <path d={fillPath} fill={color} fillOpacity={0.15} />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Larger chart for dashboard main sections
interface LineChartProps {
  data: { label: string; values: number[] }[]
  labels: string[]
  colors?: string[]
  height?: number
  yMax?: number
}

export function LineChart({ data, labels, colors = ['#059669', '#064e3b'], height = 160 }: LineChartProps) {
  const allValues = data.flatMap(d => d.values)
  const max = Math.max(...allValues) || 1
  const width = 400

  const toX = (i: number) => Number(((i / (labels.length - 1)) * width).toFixed(3))
  const toY = (v: number) => Number((height - (v / max) * (height - 20) - 10).toFixed(3))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
        <line
          key={pct}
          x1={0} y1={height - pct * (height - 20) - 10}
          x2={width} y2={height - pct * (height - 20) - 10}
          stroke="#f1f5f9" strokeWidth="1"
        />
      ))}

      {data.map((series, si) => {
        const pts = series.values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')
        const fillPts = `0,${height} ${series.values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')} ${width},${height}`
        return (
          <g key={si}>
            <polygon points={fillPts} fill={colors[si % colors.length]} fillOpacity={0.1} />
            <polyline points={pts} fill="none" stroke={colors[si % colors.length]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )
      })}
    </svg>
  )
}

// Donut/pie chart
interface DonutChartProps {
  segments: { label: string; value: number; color: string }[]
  size?: number
}

export function DonutChart({ segments, size = 120 }: DonutChartProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  const innerR = size * 0.24

  let currentAngle = -90

  const f = (n: number) => Number(n.toFixed(3))

  const paths = segments.map((seg) => {
    const angle = (seg.value / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const toRad = (deg: number) => (deg * Math.PI) / 180
    const x1 = f(cx + r * Math.cos(toRad(startAngle)))
    const y1 = f(cy + r * Math.sin(toRad(startAngle)))
    const x2 = f(cx + r * Math.cos(toRad(endAngle)))
    const y2 = f(cy + r * Math.sin(toRad(endAngle)))
    const ix1 = f(cx + innerR * Math.cos(toRad(startAngle)))
    const iy1 = f(cy + innerR * Math.sin(toRad(startAngle)))
    const ix2 = f(cx + innerR * Math.cos(toRad(endAngle)))
    const iy2 = f(cy + innerR * Math.sin(toRad(endAngle)))

    const largeArc = angle > 180 ? 1 : 0

    const d = [
      `M ${ix1} ${iy1}`,
      `L ${x1} ${y1}`,
      `A ${f(r)} ${f(r)} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${f(innerR)} ${f(innerR)} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      'Z'
    ].join(' ')

    return { d, color: seg.color }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} />
      ))}
    </svg>
  )
}
