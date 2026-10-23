import { staticApi } from './staticApi'
import { createHttpApi } from './httpApi'

export const api = import.meta.env.VITE_API_MODE === 'http' ? createHttpApi() : staticApi
export type ApiClient = typeof api
