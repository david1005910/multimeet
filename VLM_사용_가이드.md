# 🖼️ VLM (Vision Language Model) 전환 가이드

## 📋 개요
MultiMeet을 LLM에서 VLM으로 전환하여 **이미지 + 텍스트 동시 처리** 가능하게 만들 수 있습니다.

## 🚀 VLM으로 전환 가능한 기능들

### 1. 📸 회의 사진 분석 + 회의록 생성
```javascript
// 화이트보드, 슬라이드 사진과 음성을 함께 분석
const minutes = await vlmService.generateMinutesWithImages(
  transcript,
  meetingInfo,
  ['whiteboard.jpg', 'slide1.png']
);
```

### 2. 🌏 시각 자료 번역
```javascript
// 외국어 프레젠테이션 슬라이드를 이미지로 분석하여 번역
const result = await vlmService.translateWithImage(
  "Let's review the Q4 projections",
  "en",
  "presentation_slide.jpg"
);
```

### 3. 📄 문서 OCR + 번역
```javascript
// 촬영한 문서를 텍스트로 변환하고 번역
const { originalText, translatedText } = await vlmService.ocrAndTranslate(
  "chinese_contract.jpg",
  "ko"
);
```

### 4. 🎥 회의 장면 분석
```javascript
// 회의 장면 사진으로 참석자, 분위기, 화이트보드 내용 분석
const analysis = await vlmService.analyzeMeetingScene("meeting_photo.jpg");
```

## 🛠️ 설치 방법

### 1단계: VLM 모델 다운로드
```bash
# LLaVA (추천 - 가장 인기 있는 오픈소스 VLM)
ollama pull llava:7b      # 4.5GB
ollama pull llava:13b     # 8GB (더 정확함)

# 경량 옵션
ollama pull llava-phi3    # 2.9GB (빠르지만 정확도 낮음)
ollama pull bakllava      # 4.5GB (LLaVA 변형)
```

### 2단계: 환경 변수 설정
```bash
# backend/.env
VLM_MODEL="llava:7b"  # 또는 다운로드한 다른 모델
OLLAMA_URL="http://localhost:11434"
```

### 3단계: 코드 적용
```typescript
// backend/src/services/claude.service.ts를 vlm.service.ts로 교체
import { vlmService } from './services/vlm.service';

// 기존 텍스트 전용 번역
const translated = await claudeService.translate(text, 'en');

// VLM 이미지 + 텍스트 번역
const translated = await vlmService.translateWithImage(text, 'en', imagePath);
```

## 🎯 활용 사례

### 사례 1: 화이트보드 회의
1. 회의 중 화이트보드 사진 촬영
2. 음성 녹음과 함께 처리
3. VLM이 다이어그램과 음성을 통합 분석
4. 시각 자료가 포함된 상세한 회의록 생성

### 사례 2: 국제 화상회의
1. 외국어 프레젠테이션 화면 캡처
2. 발표자 음성과 슬라이드 동시 번역
3. 차트와 그래프 설명 자동 번역
4. 완전한 한국어 회의록 생성

### 사례 3: 계약서 검토 회의
1. 외국어 계약서 사진 촬영
2. OCR로 텍스트 추출 + 번역
3. 논의 내용 음성 녹음
4. 계약 조항과 논의 사항 통합 회의록

## ⚡ 성능 비교

| 모델 | 크기 | 텍스트 속도 | 이미지 처리 | 정확도 | 용도 |
|------|------|------------|------------|---------|------|
| gemma3:4b (LLM) | 3.3GB | 15-20초 | ❌ | ⭐⭐⭐ | 텍스트 전용 |
| llava-phi3 | 2.9GB | 10-15초 | ✅ | ⭐⭐ | 빠른 처리 |
| llava:7b | 4.5GB | 20-30초 | ✅ | ⭐⭐⭐ | 균형잡힌 선택 |
| llava:13b | 8GB | 30-45초 | ✅ | ⭐⭐⭐⭐ | 고정밀도 |

## 🔄 마이그레이션 전략

### 점진적 전환 (권장)
```typescript
// 설정으로 LLM/VLM 선택 가능하게
const USE_VLM = process.env.USE_VLM === 'true';

if (USE_VLM && hasImages) {
  return vlmService.translateWithImage(text, lang, image);
} else {
  return claudeService.translate(text, lang);
}
```

### 하이브리드 접근
- 텍스트 전용: 빠른 LLM (gemma3)
- 이미지 포함: VLM (llava)
- 자동 라우팅으로 최적 성능

## 📊 실제 구현 예시

### 회의록 컨트롤러 수정
```typescript
// backend/src/controllers/audio.controller.ts
async generateMinutes(req: AuthRequest, res: Response) {
  const { meetingId } = req.params;
  const images = req.files as Express.Multer.File[];
  
  const meeting = await meetingService.getMeetingById(meetingId);
  const transcript = JSON.parse(meeting.transcript);
  
  // 이미지가 있으면 VLM, 없으면 LLM
  const generator = images?.length > 0
    ? vlmService.generateMinutesWithImages(
        transcript, 
        meeting,
        images.map(img => img.path)
      )
    : claudeService.generateMinutes(transcript, meeting);
    
  for await (const chunk of generator) {
    res.write(chunk);
  }
  res.end();
}
```

### 프론트엔드 이미지 업로드 추가
```tsx
// frontend/src/components/meeting/ImageUploader.tsx
const ImageUploader = ({ onUpload }) => {
  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    onUpload(files);
  };
  
  return (
    <div className="border-2 border-dashed p-4">
      <input 
        type="file" 
        accept="image/*" 
        multiple 
        onChange={handleUpload}
      />
      <p>화이트보드, 슬라이드 사진을 추가하세요</p>
    </div>
  );
};
```

## ⚠️ 주의사항

1. **모델 크기**: VLM은 LLM보다 크고 느림
2. **GPU 권장**: CPU만으로는 매우 느릴 수 있음
3. **이미지 크기**: 큰 이미지는 리사이즈 필요
4. **메모리 사용**: 이미지 처리 시 RAM 사용량 증가

## 🎉 결론

VLM으로 전환하면:
- ✅ 시각 자료 자동 분석
- ✅ 더 풍부한 회의록 생성
- ✅ OCR 기능 내장
- ✅ 멀티모달 번역 가능

기존 LLM 기능은 그대로 유지하면서 이미지 처리 능력을 추가할 수 있어, 더 강력한 회의 지원 시스템을 구축할 수 있습니다.