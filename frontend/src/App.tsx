import { useQuery } from '@tanstack/react-query'

import './styles.css'

type ReadyResponse = {
  status: 'ok'
}

async function fetchReadiness(): Promise<ReadyResponse> {
  const response = await fetch('/api/v1/ready', {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`readiness returned ${response.status}`)
  }

  const body = (await response.json()) as Partial<ReadyResponse>
  if (body.status !== 'ok') {
    throw new Error('unexpected readiness response')
  }
  return { status: body.status }
}

export function App() {
  const readiness = useQuery({
    queryKey: ['backend-readiness'],
    queryFn: fetchReadiness,
    retry: false,
    staleTime: 10_000,
  })

  return (
    <main className="page-shell">
      <section className="readiness-card" aria-labelledby="page-title">
        <div className="brand" aria-label="Авито">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>Авито</span>
        </div>

        <div className="eyebrow">Демо-стенд</div>
        <h1 id="page-title">Честная очередь</h1>
        <p className="lead">
          Каркас сервиса запущен. Проверяем, готов ли backend к сквозному
          сценарию.
        </p>

        {readiness.isPending ? (
          <div className="state state-loading" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <div>
              <strong>Проверяем связь с сервисом</strong>
              <span>Это займёт несколько секунд.</span>
            </div>
          </div>
        ) : null}

        {readiness.isSuccess ? (
          <div className="state state-ready" role="status" aria-live="polite">
            <span className="state-icon" aria-hidden="true">
              ✓
            </span>
            <div>
              <strong>Сервис готов к работе</strong>
              <span>API и PostgreSQL отвечают штатно.</span>
            </div>
          </div>
        ) : null}

        {readiness.isError ? (
          <div className="state state-error" role="alert">
            <span className="state-icon" aria-hidden="true">
              !
            </span>
            <div>
              <strong>Не удалось связаться с сервисом</strong>
              <span>Проверьте запуск backend и попробуйте снова.</span>
              <button
                type="button"
                onClick={() => void readiness.refetch()}
                disabled={readiness.isFetching}
              >
                {readiness.isFetching ? 'Проверяем…' : 'Повторить проверку'}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
