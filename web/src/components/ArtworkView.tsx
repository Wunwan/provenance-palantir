import type { ArtworkViewProps } from '../types'

/** STUB: replaced by the artwork-view agent. */
export default function ArtworkView({ artworkId, onBack }: ArtworkViewProps) {
  return (
    <main>
      <button onClick={onBack}>Back</button>
      <p>{artworkId}</p>
    </main>
  )
}
