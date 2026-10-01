import type { CSSProperties } from 'react'
import type { ModelEvaluation } from '../ai/client'

export default function EvaluationBar({ evaluation, loading, error }: {
  evaluation: ModelEvaluation | null
  loading: boolean
  error: string | null
}) {
  const score = evaluation ? Math.max(0, Math.min(100, evaluation.expectedScore * 100)) : 50
  const rounded = Math.round(score)
  const trackStyle = { '--evaluation-share': `${score}%` } as CSSProperties
  const description = evaluation
    ? `You ${rounded}% expected result; Drew ${100 - rounded}%. ` +
      `Model outcomes: ${Math.round(evaluation.win * 100)}% win, ` +
      `${Math.round(evaluation.draw * 100)}% draw, ${Math.round(evaluation.loss * 100)}% loss for you.`
    : 'Evaluation is loading.'

  return <aside className="evaluation-rail" aria-label="Model evaluation">
    <span className="evaluation-player evaluation-drew">Drew</span>
    <div className="evaluation-track" style={trackStyle} role="meter"
      aria-label="Your expected result" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={evaluation ? rounded : undefined} aria-valuetext={description}
      title={description}>
      <div className="evaluation-you-fill" />
      <span className="evaluation-midpoint" aria-hidden="true" />
    </div>
    <span className="evaluation-player evaluation-human">You</span>
    <strong className="evaluation-number">{evaluation ? `${rounded}%` : '—'}</strong>
    <small className="evaluation-detail">{error ? 'Evaluation unavailable' : loading ? 'Updating…' : evaluation?.final ? 'Final result' : 'Model estimate'}</small>
  </aside>
}
