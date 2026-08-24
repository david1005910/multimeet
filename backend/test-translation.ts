import 'dotenv/config';
import { claudeService } from './src/services/claude.service';

async function testTranslations() {
  console.log('🧪 번역 기능 테스트 시작...\n');
  
  // Test cases for different languages
  const testCases = [
    {
      language: 'en',
      text: 'Hello, this is a test message for our meeting translation system.',
      description: '영어 → 한국어'
    },
    {
      language: 'zh',
      text: '你好，这是我们会议翻译系统的测试消息。',
      description: '중국어 → 한국어'
    },
    {
      language: 'vi',
      text: 'Xin chào, đây là tin nhắn thử nghiệm cho hệ thống dịch cuộc họp của chúng tôi.',
      description: '베트남어 → 한국어'
    }
  ];

  // Test foreign to Korean translations
  console.log('=== 외국어 → 한국어 번역 테스트 ===\n');
  for (const testCase of testCases) {
    console.log(`📝 ${testCase.description}`);
    console.log(`원문: ${testCase.text}`);
    
    try {
      const startTime = Date.now();
      const translated = await claudeService.translate(testCase.text, testCase.language);
      const elapsed = Date.now() - startTime;
      
      console.log(`번역: ${translated}`);
      console.log(`소요 시간: ${elapsed}ms\n`);
    } catch (error) {
      console.error(`❌ 번역 실패:`, error);
      console.log('\n');
    }
  }

  // Test Korean to foreign translations
  const koreanTestCases = [
    {
      targetLanguage: 'en',
      text: '안녕하세요, 이것은 회의 번역 시스템 테스트 메시지입니다.',
      description: '한국어 → 영어'
    },
    {
      targetLanguage: 'zh',
      text: '다음 주에 상하이에서 미팅이 있습니다.',
      description: '한국어 → 중국어'
    },
    {
      targetLanguage: 'vi',
      text: '베트남 시장 진출 전략을 논의해야 합니다.',
      description: '한국어 → 베트남어'
    }
  ];

  console.log('=== 한국어 → 외국어 번역 테스트 ===\n');
  for (const testCase of koreanTestCases) {
    console.log(`📝 ${testCase.description}`);
    console.log(`원문: ${testCase.text}`);
    
    try {
      const startTime = Date.now();
      const translated = await claudeService.translateFromKorean(testCase.text, testCase.targetLanguage);
      const elapsed = Date.now() - startTime;
      
      console.log(`번역: ${translated}`);
      console.log(`소요 시간: ${elapsed}ms\n`);
    } catch (error) {
      console.error(`❌ 번역 실패:`, error);
      console.log('\n');
    }
  }

  console.log('✅ 번역 테스트 완료!');
}

// Run tests
testTranslations().catch(console.error);