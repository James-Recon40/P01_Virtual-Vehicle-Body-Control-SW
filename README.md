# AI.M_Project

## Branch Strategy

```
main
└── develop
    ├── feature/docs
    ├── feature/vehicle-controller
    ├── feature/common
    ├── feature/wiper
    ├── feature/lighting
    ├── feature/door-lock-cluster
    └── feature/ui
```

| Branch | Description |
|---|---|
| `main` | 최종 완료본 |
| `develop` | 통합 및 테스트 |
| `feature/docs` | 설계 문서: 요구사항 분석, SW 아키텍처 설계, 인터페이스 정의서, SW 상세설계 |
| `feature/vehicle-controller` | Vehicle Controller: 모든 기능의 제어기, UI ↔ 각 기능 인터페이스 |
| `feature/common` | 공통 모듈 |
| `feature/wiper` | 와이퍼 |
| `feature/lighting` | 조명 |
| `feature/door-lock-cluster` | 도어잠금 / 계기판 |
| `feature/ui` | UI |

### Module Structure

```
              UI
              │
      Vehicle Controller
      │       │        │
   wiper  lighting  door-lock-cluster
      └───────┴────────┘
            common
```

### Workflow

1. 각 `feature/*` 브랜치는 `develop`에서 분기합니다.
2. 기능 담당자가 각 브랜치에서 구현한 뒤 `develop`으로 병합합니다.
3. `develop`에서 통합 테스트를 진행합니다.
4. 최종 완료되면 `develop`을 `main`으로 병합합니다.
