import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// API Route（サーバー）専用のSupabaseクライアント。
// 環境変数が未設定でもビルド・起動時に例外を投げず、呼び出し側でnullチェックして
// DB連携を安全にスキップできるようにする（Supabaseはオプショナル機能のため）
export function createClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createSupabaseClient(url, anonKey)
}
