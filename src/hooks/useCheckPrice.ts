'use client'

import { useCallback, useState } from 'react'
import { CheckPriceResult } from '@/types'

// スキャンしたJANコードを渡すと価格チェックAPIを呼び出す
export function useCheckPrice() {
  const [result, setResult] = useState<CheckPriceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkPrice = useCallback(async (janCode: string, storeName: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/check-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ janCode, storeName }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '価格の取得に失敗しました')
      }

      setResult(data as CheckPriceResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : '価格の取得に失敗しました')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, loading, error, checkPrice, reset }
}
