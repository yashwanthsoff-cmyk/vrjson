import { staticApi } from './staticApi'
import { createHttpApi } from './httpApi'

// Default to HTTP mode unless explicitly set to 'static'
export const api = import.meta.env.VITE_API_MODE === 'static' ? staticApi : createHttpApi()
export type ApiClient = typeof api
