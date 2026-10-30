import sourcesRaw from '../../generated/sources.json'
import type { SourcesFile } from '../../sources/types'

export const sources = sourcesRaw as unknown as SourcesFile
