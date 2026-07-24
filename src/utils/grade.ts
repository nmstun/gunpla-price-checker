export type Grade = 'HG' | 'RG' | 'MG' | 'PG' | 'SD' | 'EG' | 'FM'
export type GradeFilter = Grade | 'その他'

// 判定対象のグレード表記。HGUC/HGCE等のサブブランドやMGEX/MGSD等も、
// いずれも先頭が"HG"/"MG"で始まるため、この2文字プレフィックスのみで
// 十分に判定できる（絞り込み用途であり、bandaiHobby.tsのようにサブブランドを
// 区別して除去する必要が無いため）
const GRADE_PREFIXES: Grade[] = ['HG', 'RG', 'MG', 'PG', 'SD', 'EG', 'FM']

// 商品名の先頭グレード表記からグレードを判定する。該当しなければ「その他」
export function detectGrade(itemName: string): GradeFilter {
  const normalized = itemName.trim().toUpperCase()
  for (const grade of GRADE_PREFIXES) {
    if (normalized.startsWith(grade)) return grade
  }
  return 'その他'
}
