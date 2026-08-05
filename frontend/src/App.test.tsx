import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { App } from './App'

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

describe('App', () => {
  it('показывает состояние загрузки', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => undefined))

    renderApp()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Проверяем связь с сервисом',
    )
  })

  it('показывает готовность backend', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    renderApp()

    expect(await screen.findByText('Сервис готов к работе')).toBeInTheDocument()
  })

  it('показывает ошибку связи и повторяет проверку', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    const user = userEvent.setup()

    renderApp()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось связаться с сервисом',
    )
    await user.click(screen.getByRole('button', { name: 'Повторить проверку' }))

    expect(await screen.findByText('Сервис готов к работе')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
