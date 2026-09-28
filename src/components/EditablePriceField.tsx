"use client";

import { useState, type ReactNode } from "react";
import { formatYen, parsePriceInput } from "@/utils/price";

interface EditablePriceFieldProps {
  label: string;
  labelClassName: string;
  containerClassName: string;
  valueClassName: string;
  emptyLabel: string;
  value: number | null;
  // 表示モードの「編集」ボタンの左に出す補助表示（定価の「公式照合済み」「手動入力」など）
  badge?: ReactNode;
  editButtonClassName: string;
  placeholder: string;
  helpText: ReactNode;
  // 保存処理。成功したらtrueを返す（trueなら編集モードを閉じ、falseならエラー表示にする）
  onSave: (price: number | null) => Promise<boolean>;
}

// 金額の「表示⇔編集」切り替え欄。入力の検証・保存中/エラーの状態管理までを持つ。
// 空欄で保存すると未入力（null）に戻せる
export function EditablePriceField({
  label,
  labelClassName,
  containerClassName,
  valueClassName,
  emptyLabel,
  value,
  badge,
  editButtonClassName,
  placeholder,
  helpText,
  onSave,
}: EditablePriceFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  const handleStartEdit = () => {
    setInput(value?.toString() ?? "");
    setStatus("idle");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setStatus("idle");
    setIsEditing(false);
  };

  const handleSave = async () => {
    const parsed = parsePriceInput(input);
    if (!parsed.ok) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    const ok = await onSave(parsed.price);
    if (ok) {
      setStatus("idle");
      setIsEditing(false);
    } else {
      setStatus("error");
    }
  };

  return (
    <div className={`p-4 ${containerClassName}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={labelClassName}>{label}</span>
        {!isEditing && (
          <div className="flex items-center gap-1.5 shrink-0">
            {badge}
            <button onClick={handleStartEdit} className={editButtonClassName}>
              編集
            </button>
          </div>
        )}
      </div>

      {!isEditing &&
        (value !== null ? (
          <span className={`text-2xl font-normal mt-1 block tabular-nums ${valueClassName}`}>
            {formatYen(value)}
          </span>
        ) : (
          <span className="text-sm text-gray-400 mt-1 block">{emptyLabel}</span>
        ))}

      {isEditing && (
        <div className="mt-1">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none">
                ¥
              </span>
              <input
                type="number"
                inputMode="numeric"
                autoFocus
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setStatus("idle");
                }}
                placeholder={placeholder}
                className="w-full text-2xl font-normal text-gray-900 pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={status === "saving"}
              className="shrink-0 self-center text-sm font-bold px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 active:bg-gray-100 transition disabled:opacity-50"
            >
              保存
            </button>
            <button
              onClick={handleCancel}
              disabled={status === "saving"}
              className="shrink-0 self-center text-sm font-bold px-3 py-2 rounded-lg text-gray-400 active:bg-gray-100 transition disabled:opacity-50"
            >
              取消
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5">{helpText}</p>
          {status === "error" && (
            <p className="text-[11px] text-red-600 mt-1">保存に失敗しました。もう一度お試しください</p>
          )}
        </div>
      )}
    </div>
  );
}
