import nodemailer, { type Transporter } from 'nodemailer';

// 관리자 알림 메일 — 회원가입 시 승인 요청을 보낸다.
// SMTP 계정이나 수신자(ADMIN_NOTIFY_EMAILS)가 비어 있으면 조용히 건너뛴다.
// 가입 응답과 분리해서 보내므로 메일 서버가 느리거나 실패해도 가입에는 영향이 없다.

const ACCENT = '#0f172a';
const INK = '#0f1115';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface SignupInfo {
  loginId: string;
  name: string | null;
  createdAt: Date;
}

function config() {
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    publicWebUrl: process.env.PUBLIC_WEB_URL || 'http://localhost:5175',
    adminNotifyEmails: (process.env.ADMIN_NOTIFY_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      user: process.env.SMTP_USER ?? '',
      password: process.env.SMTP_PASSWORD ?? '',
      from: process.env.SMTP_FROM ?? '',
    },
  };
}

/** 2026-10-05T05:03:22Z -> '2026년 10월 5일 14시 03분 22초' (한국은 서머타임이 없어 고정 +9시간) */
function fmtKst(d: Date) {
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}년 ${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${p(k.getUTCHours())}시 ${p(k.getUTCMinutes())}분 ${p(k.getUTCSeconds())}초`;
}

function row(label: string, value: string, last = false) {
  return `<tr><td style="padding:16px 18px;${last ? '' : 'border-bottom:1px solid #e5e7eb;'}">
  <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">${label}</div>
  <div style="font-size:16px;font-weight:600;color:#111827;word-break:break-all;">${value}</div>
</td></tr>`;
}

export function buildSignupMail(u: SignupInfo, publicWebUrl: string) {
  const adminUrl = `${publicWebUrl.replace(/\/$/, '')}/admin`;
  const fields: [string, string][] = [
    ['아이디', u.loginId],
    ...(u.name ? [['이름', u.name] as [string, string]] : []),
    ['가입 일시 (한국 시간)', fmtKst(u.createdAt)],
  ];
  // 메일 클라이언트(특히 Gmail/Outlook)는 <style>과 flex를 제대로 지원하지 않아서 테이블 + 인라인 스타일로만 짠다.
  const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(u.loginId)} 님이 가입했습니다. 승인을 기다리고 있어요.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;
                    font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;">
        <tr><td style="background:${INK};padding:22px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.5px;">OOTD</span>
          <span style="color:#9ca3af;font-size:13px;margin-left:8px;">관리자 알림</span>
        </td></tr>
        <tr><td style="padding:32px 28px 8px;">
          <div style="display:inline-block;background:#fef3c7;color:#b45309;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;">승인 대기</div>
          <h1 style="margin:14px 0 8px;font-size:22px;line-height:1.4;color:#111827;">새 회원이 가입했어요</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563;">아래 회원이 가입을 신청했습니다. 승인해야 로그인할 수 있어요.</p>
        </td></tr>
        <tr><td style="padding:20px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
            ${fields.map(([l, v], i) => row(l, esc(v), i === fields.length - 1)).join('\n')}
          </table>
        </td></tr>
        <tr><td align="center" style="padding:8px 28px 32px;">
          <a href="${esc(adminUrl)}" target="_blank"
             style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 28px;border-radius:10px;">관리자 페이지에서 승인하기</a>
          <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">
            버튼이 안 눌리면 이 주소로 들어가세요: <a href="${esc(adminUrl)}" style="color:#6b7280;">${esc(adminUrl)}</a>
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">이 메일은 OOTD 회원가입 시 자동으로 발송됩니다.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = [
    '[OOTD] 새 회원가입 승인 요청',
    '',
    ...fields.map(([l, v]) => `${l}: ${v}`),
    '',
    '승인해야 로그인할 수 있어요. 아래 관리자 페이지에서 승인해 주세요.',
    adminUrl,
  ].join('\n');
  return { subject: `[OOTD] ${u.loginId} 님이 가입했어요 — 승인해 주세요`, html, text };
}

let transport: Transporter | null = null;

function getTransport(smtp: ReturnType<typeof config>['smtp']) {
  transport ??= nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465, // 587은 STARTTLS
    requireTLS: smtp.port !== 465,
    auth: { user: smtp.user, pass: smtp.password },
    connectionTimeout: 20_000,
  });
  return transport;
}

export async function sendSignupNotification(u: SignupInfo): Promise<'SENT' | 'SKIPPED' | 'FAILED'> {
  const { smtp, adminNotifyEmails, publicWebUrl } = config();
  if (!smtp.user || !smtp.password) {
    console.warn(`[mail] SMTP 설정이 없어 가입 알림 메일을 건너뜁니다 (${u.loginId})`);
    return 'SKIPPED';
  }
  if (!adminNotifyEmails.length) return 'SKIPPED';
  const m = buildSignupMail(u, publicWebUrl);
  try {
    await getTransport(smtp).sendMail({
      from: { name: 'OOTD 알림', address: smtp.from || smtp.user },
      to: adminNotifyEmails,
      subject: m.subject,
      text: m.text,
      html: m.html,
    });
    console.log(`[mail] 가입 알림 메일 발송: ${u.loginId} -> ${adminNotifyEmails.join(', ')}`);
    return 'SENT';
  } catch (e) {
    console.error(`[mail] 가입 알림 메일 발송 실패 (${u.loginId})`, e);
    return 'FAILED';
  }
}
