import { createApp } from '../app.js'
import { MemoryStore } from '../store/MemoryStore.js'

async function listRoutes() {
  const store = new MemoryStore()
  const app = createApp(store)

  console.log('=== Registered Routes ===')
  console.log('')

  // Express 5 uses app.router.stack instead of app._router.stack
  const stack = (app as any).router?.stack || (app as any)._router?.stack || []

  if (!stack || stack.length === 0) {
    console.log('No routes found in stack')
    return
  }

  stack.forEach((layer: any, index: number) => {
    if (layer.name === 'bound dispatch') {
      console.log(`[${index}] Method: ${layer.method || 'GET'} Path: ${layer.path || layer.route?.path || '(root)'}`)
    } else if (layer.name === 'router') {
      console.log(`[${index}] Router: ${layer.regexp || '(nested)'}`)
    } else if (layer.route) {
      const methods = Object.keys(layer.route.methods).filter((m: string) => layer.route.methods[m]).join(', ')
      console.log(`[${index}] Route: ${methods} ${layer.route.path}`)
    } else {
      console.log(`[${index}] Layer: ${layer.name || '(anonymous)'} Path: ${layer.path || '(root)'}`)
    }
  })
}

listRoutes().catch(console.error)
