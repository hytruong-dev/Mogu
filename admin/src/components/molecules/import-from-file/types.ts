export type Phase = 'upload' | 'mapping' | 'validate' | 'confirm' | 'progress' | 'complete'

export interface UploadedFileInfo {
  name: string
  sizeLabel: string
  sizeBytes: number
  csvText?: string
}

export type MapStatus = 'mapped' | 'check' | 'skip'

export interface MappingRow {
  id: string
  fileCol: string
  sample: string
  moguField: string
  status: MapStatus
}

export interface MoguField {
  id: string
  label: string
  required?: boolean
  aliases: string[]
}

export type IssueKind = 'error' | 'warning' | 'duplicate' | 'valid'

export interface IssueRow {
  id: string
  row: number
  dishName: string
  field: string
  currentValue: string
  problem: string
  kind: IssueKind
  fixType: 'input' | 'select'
  fixValue: string
  fixOptions?: { value: string; label: string }[]
}

export type DuplicatePolicy = 'skip' | 'update' | 'draft'
export type PostStatus = 'draft' | 'review'
export type NewIngredientPolicy = 'create' | 'skip'
export type ErrorPolicy = 'rollback' | 'keep'

export type ValidateTab = 'all' | 'error' | 'warning' | 'duplicate' | 'valid'
export type CompleteTab = 'overview' | 'warning' | 'excluded' | 'log'

export interface PreviewRow {
  id: string
  cells: string[]
}

export interface ProgressLog {
  time: string
  title: string
  detail?: string
  status: 'done' | 'running' | 'pending'
}

export interface ProgressStep {
  n: number
  label: string
  sub: string
  state: 'done' | 'running' | 'pending'
}

export interface ImportOptions {
  firstRowIsHeader: boolean
  autoMap: boolean
  sheet: string
  duplicatePolicy: DuplicatePolicy
  updateEmptyOnly: boolean
  postStatus: PostStatus
  downloadImages: boolean
  keepUrlOnFail: boolean
  createDishSource: boolean
  newIngredientPolicy: NewIngredientPolicy
  errorPolicy: ErrorPolicy
  confirmed: boolean
  autoOpenResult: boolean
}
