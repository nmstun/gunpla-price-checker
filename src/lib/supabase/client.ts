'use client'

import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// クライアントコンポーネント（ブラウザ）から使うSupabaseクライアント。
// 環境変数が未設定でも例外を投げず、呼び出し側でnullチェックしてスキップできるようにする
export function createClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createSupabaseClient(url, anonKey)
}
