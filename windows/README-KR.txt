MultiMeet - Windows 실행 안내
=====================================

MultiMeet.exe 파일 하나만 있으면 됩니다.
데이터베이스(PostgreSQL) 설치는 필요 없습니다.

[준비물]
  - Windows 10/11 64비트
  - OpenAI API 키 (음성인식용, https://platform.openai.com/api-keys)
  - Ollama (번역/회의록 요약용 로컬 LLM, https://ollama.com/download)
  - 여유 디스크 5GB 이상

[1] 실행 방법
  MultiMeet.exe 를 더블클릭합니다.
  검은 명령창이 뜨고, 잠시 후 브라우저가 http://localhost:3001 을 엽니다.
  브라우저가 열리지 않으면 직접 주소를 입력하세요.
  종료하려면 명령창에서 Ctrl+C 를 누르거나 창을 닫습니다.

  최초 실행 시 아래 폴더가 자동으로 만들어집니다.
    C:\Users\<사용자>\AppData\Local\MultiMeet\
        multimeet.db   데이터베이스 (모든 회의 기록)
        uploads\       업로드/녹음한 오디오 파일
        .env           설정 파일
        runtime\       프로그램이 내부적으로 사용하는 파일

  프로그램을 지울 때는 exe와 이 폴더를 함께 삭제하면 됩니다.

[2] 음성 인식(STT) 설정  * 필수
  1. MultiMeet.exe 를 한 번 실행했다가 종료합니다.
     (명령창에 설정 파일 경로가 표시됩니다)
  2. 아래 파일을 메모장으로 엽니다.
       C:\Users\<사용자>\AppData\Local\MultiMeet\.env
  3. OPENAI_API_KEY= 뒤에 발급받은 키를 붙여넣고 저장합니다.
       OPENAI_API_KEY=sk-...
  4. MultiMeet.exe 를 다시 실행합니다.

  포트를 바꾸려면 같은 파일의 PORT 값을 수정하세요.

[3] 번역 / 회의록 요약 설정  * 필수
  번역과 요약은 PC에서 직접 도는 Ollama가 처리합니다. (내용이 외부로 나가지 않음)

  1. https://ollama.com/download 에서 Windows 버전을 설치합니다.
  2. 명령 프롬프트(cmd)에서 모델을 내려받습니다. 약 3GB, 최초 1회만.
       ollama pull gemma3:4b
  3. 설치 후 Ollama는 백그라운드에서 자동 실행됩니다.

  다른 모델을 쓰려면 .env 의 OLLAMA_MODEL 값을 바꾸세요.

[자주 발생하는 문제]

  * "포트 3001 이(가) 이미 사용 중입니다"
    -> MultiMeet가 이미 실행 중입니다. 기존 창을 닫거나
       .env 의 PORT 값을 3100 등으로 바꾸세요.

  * Windows Defender / SmartScreen 경고
    -> 코드 서명이 없어서 나타납니다. "추가 정보" -> "실행"을 선택하세요.

  * 번역 결과가 비어 있음
    -> Ollama가 실행 중인지 확인하세요. 명령창에서: ollama list
       모델이 없으면: ollama pull gemma3:4b

  * 음성 인식이 동작하지 않음
    -> [2] 의 OPENAI_API_KEY 설정을 확인하세요.

  * 마이크가 동작하지 않음
    -> 브라우저 주소창의 자물쇠 아이콘에서 마이크 권한을 허용하세요.
       Chrome 또는 Edge 사용을 권장합니다.

  * 데이터를 다른 PC로 옮기고 싶음
    -> AppData\Local\MultiMeet 폴더를 통째로 복사하세요.
