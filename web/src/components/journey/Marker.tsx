import type { HandoverEvent } from '../../journey/types'

/** Handover glyph; shape differs per type so color is never the only cue. */
export function MarkerShape({ type, x, y }: { type: HandoverEvent['type']; x: number; y: number }) {
  const cls = `j-mk j-mk-${type}`
  switch (type) {
    case 'sale':
      return <circle className={cls} cx={x} cy={y} r={5} />
    case 'gift':
      return <rect className={cls} x={x - 4.5} y={y - 4.5} width={9} height={9} />
    case 'seizure':
      return <path className={cls} d={`M${x} ${y - 7}L${x + 7} ${y + 6}H${x - 7}z`} />
    case 'restitution':
      return <path className={cls} d={`M${x} ${y - 7}L${x + 7} ${y}L${x} ${y + 7}L${x - 7} ${y}z`} />
    case 'custody':
      return <circle className={cls} cx={x} cy={y} r={5} />
  }
}
