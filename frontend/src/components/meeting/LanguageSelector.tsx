interface Props {
  value: string
  onChange: (value: string) => void
}

const languages = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'en', label: '영어', flag: '🇺🇸' },
  { code: 'zh', label: '중국어', flag: '🇨🇳' },
  { code: 'vi', label: '베트남어', flag: '🇻🇳' },
]

export default function LanguageSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-3">
      {languages.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => onChange(lang.code)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl transition-all"
          style={{
            background: value === lang.code ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.06)',
            border: value === lang.code ? '2px solid rgba(255,255,255,0.55)' : '2px solid rgba(255,255,255,0.15)',
            color: value === lang.code ? '#ffffff' : 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <span className="text-xl">{lang.flag}</span>
          <span className="font-medium">{lang.label}</span>
        </button>
      ))}
    </div>
  )
}
