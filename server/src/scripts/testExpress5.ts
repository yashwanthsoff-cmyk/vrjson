import express from 'express'

const app = express()

app.get('/test', (req, res) => {
  res.json({ ok: true })
})

app.get('/api/test', (req, res) => {
  res.json({ ok: true, path: '/api/test' })
})

app.get('/api/snapshots', (req, res) => {
  res.json({ ok: true, path: '/api/snapshots' })
})

app.listen(8788, () => {
  console.log('Test server on 8788')
})
