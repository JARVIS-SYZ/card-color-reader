# FLIPSIDE — 카드 컬러 리더

휴대폰에서 카드 사진을 촬영하거나 가져온 후, 기준 카드 바로 오른쪽부터 끝까지 실제 색의 반대 색을 표시하는 웹앱입니다.

## 실행

Node.js 22.13 이상.

```sh
npm ci
npm run dev
```

## GitHub Pages 배포

```sh
npm run deploy:prepare
git add src public tests scripts index.html package.json package-lock.json tsconfig.json vite.config.ts postcss.config.mjs README.md .gitignore docs
git commit -m "Update card reader"
git push origin main
```

Pages의 source는 main 브랜치의 /docs 폴더입니다. npm run deploy:prepare는 테스트/타입검사/빌드 후 정적 결과를 docs에 복사합니다. 별도의 서버나 API 키가 필요하지 않습니다. 저장소 이름을 변경하면 vite.config.ts의 base도 수정해야 합니다.

## 실기기 테스트

배포된 HTTPS 주소를 iPhone Safari 또는 Android Chrome으로 엽니다. 사진 촬영/사진 가져오기 → 카드 인식하기 → 누락·문양·순서 확인/수정 → 이 배열이 맞아요 → 기준 카드 입력 → 찾기. 파일 선택기의 카메라 제공 여부는 기기/브라우저에 따라 다릅니다.

예제로 체험 버튼으로 사진 없이 결과 화면을 테스트할 수 있습니다. 마지막 카드 입력, 없는 카드 입력, 중복 카드, 카드 수정 후 재확인도 확인해 주세요.

## 현재 한계

사진 인식은 브라우저 안에서 처리합니다. 카드 왼쪽 위 모서리(숫자 + 바로 아래 작은 문양)를 모양으로 찾고, 문양 색·모양으로 무늬를, 글자 구멍 모양과 Tesseract.js로 숫자를 판정합니다. 부채꼴로 겹친 35장 실사진에서 35장 모두 정확히 읽었고, 멀리서 찍거나 기울어진 사진에서는 일부 오인식이 있어 확인·수정 단계가 필요합니다.

사진과 입력 배열은 브라우저 메모리에만 저장하며 서버로 전송하지 않습니다. 새로 고침하면 사라집니다. 유료 인식 API는 호출하지 않습니다. 첫 인식 때 인식용 정적 파일 다운로드가 필요합니다. 완전한 오프라인 앱은 아닙니다.

하루 사진 10,000장은 최대 규모 요구이며, 이 규모의 실측 성능을 보장한다는 의미는 아닙니다. 실제 휴대폰 성능 테스트는 사용자의 기기에서 진행해야 합니다.

사용자 제공 원본 사진·개인 파일·API 키는 저장소에 포함하지 않습니다.

## 라이선스 고지

OCR 구성요소와 영어 인식 모델은 Apache-2.0 라이선스를 따릅니다. public/ocr의 라이선스 파일을 참고하세요.

- https://github.com/naptha/tesseract.js
- https://github.com/naptha/tesseract.js-core
- https://github.com/tesseract-ocr/tessdata_fast
