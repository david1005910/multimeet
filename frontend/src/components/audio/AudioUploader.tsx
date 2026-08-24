import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'

interface Props {
  onFileSelected: (file: File) => void
}

export default function AudioUploader({ onFileSelected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFile = (file: File) => {
    setSelectedFile(file)
    onFileSelected(file)
  }

  return (
    <div
      className="p-8 text-center cursor-pointer transition-all"
      style={{
        background: dragOver ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.12)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '20px',
        border: dragOver
          ? '2px dashed rgba(167,139,250,0.8)'
          : '2px dashed rgba(255,255,255,0.2)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.20), inset 0 0 12px rgba(255,255,255,0.06)',
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
      }}
    >
      <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
      {selectedFile ? (
        <p className="font-medium" style={{ color: '#a78bfa' }}>{selectedFile.name}</p>
      ) : (
        <>
          <p className="font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>파일을 여기에 드래그하거나 클릭하여 선택</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>MP3, MP4, WAV, M4A, WebM (최대 200MB)</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="audio/*,video/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
