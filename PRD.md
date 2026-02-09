# Product Requirements Document (PRD): Auto Tab Grouper

## 1. Product Overview
* **Product Name:** Auto Tab Grouper (Project ATG)
* **Type:** Chrome Browser Extension (Manifest V3)
* **Objective:** 사용자가 지정한 도메인 규칙에 따라 브라우저 탭을 자동으로 특정 '탭 그룹(Tab Group)'으로 분류하여 브라우징 환경을 체계화한다.
* **Value Proposition:** 수동으로 탭을 정리할 필요 없이, 접속하는 도메인에 맞춰 실시간으로 탭 그룹이 생성 및 할당되어 작업 효율성을 극대화한다.

---

## 2. User Flows

### 2.1. 설정 흐름 (Setup Flow)
1.  사용자가 확장 프로그램의 **Options Page**를 연다.
2.  **Global Toggle**을 활성화한다.
3.  'Add New Rule' 버튼을 클릭하고 다음 정보를 입력한다.
    * **Domain (Host):** 매칭할 정확한 호스트명 (예: `github.com`)
    * **Group Name:** 그룹 표시 이름 (예: `Development`)
    * **Color:** 크롬 지원 색상 중 선택
4.  저장 시 규칙 리스트에 즉시 반영되며 `chrome.storage`에 동기화된다.

### 2.2. 실행 흐름 (Execution Flow)
1.  사용자가 새 탭을 열거나 기존 탭에서 URL을 입력하여 이동한다.
2.  `chrome.tabs.onUpdated` 이벤트가 트리거된다.
3.  확장 프로그램이 현재 URL의 `hostname`을 추출한다.
4.  저장된 규칙 중 **Exact Match**가 있는지 검사한다.
5.  매칭 시:
    * 현재 윈도우 내에 동일한 이름의 그룹이 있는지 확인한다.
    * 이미 있다면 해당 그룹으로 탭을 보낸다(`tabs.group`).
    * 없다면 새 그룹을 생성하고 이름과 색상을 지정한다(`tabGroups.update`).

---

## 3. Functional Requirements

### 3.1. 정확한 도메인 매칭 (Exact Host Matching)
* `new URL(tab.url).hostname` 방식을 사용하여 경로(`path`)나 쿼리 스트링은 무시한다.
* 사용자가 `mail.google.com`을 등록하면 하위 도메인까지 정확히 일치해야 그룹화한다. (`google.com`은 그룹화 제외)

### 3.2. 탭 그룹 관리
* **생성 및 할당:** `chrome.tabs.group` API 사용.
* **속성 변경:** `chrome.tabGroups.update`를 통해 제목과 색상 부여.
* **범위 제한:** 탭 그룹화는 사용자가 현재 머무는 윈도우(Current Window) 내부에서만 수행된다.

### 3.3. 설정 UI (Options Page)
* **Global Enable/Disable:** 서비스 전체 기능을 켜고 끄는 토글 스위치.
* **Rule Dashboard:** 저장된 규칙 리스트 열람 및 삭제/수정 기능.
* **Add Rule Form:** 도메인, 이름, 색상 선택(Dropdown) 인터페이스.

### 3.4. 지원 색상 (Chrome Native)
* 크롬 API가 지원하는 9가지 색상으로 제한: `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan`, `orange`, `grey`.

---

## 4. Non-Functional Requirements

* **Performance:** 탭 전환 및 로딩 시 딜레이가 없도록 비동기 처리하며, 정규식 대신 단순 문자열 비교를 우선하여 연산 최소화.
* **Security:** `tabs`, `tabGroups`, `storage` 권한만 요청하여 사용자 개인정보 접근을 최소화.
* **Sync:** `chrome.storage.sync`를 사용하여 크롬 로그인 시 기기간 설정 동기화 지원.

---

## 5. Technical Stack Suggestions

### 5.1. Extension Manifest v3
* `manifest_version`: 3`
* `permissions`: ["tabs", "tabGroups", "storage"]
* `host_permissions`: ["http://*/*", "https://*/*"]

### 5.2. 핵심 API 활용 구조 (Background Service Worker)
```javascript
// background.js 예시 로직
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const url = new URL(tab.url);
    const domain = url.hostname;
    
    // 1. Storage에서 규칙 로드
    const { rules, isEnabled } = await chrome.storage.sync.get(['rules', 'isEnabled']);
    if (!isEnabled) return;

    // 2. Exact Matching 확인
    const rule = rules.find(r => r.host === domain);
    if (rule) {
      // 3. 기존 그룹 탐색 또는 새 그룹 생성/할당 로직 실행
      applyGrouping(tabId, rule);
    }
  }
});