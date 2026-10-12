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

1. `feature/docs`에서 설계 문서를 작성하고 `develop`으로 병합합니다.
2. 각 기능 브랜치는 `develop`을 받아 설계 문서를 기준으로 구현합니다.
3. 구현이 끝나면 `develop`으로 병합해 최종 통합합니다.
4. `develop` 기준으로 블랙박스 테스트를 진행합니다.
5. 최종 완료되면 `develop`을 `main`으로 병합합니다.

## Team

| 브랜치 | 담당자 | GitHub | 작업 폴더 |
|---|---|---|---|
| `develop` (통합·테스트) | 장태윤 (팀장), 이상현 | James-Recon40, charles000303-sketch | `tests/`, 루트 파일 |
| `feature/docs` | 장태윤 | James-Recon40 | `docs/`, `tests/test_cases/` |
| `feature/common` | 장태윤 | James-Recon40 | `src/common/` |
| `feature/vehicle-controller` | 김원 | rladnjs210-sys | `src/vehicle_controller/` |
| `feature/door-lock-cluster` | 김원 | rladnjs210-sys | `src/door_lock_cluster/` |
| `feature/wiper` | 최희선 | hseonchoi | `src/wiper/` |
| `feature/lighting` | 최희선 | hseonchoi | `src/lighting/` |
| `feature/ui` | 설선환 | seol852323-code | `web/` |

## Directory Structure

```
AI.M_Project/
├── docs/                         ◀ feature/docs
│   ├── 01_requirements/          #   요구사항 분석
│   ├── 02_architecture/          #   SW 아키텍처 설계
│   ├── 03_interface/             #   인터페이스 정의서
│   └── 04_detailed_design/       #   SW 상세설계
│
├── src/
│   ├── vehicle_controller/       ◀ feature/vehicle-controller
│   ├── common/                   ◀ feature/common
│   ├── wiper/                    ◀ feature/wiper
│   ├── lighting/                 ◀ feature/lighting
│   └── door_lock_cluster/        ◀ feature/door-lock-cluster
│
├── web/                          ◀ feature/ui
│
└── tests/                        ◀ develop (통합 후 블랙박스 테스트)
    ├── test_cases/               #   블랙박스 테스트 케이스 (요구사항 기반)
    └── results/                  #   테스트 실행 결과, 증거(로그·캡처)
```

- 각 브랜치에서는 담당 폴더만 수정합니다.
- 빈 폴더 유지를 위한 `.gitkeep` 파일은 실제 파일을 추가한 뒤 삭제해도 됩니다.
