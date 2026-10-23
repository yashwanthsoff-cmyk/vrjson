import { useState } from 'react'
import { api } from '../../api/index'
import type { DriftSummaryResult } from '../../types/f02Extra'

interface DriftSummaryCardProps {
  userId: string
  fromDate: string
  toDate: string
}

export function DriftSummaryCard({ userId, fromDate, toDate }: DriftSummaryCardProps) {
  const [result, setResult] = useState<DriftSummaryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const summary = await api.getDriftSummary(userId, fromDate, toDate) as DriftSummaryResult
      setResult(summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drift summary')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="skeleton" style={{ height: 100 }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>Drift Summary</h3>
        </div>
        <div className="card-body">
          <p className="error">{error}</p>
          <button onClick={fetchSummary}>Retry</button>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>Drift Summary</h3>
        </div>
        <div className="card-body">
          <button onClick={fetchSummary}>Summarize drift</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Drift Summary</h3>
        <span className="badge">{result.label}</span>
      </div>
      <div className="card-body">
        {result.fallbackUsed && (
          <div className="banner warning">
            Using template fallback (model unavailable or validation failed)
          </div>
        )}
        {result.cached && (
          <div className="banner info">
            Cached result
          </div>
        )}
        <div className="validation-badge">
          Claims linked to evidence: {result.validation.claimsLinked}/{result.validation.totalClaims}
        </div>
        <div className="sentences">
          {result.sentences.map((sentence, idx) => (
            <div key={idx} className="sentence">
              <p>{sentence.text}</p>
              {sentence.evidenceIds.length > 0 && (
                <div className="evidence-chips">
                  {sentence.evidenceIds.map(evidId => (
                    <span key={evidId} className="chip">{evidId}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
