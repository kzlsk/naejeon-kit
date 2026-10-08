import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '개인정보처리방침 · naejeon-kit',
  description: 'naejeon-kit 개인정보처리방침 / Privacy Policy',
};

const CONTACT_EMAIL = 'minsg090393@gmail.com'; 
const EFFECTIVE_DATE = '2026-10-08';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-[15px] leading-relaxed text-[#C9CED4]">
      <Link href="/" className="text-sm text-[#8B949E] hover:text-[#ECE8E1]">
        ← 홈으로
      </Link>

      <h1 className="mt-6 text-2xl font-bold text-[#ECE8E1]">개인정보처리방침</h1>
      <p className="mt-1 text-sm text-[#8B949E]">시행일: {EFFECTIVE_DATE}</p>

      <Section title="1. 수집하는 정보">
        <p>회원가입·로그인 없이 이용할 수 있으며, 아래 정보만 저장합니다.</p>
        <ul className="list-disc pl-5">
          <li>방 정보: 방 코드, 맵 풀, 맵·공수 랜덤 결과</li>
          <li>멤버 정보: 사용자가 직접 입력한 닉네임, 티어, 선호 포지션</li>
          <li>
            브라우저 저장소(localStorage): 방장 키, 본인 정보 수정용 토큰. 이 값은 사용자 기기에만
            저장되며 본인 확인 용도로만 쓰입니다.
          </li>
          <li>
            디스코드 연결 정보: 방장이 디스코드 채널을 연결한 경우, 그 채널의 웹훅 정보(웹훅 ID·토큰)와
            디스코드 서버 이름. 웹훅 토큰은 비공개로 저장되며 참가자 화면에 표시되지 않습니다.
            디스코드 계정 정보나 로그인 토큰은 저장하지 않습니다.
          </li>
        </ul>
        <p>
          (예정) 라이엇 계정 연결 기능이 추가되면, 사용자가 라이엇 로그인(RSO)으로{' '}
          <strong className="text-[#ECE8E1]">직접 동의한 경우에만</strong> Riot ID, 현재 티어, 최근
          경쟁전 기록(자주 플레이한 요원·포지션)을 불러옵니다.
        </p>
      </Section>

      <Section title="2. 이용 목적">
        <p>내전 방 운영, 팀 자동 분배, 맵·공수 결정에만 사용합니다. 광고, 판매, 외부 공유는 하지 않습니다.</p>
        <p>
          방장이 디스코드를 연결하면 결과를 그 채널로 보냅니다. 이때 전송되는 정보는{' '}
          <strong className="text-[#ECE8E1]">
            닉네임, 추천 포지션, 팀 구성(팀 점수 포함), 맵·밴, 공수 결과, 방 코드
          </strong>
          입니다. 디스코드에 게시된 메시지는 해당 채널을 볼 수 있는 사람에게 보이며, Discord의 정책에 따라
          보관되고 디스코드에서 직접 삭제할 수 있습니다.
        </p>
      </Section>

      <Section title="3. 공개 범위">
        <p>
          입력하거나 불러온 정보는 같은 방에 참가한 사람에게만 보이며, 공개 페이지에 노출되지
          않습니다. MMR/ELO 등 별도 실력 점수를 만들거나 표시하지 않습니다.
        </p>
      </Section>

      <Section title="4. 보관 기간 및 삭제">
        <ul className="list-disc pl-5">
          <li>방과 관련된 모든 데이터는 방 생성 후 24시간이 지나면 자동 삭제됩니다.</li>
          <li>
            디스코드 웹훅 정보는 방과 함께 24시간 후 삭제되며, 방장이 연결을 해제하면 즉시 삭제됩니다.
          </li>
          <li>참가자는 언제든 본인 정보를 직접 삭제할 수 있습니다.</li>
          <li>브라우저 저장소 값은 브라우저 데이터 삭제로 지울 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="5. 처리 위탁">
        <p>서비스 운영을 위해 아래 외부 서비스를 사용합니다.</p>
        <ul className="list-disc pl-5">
          <li>Supabase: 데이터베이스 및 실시간 동기화</li>
          <li>Vercel: 웹사이트 호스팅</li>
          <li>Discord: 방장이 연결한 채널로 내전 결과 메시지 전송 (연결한 경우에만)</li>
        </ul>
      </Section>

      <Section title="6. 문의">
        <p>개인정보 관련 문의: {CONTACT_EMAIL}</p>
      </Section>

      <hr className="my-10 border-[#262D36]" />

      <h2 className="text-xl font-bold text-[#ECE8E1]">Privacy Policy (English)</h2>
      <p className="mt-1 text-sm text-[#8B949E]">Effective: {EFFECTIVE_DATE}</p>
      <div className="mt-4 space-y-3">
        <p>
          naejeon-kit requires no account. We store only room data (room code, map pool, map/side
          results) and the nickname, rank and preferred roles that users enter themselves. A host key
          and a personal edit token are kept in the user&apos;s browser (localStorage) for
          verification only.
        </p>
        <p>
          (Planned) If Riot account linking is added, we will fetch a player&apos;s Riot ID, current
          rank and recent competitive data only after that player explicitly opts in via Riot Sign
          On (RSO).
        </p>
        <p>
          Data is used only to run custom-game rooms. It is visible only to members of the same room,
          never shown on public pages, never sold or shared, and never used to compute MMR/ELO or any
          alternative ranking.
        </p>
        <p>
          All room data is automatically deleted 24 hours after the room is created. Participants can
          delete their own entry at any time. We use Supabase (database) and Vercel (hosting).
        </p>
        <p>
          If a host connects a Discord channel, we store that channel&apos;s webhook (ID and token, kept
          private) and the server name, and post results there: nicknames, suggested roles, teams
          (including team scores), map and bans, starting sides, and the room code. We do not store any
          Discord account data or login tokens. Webhook data is deleted with the room after 24 hours,
          or immediately when the host disconnects. Messages posted to Discord follow Discord&apos;s
          policies and can be deleted in Discord. Discord is used only when a host connects it.
        </p>
        <p>Contact: {CONTACT_EMAIL}</p>
      </div>

      <p className="mt-10 text-xs text-[#5C6672]">
        naejeon-kit은 Riot Games와 무관한 팬 제작 서비스입니다. naejeon-kit isn&apos;t endorsed by
        Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or anyone officially
        involved in producing or managing Riot Games properties.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 space-y-2">
      <h2 className="text-base font-semibold text-[#ECE8E1]">{title}</h2>
      {children}
    </section>
  );
}
