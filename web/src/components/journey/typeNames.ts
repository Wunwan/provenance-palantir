import type { HandoverEvent } from '../../journey/types'

export const TYPE_NAME: Record<HandoverEvent['type'], string> = {
  sale: 'Sale',
  gift: 'Gift or inheritance',
  seizure: 'Seizure',
  custody: 'Recovered into custody',
  restitution: 'Restitution',
}
