import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('menu board mode selector', () => {
  it('renders both board modes with the classic mode selected by default', () => {
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('8 × 8')
    expect(html).toContain('10 × 10')
    expect(html).toContain('經典模式')
    expect(html).toContain('擴充模式')
    expect(html).toContain('選擇棋盤模式')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(1)
  })
})
