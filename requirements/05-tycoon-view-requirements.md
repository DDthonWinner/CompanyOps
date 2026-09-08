# 05. 타이쿤 뷰 요구사항

> 문서 ID: TY · 상태: 통합 정리본 · 기준일: 2026-09-08
> 상위 문서: [마스터](00-master-requirements.md) · 디자인: [Design](Design.md) · 연동: [06](06-integration-contract.md)
> 참고: [이미지](tycoon-reference-image.png), [HTML](tycoon-reference-code.html). 참고 파일의 기능/가짜 데이터보다 현재 요구사항이 우선한다.

- 요구사항 ID: `TY-001` 씬/카메라, `TY-002` 데스크/Agent/좌석, `TY-003` 상태/선택, `TY-004` 공통 HUD, `TY-005` Milestone, `TY-006` 상세/접근성.
- Desk·좌석·공간 배치는 본 모듈이 소유한다. MVP는 역할과 안정된 Agent 순서로 자동 배치하며 좌석 편집·드래그·서버 좌표 저장은 제외한다. 새로고침에도 같은 Agent가 같은 자리에 배치되어야 한다.
- Three.js 객체의 ID를 공통 store에 연결한다. 서버 상태는 SSE/snapshot으로 들어오고, CustomEvent는 화면 선택에만 사용한다.

## 1. 프로젝트 개요

### 1.1 서비스 비전

'Architectural Clean Glass(건축적이고 투명한 유리 질감)' 패러다임을 적용하여, 무겁고 복잡한 기존 게임 UI를 탈피하고 하이엔드 CAD 소프트웨어나 건축 설계 도구처럼 차분하고 체계적인 느낌을 제공하는 CompanyOps의 AI 개발 팀 작업 상태를 보여주는 2.5D 타이쿤 오피스 화면. 디자인 예시는 tycoon-reference-image.png 참고 (코드 참고는 tycoon-reference-code.html 참고)

### 1.2 핵심 가치 제안

**사용자(플레이어) 관점**
- 3D 뷰포트를 가리지 않는 투명하고 세련된 HUD (Glassmorphism) 제공.
- 제도용 핀, 기계식 토글 등 물리적이고 만족스러운 조작감을 통한 촉각적 즐거움 (Playful Tactility).
- 부서별 직관적인 색상 코드(Color Coding)를 통한 인지 과부하 방지.

**시스템/아키텍처 관점**
- Three.js 기반의 가벼운 3D 렌더링과 React/HTML 기반의 UI 분리를 통한 성능 최적화.
- `CustomEvent`를 활용한 3D 씬과 DOM 요소 간의 매끄러운 단방향 통신 구조.

---

## 2. 서비스 구성

### 2.1 주요 구성 요소

- **Interactive 3D Canvas Layer (Level 0)**: Three.js 기반으로 구동되며, 고정된 Isometric(등각투영) 시점으로 오피스, 데스크, 요원(Agent) 등을 렌더링하는 핵심 게임 뷰포트.
- **HUD Overlay (React + HTML Layer)**: 3D 캔버스 위에 떠 있는 투명한 아크릴 패널 형태의 UI 영역.
  - **Global Executive Bar (Top)**: 제품명, Project 컨텍스트, Tycoon Office/Dashboard 탭 및 연결 상태.
  - **Side HUD (Left)**: 프로젝트 요약, 역할/Agent 네비게이션, 배정 수/정원 및 Budget 기준 금액.
  - **Velocity Pod (Top-Right)**: 역할별 Active Sprint Milestones 및 Task 상태 요약.
  - **Command Dock (Bottom-Center)**: 카메라 뷰 전환 및 고속 이동 줌 마커.
  - **Modals & Sheets (Level 4)**: 요원 및 부서의 상세 정보를 표시하는 오버레이 패널.

---

## 3. 핵심 기능 요구사항

### 3.1 3D 타이쿤 캔버스 (Three.js 기반)

#### 3.1.1 렌더링 및 카메라 시스템

**기능 요구사항**:
- **고정된 Orthographic Camera**: 방위각 45도, 고도 35.264도의 Isometric 각도를 유지하여 정밀한 느낌 구현. 스크롤을 통한 줌인/아웃 가능.
- **조명 최적화**: Ambient Light, 그림자를 생성하는 Directional Light 1개, 보조 광원(Fill Light) 1개로 제한하여 성능 최적화.
- **반응형 리사이징**: 브라우저 창 크기 변경 시 카메라의 frustum 비율 및 렌더러 크기 자동 업데이트.

#### 3.1.2 상호작용 객체 (Interactables)

**기능 요구사항**:
- **부서별 데스크 (Domain Desk)**:
  - Frontend(Indigo), Backend(Emerald), Database(Amber), PM(Rose) 등 각 부서별 지정된 색상 코드를 바닥 매트와 데스크 테두리에 적용.
  - HTML CanvasTexture를 활용해 3D 공간 내의 거대한 모니터에 진행률과 텍스트를 실시간 표시.
  - Inbox(파란색 계열)와 Outbox(초록색 계열) 트레이를 공통 규약으로 배치.
- **요원 아바타 (Agent Pawn)**:
  - Low-poly 형태의 실린더/구 조합으로 구성.
  - 시간에 따른 사인파(Sine wave)를 이용해 부드럽게 호흡하며 위아래로 움직이는 애니메이션(Bobbing) 적용.
  - 머리 위에 작업 상태를 나타내는 부유하는 상태 오브(Floating status orb) 배치.
- **Raycasting 클릭 이벤트**:
  - 마우스 포인터 이동 시 인터랙션 가능한 객체 위에 호버링 커서 표시.
  - 객체 클릭 시 180ms 동안 일시적인 바운스 스케일링(Bounce scale) 시각 효과 제공.
  - 클릭 완료 시 객체의 `userData`를 담아 `tycoon-item-selected` CustomEvent 전역 발송.

### 3.2 HTML HUD 인터페이스 (React/Tailwind 기반)

#### 3.2.1 Global Executive Bar (상단)

**기능 요구사항**:
- CompanyOps, 현재 Project 이름, Tycoon Office/Dashboard 두 탭, 실제 연결 상태 표시.
- 시뮬레이션 시간·배속·Pause 기능은 제외한다.
- Reset View 버튼 (확대/축소 및 이동을 했을 경우를 위해 Camera 리셋 기능)
- **계획 검토 버튼**: 참고 자료의 Deploy Sprint 자리에 배치하고 Dashboard의 계획 검토·최종 실행 승인 흐름으로 연결한다. 토스트만으로 실행 완료를 표시하지 않는다.

#### 3.2.2 Side HUD 및 Velocity Pod (좌측/우측 팝오버)

**기능 요구사항**:
- **Side HUD**:
  - 16px의 백그라운드 블러가 적용된 반투명 흰색 패널(Level 2)로 렌더링.
  - Budget 단계/기준 금액: HIGH $250,000 / MEDIUM $180,000 / LOW $120,000. Runway/잔액 감소는 표시하지 않는다.
  - Token Usage는 실제 계측값만 별도 표시하고 미수집은 미수집으로 표시한다.
  - Agents는 현재 배정 수/정원이다. Hire AI Agent는 기존 Profile을 Project에 추가 배정한다. Workspace 메뉴는 Project 선택이다.
- **Velocity Pod**:
  - 역할별 Active Sprint Milestones의 제목·완료 Task 수/전체 Task 수·서버 계산 정수 진행률·Milestone 결과 승인 상태를 렌더링한다. 펼치면 해당 Milestone의 실제 Task 목록을 표시한다.
  - 경과 시뮬레이션 시간·가짜 Velocity는 제외한다. Task 없는 Milestone은 0/0, 0%, 작업 없음으로 표시한다. Task 변경 시 Dashboard와 같은 snapshot 집계값을 반영한다.

#### 3.2.3 Command Dock (하단)

**기능 요구사항**:
- 중앙 스튜디오 보기 및 각 부서별(FE, BE, DB, PM) 고속 이동 버튼 제공.
- 클릭 시 해당 데스크로 카메라를 이동/줌한다. 중앙 보기로 원위치 복귀하며 각 버튼에 역할명과 선택 상태를 표시한다.

#### 3.2.4 Inspector Modals (모달 시스템)

**목적**: 3D 씬에서 객체 클릭 시 해당 객체의 상세 데이터를 표시

**기능 요구사항**:
- **요원 상세 모달 (Agent Detail Sheet)**:
  - Agent의 표시 이름·모델명·역할·현재 Task·다음 작업·실행 상태·대기 사유·결과 생성 상태와 소속 Milestone의 결과 승인 상태를 표시한다. Token은 계측된 경우만 표시하고 미수집 값은 미수집으로 표시한다. t/s·컨텍스트 로드는 선택 기능이며 가짜 수치를 넣지 않는다.
  - 요원 아바타 썸네일 테두리 및 배경에 요원 고유의 색상 코드 동적 적용.
- **데스크 상세 모달 (Desk/Domain Sheet)**:
  - 클릭한 모니터, 데스크, 혹은 인박스의 데이터를 수신하여 렌더링.
  - 해당 역할의 Milestone 진행률, 배정 Agent 수, 실제 Task/Artifact 목록을 표시한다. Inbox는 TODO/WAITING Task, Outbox는 COMPLETED Task와 결과물이며 REVIEW는 검토 대기로 별도 표시한다. 별도 메시지 큐 엔터티는 만들지 않는다.
- **공통 애니메이션**:
  - Fade-in 및 Zoom-in 효과(`animate-in fade-in zoom-in duration-150`) 적용.
  - 모달 배경(Scrim) 클릭 시 모달 닫기 기능.

### 3.3 디자인 및 타이포그래피 규칙

**기능 요구사항**:
- **Glassmorphism 계층**: Level 0(캔버스)부터 Level 4(가장 띄움 효과가 큰 불투명 모달)까지 5단계 깊이(Depth) 규칙 엄수.
- **타이포그래피 분리**:
  - Display 및 모달 제목: **Space Grotesk**.
  - 본문 영역 및 설명: **Inter**.
  - 수치(배정 수, Budget 기준 금액, 진행률): Tabular Number를 위한 **JetBrains Mono**.

---

## 4. MVP 개발 범위

### 4.1 핵심 기능 (필수)

**목표**: 3D 타이쿤 환경과 HUD 간의 기본 렌더링 및 단방향 상호작용 구현

- **3D 렌더링 (React Three Fiber/Three.js)**: Isometric 카메라 설정, FE/BE/DB/PM 데스크와 실제 Project Agent 렌더링. QA/추가 역할은 보조 데스크를 제공한다. Agent가 없는 데스크는 비어 있고, 최대 16명까지 고유 ID로 구분하여 배치한다.
- **UI HUD (HTML/CSS)**: 상단 공통 탭/프로젝트/연결 상태, 좌우 Budget/정원/Milestone 패널, 하단 네비게이션 독 렌더링 (Tailwind CSS 기반).
- **이벤트 연결**: Three.js 씬 내 요원 또는 모니터 클릭 시 `tycoon-item-selected` 이벤트를 발생시키고, 이를 DOM에서 수신하여 HTML 모달을 성공적으로 띄우는 프로세스 구현.

---

## 5. 인수 기준

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| TY-AC-001 | PM/FE/BE/QA 팀 조회 | 실제 배정 Agent만 렌더링; QA도 선택 가능 |
| TY-AC-002 | 최대 16명 배정 | 중복 ID/겹친 선택 영역 없이 식별 가능; 정원 표시와 수 일치 |
| TY-AC-003 | 서버 Task 상태 변경 | Dashboard와 같은 Agent 상태·현재 Task·검토 대기 표시 |
| TY-AC-004 | Agent/Desk 클릭 | ID 기반 최신 상세 정보; 빈 데스크도 작업 없음 표시 |
| TY-AC-005 | 부서 이동 후 중앙 보기 | 카메라 이동 및 초기 위치 복귀 |
| TY-AC-006 | HUD 확인 | Budget·정원·Task 수 기반 Milestone과 승인 대기/승인 완료 표시, 시계/배속/Pause 없음 |
| TY-AC-007 | 1366×768 화면, WebGL 실패 | 주요 HUD 조작 가능; 실패 시 안내와 Dashboard 진입 제공 |

Agent의 IDLE/WORKING/WAITING/BLOCKED는 서로 다른 라벨/아이콘과 최소 상태 애니메이션으로 구분한다. 색상만으로 구분하지 않으며 키보드로 접근할 수 있는 Agent 목록을 제공한다. 장식 bobbing은 실제 시뮬레이션 시간을 의미하지 않는다.

## 6. 용어

### 6.1 용어 정의

- **HUD**: Head-Up Display (화면 상단에 고정되어 떠 있는 형태의 정보 표시 인터페이스)
- **Isometric**: 등각투영법. X, Y, Z축이 서로 120도의 각도를 이루어 입체감을 주면서도 원근감이 없는 3D 뷰.
- **Glassmorphism**: 반투명한 블러(Blur) 효과를 주어 마치 젖빛 유리 너머로 배경이 비치는 듯한 UI 디자인 기법.
- **CustomEvent**: 브라우저 내에서 기본 이벤트(click 등) 외에 개발자가 직접 정의하여 데이터를 주고받을 수 있는 DOM 이벤트.
