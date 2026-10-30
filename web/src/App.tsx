import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navbar, Button } from '@blueprintjs/core'
import '@blueprintjs/core/lib/css/blueprint.css'
import raw from './generated/evidence.json'
import type { EvidenceModel } from './generated/contract'
import type { Decision } from './types'
import { derive } from './derive'
import { loadFocus, saveFocus, type FocusPeriod } from './focus'
import FocusMenu from './components/FocusMenu'
import { loadDecisions, saveDecisions } from './store'
import DemoView from './components/DemoView'
import ArtworkView from './components/ArtworkView'
import CollectionView from './components/CollectionView'
import SourcesView from './components/SourcesView'
import SourceDetail from './components/sources/SourceDetail'
import DraftDetail from './components/sources/DraftDetail'
import AddSourceFlow from './components/sources/AddSourceFlow'
import { addDraft, deleteDraft, loadDrafts } from './sources/draftStore'
import type { DraftSource } from './sources/types'

const model = raw as unknown as EvidenceModel

type View = { name: 'collection' } | { name: 'artwork'; id: string } | { name: 'sources' }
  | { name: 'source'; id: string }
  | { name: 'draft'; id: string }
  | { name: 'add' }
  | { name: 'demo' }

/** Blueprint themes its own components with a class; dark is the default, matching the palette tokens. */
function useBlueprintDark() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => document.body.classList.toggle('bp6-dark', !query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])
}

export default function App() {
  useBlueprintDark()
  const [view, setView] = useState<View>({ name: 'collection' })
  const [decisions, setDecisions] = useState<Decision[]>(loadDecisions)
  const [drafts, setDrafts] = useState<DraftSource[]>(loadDrafts)
  const [focus, setFocus] = useState<FocusPeriod | null>(loadFocus)
  const derived = useMemo(() => derive(model, decisions, focus), [decisions, focus])
  const changeFocus = useCallback((f: FocusPeriod | null) => {
    setFocus(f)
    saveFocus(f)
  }, [])

  const onDecide = useCallback((d: Omit<Decision, 'id' | 'at'>) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `d-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const at = new Date().toISOString()
    setDecisions((prev) => [...prev, { id, at, ...d }])
  }, [])
  useEffect(() => {
    saveDecisions(decisions)
  }, [decisions])

  const goCollection = () => setView({ name: 'collection' })
  const goSources = () => setView({ name: 'sources' })
  const openArtwork = (id: string) => setView({ name: 'artwork', id })

  return (
    <>
      <Navbar className="app-nav">
        <div className="app-nav-inner">
          <Navbar.Heading className="app-title">Provenance project</Navbar.Heading>
          <div className="app-nav-items">
            <Button
              minimal
              text="Collection"
              active={['collection', 'artwork'].includes(view.name)}
              onClick={goCollection}
            />
            <Button
              minimal
              text="Sources"
              active={!['collection', 'artwork', 'demo'].includes(view.name)}
              onClick={goSources}
            />
            <Button minimal text="Demo scenario" active={view.name === 'demo'} onClick={() => setView({ name: 'demo' })} />
          </div>
          <FocusMenu value={focus} onChange={changeFocus} />
        </div>
      </Navbar>
      {view.name === 'collection' && (
        <CollectionView
          model={model}
          derived={derived}
          focus={focus}
          onSelect={(id) => setView({ name: 'artwork', id })}
        />
      )}
      {view.name === 'artwork' && (
        <ArtworkView
          model={model}
          artworkId={view.id}
          derived={derived}
          focus={focus}
          decisions={decisions}
          onDecide={onDecide}
          onBack={goCollection}
        />
      )}
      {view.name === 'demo' && <DemoView onBack={goCollection} focus={focus} />}
      {view.name === 'sources' && (
        <SourcesView
          model={model}
          drafts={drafts}
          onOpenSource={(id) => setView({ name: 'source', id })}
          onOpenDraft={(id) => setView({ name: 'draft', id })}
          onAdd={() => setView({ name: 'add' })}
        />
      )}
      {view.name === 'source' && (
        <SourceDetail model={model} id={view.id} onBack={goSources} onOpenArtwork={openArtwork} />
      )}
      {view.name === 'draft' && (
        <DraftDetail
          draft={drafts.find((d) => d.id === view.id)}
          onBack={goSources}
          onDelete={(id) => {
            setDrafts(deleteDraft(id))
            goSources()
          }}
        />
      )}
      {view.name === 'add' && (
        <AddSourceFlow
          model={model}
          onClose={goSources}
          onSaveDraft={(d) => {
            setDrafts(addDraft(d))
            goSources()
          }}
          onOpenArtwork={openArtwork}
        />
      )}
    </>
  )
}
