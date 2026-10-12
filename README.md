# AI.M_Project

## Branch Strategy

```
main
└── develop
    ├── feature/common
    ├── feature/wiper
    ├── feature/lighting
    ├── feature/ui
    └── feature/door-lock-cluster
```

| Branch | Description |
|---|---|
| `main` | Stable release |
| `develop` | Integration branch |
| `feature/common` | 공통 모듈 |
| `feature/wiper` | 와이퍼 |
| `feature/lighting` | 조명 |
| `feature/ui` | UI |
| `feature/door-lock-cluster` | 도어잠금 / 계기판 |

- 각 `feature/*` 브랜치는 `develop`에서 분기하고 `develop`으로 병합합니다.
- `develop`이 안정화되면 `main`으로 병합합니다.
