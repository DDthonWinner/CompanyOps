# 디자인 시스템 및 2.5D 타이쿤 구현 명세

> 문서 ID: DESIGN · 상태: 통합 정리본 · 기준일: 2026-09-08
> 상위 문서: [마스터](00-master-requirements.md) · 타이쿤: [05](05-tycoon-view-requirements.md) · 대시보드: [04](04-dashboard-requirements.md)
> 참고: [이미지](tycoon-reference-image.png), [HTML](tycoon-reference-code.html). HTML/이미지는 원본 그대로 보존한다.

현재 요구사항 적용 표:

| 참고 요소                              | MVP 적용                                                                |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Axiom Studio AI/Project Synthetica     | CompanyOps/실제 Project 이름                                             |
| Overview/Departments/Roadmap/Analytics | 통합 글로벌 내비게이션 바(전 화면 공용)의 Tycoon Office/Dashboard 두 탭  |
| Workspaces                             | Project 선택/목록                                                       |
| Agents 12/16                           | 실제 배정 수/정원                                                       |
| Runway/Burn rate/잔액                  | HIGH $250,000 / MEDIUM $180,000 / LOW $120,000                          |
| 시뮬레이션 시간/배속/Pause             | 제외                                                                    |
| Active Sprint Milestones               | 역할별 Milestone의 완료 Task 수/전체 Task 수, 실제 Task, 결과 승인 상태 |
| Deploy Sprint 토스트                   | Dashboard 계획 검토·최종 실행 승인 흐름으로 연결                        |
| 모델/속도/컨텍스트/Token 목업 수치     | 서버 값만 표시, 미수집 값은 미수집                                      |
| Hire AI Agent                          | 기존 Agent Profile을 현재 Project에 배정                                |

## 1. 문서 목적

타이쿤 오피스와 종합 대시보드가 하나의 제품처럼 보이도록 공통 디자인 언어와 구현 규칙을 정의한다. 대시보드 UI는 shadcn/ui를 기반으로 하되 **'Architectural Clean Glass(건축적이고 투명한 유리 질감)'** 패러다임을 적용하여 고도화하며, 2.5D 타이쿤 Scene은 React Three Fiber와 Three.js를 사용해 정밀하고 깔끔한 상태계(Isometric)를 구현한다. tycoon-reference-code.html과 tycoon-reference-image.png를 참고하여 코딩을 진행한다.

## 2. 감성 및 디자인 방향 (Brand & Style)

- **건축적이고 정밀한 UI (Architectural & Surgical):** 무겁고 복잡한 게임 UI를 배제하고, 하이엔드 CAD 소프트웨어나 건축 설계 도구처럼 차분하고 체계적인 느낌을 준다.
- **촉각적 즐거움 (Playful Tactility):** 상호작용 요소는 제도용 핀, 기계식 토글, 세라믹 토큰과 같은 물리적이고 만족스러운 조작감을 제공한다.
- **투명한 공간감 (Architectural Clean Glass):** UI는 3D 캔버스 위에 떠 있는 투명한 아크릴(Glassmorphism) 패널로 구성되어 게임 뷰를 가리지 않는다.

## 3. 기술 구성

### 3.1 공통 UI

- React + TypeScript
- Tailwind CSS (Container Queries, Forms 플러그인 포함)
- shadcn/ui (투명도와 블러 효과를 가미한 커스텀 테마 적용)
- Material Symbols Outlined (아이콘)
- Zustand
- Local Storage: 선택 탭·카메라 등 UI 설정만 저장; 업무 데이터는 서버 SQLite

### 3.2 타이쿤 및 대시보드

- **3D 캔버스:** Three.js 기반 Orthographic Camera, Raycaster를 통한 객체 상호작용
- **대시보드:** Task 목록/상태 칼럼, QA 결과·Activity 요약. dnd-kit 일정/상태 변경과 Recharts 추세 차트는 P1이며 실행/승인을 드래그로 우회하지 않는다.

## 4. 화면 구조 및 HUD 레이아웃

Viewport를 3D 제도 책상(Drafting desk)으로 간주하고, UI 위젯들은 화면 가장자리에 고정(Anchored)된다. **GlobalExecutiveBar(통합 글로벌 내비게이션 바)는 특정 뷰에 속하지 않고 AppShell 최상단에 한 번만 마운트되어 모든 화면이 공유한다.** 선택된 탭에 따라 그 아래 영역만 TycoonView 또는 DashboardView로 교체된다.

```text
AppShell
├── GlobalExecutiveBar (Top: 전 화면 공용 통합 글로벌 내비게이션 바 — 제품명, Project, Tycoon Office/Dashboard 탭, 연결 상태, 공용 액션)
└── ActiveView (선택된 탭만 렌더링)
    ├── TycoonView
    │   ├── TycoonCanvas (Three.js 3D Layer)
    │   │   ├── FloorStage & Isometric Grid
    │   │   ├── DomainDesks (FE, BE, DB, PM Suite 등)
    │   │   └── DevPawns (작업자 캐릭터)
    │   └── HUD Overlay (React + HTML Layer)
    │       ├── SideHUD (Left: 프로젝트 요약, 부서/Agent 네비게이션, 배정 수/정원, Budget 기준 금액)
    │       ├── VelocityPod (Top-Right: 역할별 Active Sprint Milestones, Task 수 기반 자동 진행률, 하위 Task)
    │       ├── CommandDock (Bottom-Center: 뷰 전환, 고속 이동 줌 마커)
    │       └── Modals
    │           ├── Agent Detail Sheet (요원 상세 스탯 및 하위 작업 정보)
    │           └── Desk/Domain Sheet (부서 큐, 인박스/아웃박스 상세)
    └── DashboardView (04번 Dashboard; AI 활용 Feedback 섹션 포함)
```

### 4.1 통합 글로벌 내비게이션 바 (GlobalExecutiveBar)

상단 글로벌 내비게이션 바는 화면마다 다시 만들지 않는 **단일 공통 컴포넌트**다. 타이쿤 뷰의 상단 바(GlobalExecutiveBar)를 표준으로 삼고, Tycoon Office·Dashboard와 Dashboard 내부의 AI 활용 Feedback 섹션은 모두 AppShell 최상단에 마운트된 같은 컴포넌트를 공유한다. 어떤 화면도 자체 상단 헤더/탭을 별도로 두지 않는다.

- **위치**: `tycoon-reference-image.png`처럼 화면 최상단에 고정(fixed top)하고 좌우 폭을 채우되 중앙 정렬한 플로팅 바로 둔다. 3D 캔버스와 Dashboard 콘텐츠 위(z-40)에 떠 있으며, 탭 전환과 무관하게 항상 같은 자리에 유지된다.
- **형태**: 모서리를 완전히 둥글린 캡슐형(`rounded-full`) 반투명 글래스 패널(Level 2~3, backdrop blur)로, 아래 3개 구역을 좌·중·우로 배치한다. 참고 이미지의 화면명·배속·Deploy Sprint 라벨은 위치와 형태 참고용 자리표시자이며 내용은 아래 규칙을 따른다.
- **좌측(브랜드/컨텍스트)**: 제품 로고 + `CompanyOps` + 현재 Project 이름(규모/단계 배지 포함). 참고 이미지의 `Axiom Studio AI` / `DLC: Project Synthetica`를 대체한다.
- **중앙(탭 내비게이션)**: `Tycoon Office`·`Dashboard` 두 탭. 참고 이미지의 Overview/Departments/Roadmap/Analytics 자리에 배치하고 현재 선택 탭을 강조한다. 세 번째 최상위 탭(별도 Feedback 탭 포함)은 만들지 않는다.
- **우측(공용 액션·상태)**: 실제 연결 상태 표시(항상 보임, [Dashboard 28장](04-dashboard-requirements.md) 연결 규칙), 계획 검토 버튼(참고 이미지의 Deploy Sprint 자리, Dashboard의 계획 검토·최종 실행 승인 흐름으로 연결). 뷰 전용 액션(예: 타이쿤의 Reset View)은 해당 뷰가 활성일 때만 노출한다. 시뮬레이션 시간·배속·Pause 컨트롤은 제외한다.
- **동작**: 선택 탭은 Local Storage의 UI 설정으로만 저장하고 서버 업무 상태를 덮어쓰지 않는다. 연결 상태·마지막 동기화 시각은 어떤 탭에서도 항상 보이게 한다. 두 화면이 같은 컴포넌트를 공유하므로 제품명·Project·연결 상태 표현이 화면 간에 어긋나지 않는다.

## 5. 디자인 토큰 및 색상 시스템

극도로 밝은 백색(High-luminance) 캔버스를 바탕으로, 부서별 기능적 파스텔 톤을 악센트로 사용하여 인지 과부하를 방지한다.

### 5.1 공통 토큰 (Tailwind Config 기준)

```css
:root {
  --background: #f8f9ff;
  --on-background: #0b1c30;
  --surface-container-lowest: #ffffff;
  --surface-container-low: #eff4ff;
  --surface-container: #e5eeff;
  --surface-container-high: #dce9ff;
  --surface-container-highest: #d3e4fe;
  --outline: #767586;
  --outline-variant: #c7c4d7;
  --primary: #4648d4;
  --secondary: #006c49;
  --error: #ba1a1a;

  /* HUD Spacing */
  --hud-inset-desktop: 1.5rem;
  --panel-padding-lg: 1.5rem;
  --panel-padding-md: 1rem;
}
```

### 5.2 부서 및 역할 컬러 (Discipline Accent Spectrum)

타이쿤 객체(데스크 매트, 캐릭터 셔츠, 진행 바)와 UI에 동일하게 적용된다.

| 역할 / 부서    | 헥스 코드 (Hex)     | 설명                         | 사용처                         |
| -------------- | ------------------- | ---------------------------- | ------------------------------ |
| Frontend       | `#4f46e5` (Indigo)  | 클라이언트, UI, CSS 아키텍처 | 요원 아바타, 데스크 표식, 티켓 |
| Backend        | `#059669` (Emerald) | 마이크로서비스, API 상태     | 요원 아바타, 데스크 표식, 티켓 |
| Database       | `#d97706` (Amber)   | 스토리지 용량, 쿼리 캐싱     | 요원 아바타, 데스크 표식, 티켓 |
| QA / DevOps    | `#0284c7` (Sky)     | CI/CD, 테스트 커버리지       | 요원 아바타, 데스크 표식, 티켓 |
| PM / Executive | `#e11d48` (Rose)    | 프로젝트 계획, 로드맵        | 요원 아바타, 코너 스위트(Desk) |

### 5.3 3D 객체 공통 규약 (Inbox & Outbox)

직관적인 작업 흐름 인지를 위해 우편함 색상을 통일한다.

- **Inbox (수신/대기 작업):** Vibrant Electric Royal Blue (`#2563eb`)
- **Outbox (완료/배포 작업):** Vibrant Emerald Green (`#059669`)

## 6. Typography 및 공간 규칙

정보의 성격에 따라 3가지 폰트 패밀리를 전략적으로 혼용한다.

1. **Space Grotesk (Display & Headers):** 레벨 마일스톤, 부서명, 모달 제목. 맑고 기하학적인 기술적 느낌을 제공한다.
2. **Inter (Body & Narrative):** 대화창, 캐릭터 이력서, 알림 등 최대의 가독성이 필요한 본문 영역.
3. **JetBrains Mono (Metrics & Telemetry):** Budget 기준 금액, 배정 수, 진행률 등의 숫자가 흔들리지 않도록 Tabular Number로 사용한다.

- HUD 패널의 모서리는 부드러운 `1rem (16px)`을 적용하고, 버튼이나 뱃지는 캡슐형(`9999px`) 또는 `0.5rem (8px)`을 사용하여 촉각적인 상호작용을 유도한다.

## 7. 고도화된 입체감과 깊이 (Elevation & Depth)

HUD 요소는 아래의 5단계 Glassmorphism 계층 규칙을 따른다.

- **Level 0 (Canvas):** Three.js 3D 씬 (오피스, 가구, 캐릭터).
- **Level 1 (Floor Pins):** 바닥에 투사되는 링이나 경로 지시자 (`opacity: 0.85`, 그림자 없음).
- **Level 2 (Passive HUD):** 백그라운드 블러(`16px`)가 적용된 반투명 흰색 바탕(`rgba(255, 255, 255, 0.76)`)의 기본 패널.
- **Level 3 (Active Docks):** 강한 블러(`24px`)와 은은한 이너 하이라이트가 들어간 활성 컨트롤 영역.
- **Level 4 (Modals & Sheets):** 가장 높은 띄움 효과(그림자 이중 처리)를 가지는 불투명한 흰색 `#FFFFFF` 컴포넌트.

## 8. Three.js 2.5D 타이쿤 규격

### 8.1 Camera & Lighting

- **Orthographic Camera:** 고정된 Isometric 각도(방위각 45도, 고도 35.264도)를 사용하여 `tycoon-reference-image.png`의 정밀한 느낌을 구현한다.
- 조명은 Ambient Light와 부드러운 그림자를 생성하는 Directional Light 1개, 보조 광원(Fill Light) 1개로 제한하여 성능을 최적화한다.

### 8.2 Domain Desk (작업 공간)

- 부서별로 바닥 매트(`matColor`)와 데스크 모서리 트림 색상을 명확히 부여한다.
- 각 데스크에는 거대한 상태 모니터를 배치하고, HTML CanvasTexture를 활용해 진행률과 스프린트 텍스트를 3D 공간 안에서도 보여준다.

### 8.3 Agent Character (작업자)

- Low-poly 형태의 실린더/구 조합으로 구현하며, 머리 위에는 작업 상태에 따라 위아래로 둥둥 떠다니는(Bobbing) `Floating status orb`를 배치한다.
- `IDLE`, `WORKING` 상태 애니메이션은 시간에 따른 사인파(Sine wave) 위치 조정을 통해 단순하지만 부드러운 호흡 애니메이션으로 처리한다.

### 8.4 상호작용 (Raycasting)

- Three.js 내부의 `Raycaster`를 사용하여 요원(Agent), 모니터(Monitor), 인박스/아웃박스를 클릭할 수 있게 한다.
- 객체 클릭 시 일시적인 바운스 스케일링(Bounce scale) 시각 효과를 준 뒤, HTML UI로 데이터를 전달하는 전역 커스텀 이벤트(`tycoon-item-selected`)를 발생시킨다.

## 9. 공통 상태 연결 및 이벤트 핸들링

Three.js 씬의 선택은 CustomEvent로 DOM에 전달한다. 업무 상태 갱신은 SSE/snapshot → Zustand → React/Three.js 경로이며 [공통 계약](06-integration-contract.md)을 따른다.

```ts
// 1. Three.js 내에서 클릭 발생 시
window.dispatchEvent(
  new CustomEvent("tycoon-item-selected", { detail: userData }),
);

// 2. React 측 (Zustand Store 또는 Component)에서 수신
useEffect(() => {
  const handleSelection = (event: CustomEvent) => {
    const data = event.detail;
    if (data.type === "agent") {
      openAgentModal(data.projectAgentId); // Agent 상세 시트 오픈
    } else if (["desk", "monitor", "inbox", "outbox"].includes(data.type)) {
      openDeskModal(data.roleCode); // 부서 상세 큐 오픈
    }
  };
  window.addEventListener("tycoon-item-selected", handleSelection);
  return () =>
    window.removeEventListener("tycoon-item-selected", handleSelection);
}, []);
```

## 10. 반응형 및 성능 기준

- **반응형:** Desktop 환경을 P0로 한다. 모바일에 대비하여 HUD 외곽 여백(`hud-inset-mobile`)을 축소하고, 오버레이의 최대 너비를 제한(`max-w-md` 등)한다.
- **성능:** 3D 실시간 렌더링 부하를 줄이기 위해 CanvasTexture 기반의 텍스트 모니터 갱신 빈도를 초당 5~10프레임 수준으로 스로틀링(Throttling)한다. 그림자 해상도는 `2048x2048` 이내로 고정한다.

## 11. 완료 조건

- 3가지 주요 폰트(Space Grotesk, Inter, JetBrains Mono)가 용도에 맞게 적용된다.
- Three.js 화면 위에 투명하고 세련된(Glassmorphism) HUD가 4개 영역(Top, Left, Right, Bottom)에 분산 고정된다.
- 타이쿤 부서 컬러 코드(Indigo, Emerald, Amber, Rose)가 3D 씬과 React DOM 전체에 일관되게 적용된다.
- 사용자가 3D 환경의 요원이나 모니터를 클릭하면, CustomEvent를 통해 React의 상태 시트(Modal/Sheet)가 올바르게 호출된다.
- 통합 글로벌 내비게이션 바(GlobalExecutiveBar, 4.1)가 AppShell 최상단에 한 번만 마운트되어 Tycoon Office·Dashboard·Feedback 섹션에서 동일하게 표시되고, 탭 전환 시 제품명·Project·연결 상태 표현이 유지된다.

## 12. 공통 접근성과 상태 표현

- 기본 데스크톱 검증 해상도는 1920×1080이며, 좁은 화면에서는 Dashboard Attention Center를 먼저 표시한다.
- 한글은 시스템 sans-serif fallback을 사용한다. 웹폰트 로딩 실패가 조작을 막지 않아야 한다.
- 상태는 색상과 함께 텍스트/아이콘으로 표시하고, 모달은 Escape·닫기 버튼·포커스 복귀를 제공한다.
- WORKING은 실제 Task 실행에서만 표시한다. WAITING/REVIEW를 작업 중 애니메이션으로 표현하지 않는다.
- QA/DEVOPS는 Sky, DESIGN은 Indigo 계열 fallback을 사용한다. 역할 색과 Agent 사용자 지정 색을 구분하며 데스크는 역할색, Agent는 지정색을 우선한다.
- WebGL 오류 시 Dashboard로 이동할 수 있는 안내를 제공한다. 장식 효과를 줄여도 기능 상태와 선택은 유지한다.
