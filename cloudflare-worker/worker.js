/**
 * 안전비서 상담 신청 → Discord 전달 Worker
 *
 * 홈페이지의 상담 신청 폼이 이 Worker로 신청 내용을 보내면,
 * Worker가 Cloudflare에 비밀(Secret)로 저장된 Discord 웹훅으로 전달합니다.
 * 웹훅 주소는 이 코드에도, 홈페이지 코드에도 들어가지 않습니다.
 *
 * Cloudflare 대시보드에서 설정할 값 (Settings → Variables and Secrets)
 *  - DISCORD_WEBHOOK_URL (종류: Secret)  : Discord 웹훅 주소
 *  - ALLOWED_ORIGINS     (종류: Text)    : 신청을 받을 홈페이지 주소. 여러 개면 쉼표로 구분
 *                                         예) https://geltencorp-cpu.github.io
 *                                         비워 두면 모든 사이트에서 받습니다(테스트용).
 */

const INDUSTRIES = ['제조업', '서비스업', '건설업', '소상공인·시장', '기타'];
const PHONE_RE = /^0\d{1,2}-\d{3,4}-\d{4}$/;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    const originOk = allowed.length === 0 || allowed.includes(origin);

    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin || '*' : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return reply({ ok: false, error: 'method_not_allowed' }, 405, cors);
    }
    if (!originOk) {
      return reply({ ok: false, error: 'origin_not_allowed' }, 403, cors);
    }
    if (!env.DISCORD_WEBHOOK_URL) {
      return reply({ ok: false, error: 'webhook_not_configured' }, 500, cors);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return reply({ ok: false, error: 'bad_json' }, 400, cors);
    }

    // 스팸 봇이 채우는 숨은 칸: 채워져 있으면 조용히 성공으로 응답하고 버립니다.
    if (data && data.website) {
      return reply({ ok: true }, 200, cors);
    }

    const company = clean(data.company, 100);
    const name = clean(data.name, 50);
    const phone = clean(data.phone, 20);
    const ind = clean(data.ind, 30);
    const page = clean(data.page, 40) || '홈';

    if (!company || !name || !PHONE_RE.test(phone) || !INDUSTRIES.includes(ind) || data.agree !== true) {
      return reply({ ok: false, error: 'invalid_input' }, 400, cors);
    }

    const payload = {
      username: '안전비서 상담 신청',
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: '새 무료 도입 상담 신청',
          color: 0xd7191f,
          fields: [
            { name: '회사명', value: company, inline: true },
            { name: '담당자명', value: name, inline: true },
            { name: '연락처', value: phone, inline: true },
            { name: '업종', value: ind, inline: true },
            { name: '신청한 페이지', value: page, inline: true },
            { name: '개인정보 동의', value: '동의함', inline: true },
          ],
          footer: { text: origin || '출처 정보 없음' },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    let res;
    try {
      res = await fetch(env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      return reply({ ok: false, error: 'discord_unreachable' }, 502, cors);
    }
    if (!res.ok) {
      return reply({ ok: false, error: 'discord_error', status: res.status }, 502, cors);
    }
    return reply({ ok: true }, 200, cors);
  },
};

function clean(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[`*_~|>]/g, '')
    .trim()
    .slice(0, max);
}

function reply(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
