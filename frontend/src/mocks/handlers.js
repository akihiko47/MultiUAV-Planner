import { http, HttpResponse } from 'msw'
import planResponse from './fixtures/planResponse.json'

export const handlers = [
  http.post('*/api/v1/plan', async ({ request }) => {
    const body = await request.json()
    console.log('[MSW] POST /api/v1/plan, payload:', body)

    await new Promise((r) => setTimeout(r, 1500))

    return HttpResponse.json(planResponse)
  }),
]