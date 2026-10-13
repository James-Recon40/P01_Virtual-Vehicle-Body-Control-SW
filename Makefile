# AI.M_Project - 차체 편의 기능 (C, gcc)
#   make          헤더 문법 확인 + 모든 모듈 .c 컴파일
#   make headers  헤더 파일만 문법 확인
#   make check    cppcheck 정적 분석
#   make clean    빌드 결과 삭제
# 실행 파일(main) 연결과 테스트 대상은 통합 단계(develop)에서 추가한다.

CC       := gcc
CFLAGS   := -std=c11 -Wall -Wextra -O0 -g
MODDIRS  := src/common src/vehicle_controller src/wiper src/lighting src/door_lock_cluster
CPPFLAGS := $(addprefix -I,$(MODDIRS))
BUILD    := build

SRCS := $(wildcard $(addsuffix /*.c,$(MODDIRS)))
HDRS := $(wildcard $(addsuffix /*.h,$(MODDIRS)))
OBJS := $(patsubst src/%.c,$(BUILD)/%.o,$(SRCS))

.PHONY: all headers check clean

all: headers $(OBJS)
	@echo "build OK: $(words $(OBJS)) object(s)"

$(BUILD)/%.o: src/%.c $(HDRS)
	@mkdir -p $(dir $@)
	$(CC) $(CPPFLAGS) $(CFLAGS) -c $< -o $@

headers:
	@for h in $(HDRS); do $(CC) $(CPPFLAGS) $(CFLAGS) -fsyntax-only -x c $$h || exit 1; done
	@echo "headers OK: $(words $(HDRS)) file(s)"

check:
ifeq ($(strip $(SRCS)),)
	@echo "check: 검사할 .c 파일이 아직 없음"
else
	cppcheck --enable=warning,style,performance,portability --std=c11 --error-exitcode=1 \
		--quiet --suppress=missingIncludeSystem $(CPPFLAGS) $(SRCS)
	@echo "check OK"
endif

clean:
	rm -rf $(BUILD)
