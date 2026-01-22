# Development Testing Guide

로컬 개발 환경에서 E2E 테스트를 수행하는 방법을 설명합니다.

## 사전 준비

### 1. Supabase Email 인증 설정

**Authentication > Providers > Email:**
- ✅ Enable Email provider: **ON**

**Authentication > Auth Settings > Email:**
- ☐ Enable email confirmations: **OFF** (테스트 편의를 위해 비활성화)

> 💡 "Enable email confirmations"가 ON이면 회원가입 후 이메일 인증이 필요합니다.
> 테스트 시에는 OFF로 설정하여 즉시 로그인할 수 있도록 합니다.

### 2. 테스트 세션 설치

```bash
./scripts/setup-test-sessions.sh
```

이 스크립트는 `~/.claude/projects/`에 테스트용 Claude Code 세션 파일을 복사합니다.

### 3. 환경 변수 확인

```bash
# 필수
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
POLAR_ACCESS_TOKEN
POLAR_WEBHOOK_SECRET
GOOGLE_GEMINI_API_KEY
```

---

## 테스트 플로우

### Flow A: 신규 사용자 전체 경험

**목표**: Signup → 분석 → 결제 → Full Report 언락

```
1. npm run dev
2. http://localhost:3000/dashboard/analyze 접속
3. DEV ONLY 섹션에서:
   - Email: test@example.com
   - Password: test1234
   - [Sign Up] 클릭
4. 터미널에서: npx no-ai-slop
5. 브라우저에서 device code 입력
6. 분석 완료 대기
7. /dashboard/personal에서 보고서 확인 (Preview 상태)
8. [Unlock Full Report] 클릭
9. Polar checkout에서 쿠폰: PO100LAR (100% 할인)
10. 결제 완료 후 Full Report 확인
```

### Flow B: 크레딧 사용

**목표**: 기존 사용자가 크레딧으로 보고서 언락

```
1. 테스트 계정으로 로그인
2. npx no-ai-slop (새 분석)
3. 보고서 페이지에서 [Use 1 Credit to Unlock]
4. 즉시 언락 확인
```

### Flow C: Device Authorization (CLI ↔ Web)

**목표**: CLI에서 웹 인증 플로우 테스트

```
1. 로그아웃 상태에서 시작
2. npx no-ai-slop 실행
3. device code 확인 (예: ABCD-1234)
4. 터미널에 표시된 URL 방문
5. DEV ONLY 섹션에서 로그인
6. device code 입력 → [Authorize Device]
7. CLI가 자동으로 계속 진행하는지 확인
```

### Flow D: 다중 보고서 관리

**목표**: 보고서 리스트 및 삭제 테스트

```
1. 여러 번 npx no-ai-slop 실행 (2-3회)
2. /dashboard/personal에서 보고서 목록 확인
3. 휴지통 아이콘으로 보고서 삭제
4. Progress 탭에서 집계 데이터 확인
```

---

## 테스트 자격 증명

| 항목 | 값 | 비고 |
|------|-----|------|
| Email | `test@example.com` | 유효한 이메일 형식이면 아무거나 가능 |
| Password | `test1234` | 최소 6자 |
| Polar 쿠폰 | `PO100LAR` | 100% 할인 (무료 결제) |

---

## 검증 방법

### Supabase에서 확인

```sql
-- 사용자 확인
SELECT * FROM auth.users WHERE email = 'test@example.com';

-- 프로필 및 크레딧 확인
SELECT * FROM public.users WHERE id = '<user-id>';

-- 분석 결과 확인
SELECT id, result_id, is_paid, claimed_at
FROM analysis_results
WHERE user_id = '<user-id>'
ORDER BY claimed_at DESC;

-- 결제 기록 확인
SELECT * FROM payments WHERE user_id = '<user-id>';

-- 크레딧 트랜잭션 확인
SELECT * FROM credit_transactions WHERE user_id = '<user-id>';
```

### 체크리스트

**계정 생성**
- [ ] 테스트 계정 생성 성공
- [ ] `auth.users` 테이블에 레코드 존재
- [ ] `public.users` 테이블에 자동 동기화
- [ ] 초기 크레딧 지급됨 (users.credits)

**분석 플로우**
- [ ] CLI 실행 성공
- [ ] Device authorization 완료
- [ ] `analysis_results` 테이블에 저장됨
- [ ] 대시보드에 보고서 표시됨
- [ ] Preview 뱃지 표시 (is_paid: false)

**결제 플로우**
- [ ] Polar checkout 리다이렉트 정상
- [ ] 쿠폰 `PO100LAR` 적용됨
- [ ] Webhook 수신 및 처리됨
- [ ] 보고서 언락됨 (is_paid: true)
- [ ] 크레딧 추가됨 (해당 시)

**크레딧 사용**
- [ ] 크레딧 잔액 표시 정확
- [ ] "Use 1 Credit" 버튼 작동
- [ ] 크레딧 차감됨
- [ ] 보고서 즉시 언락됨

---

## 트러블슈팅

### "Email address is invalid" 에러

**원인**: Supabase Email provider가 비활성화됨

**해결**:
1. Supabase Dashboard > Authentication > Providers
2. Email 섹션 확장
3. "Enable Email provider" 토글 ON
4. Save

### Device code가 작동하지 않음

1. 웹에서 로그인되어 있는지 확인
2. 코드 만료 여부 확인 (5분 TTL)
3. 코드 형식 확인 (예: `ABCD-1234`)

### 분석이 대시보드에 표시되지 않음

1. CLI 출력에서 에러 확인
2. 세션 파일 존재 확인: `ls ~/.claude/projects/`
3. Supabase 로그에서 API 에러 확인

### 결제가 완료되지 않음

1. Polar webhook URL 확인
2. Polar 대시보드에서 실패한 webhook 확인
3. `POLAR_WEBHOOK_SECRET` 일치 여부 확인

---

## 보안 참고사항

DEV ONLY 섹션은 production에서 자동으로 숨겨집니다:

```tsx
if (process.env.NODE_ENV === 'production') {
  return null;
}
```

쿠폰 힌트도 development 환경에서만 표시됩니다:

```tsx
{process.env.NODE_ENV !== 'production' && (
  <p>Test coupon: PO100LAR</p>
)}
```
