import { Link } from 'react-router-dom';
import { Sparkles, Shirt, Camera } from 'lucide-react';

export function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-border">
        <span className="text-2xl font-bold">OOTD</span>
        <div className="flex items-center gap-4">
          <Link
            to="/auth/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            로그인
          </Link>
          <Link
            to="/auth/register"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            무료 시작하기
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-8 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-foreground max-w-2xl leading-tight">
          AI가 완성하는
          <br />
          <span className="text-primary">나만의 코디</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-xl">
          내 옷을 디지털 옷장에 담고, AI 아바타로 실제 착용 이미지를 만들어 보세요.
          오늘의 날씨와 기분에 맞는 코디를 AI가 추천해 드립니다.
        </p>
        <Link
          to="/auth/register"
          className="mt-8 rounded-xl bg-primary px-8 py-3 text-base font-semibold text-primary-foreground hover:opacity-90"
        >
          지금 시작하기 — 무료
        </Link>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 px-8 py-16 max-w-5xl mx-auto">
        {[
          {
            icon: Shirt,
            title: '디지털 옷장',
            desc: '사진이나 URL로 내 옷을 등록하면 AI가 배경을 제거하고 자동 분류해 드립니다.',
          },
          {
            icon: Camera,
            title: 'AI 가상 피팅',
            desc: '내 아바타에 원하는 코디를 입혀보세요. 정면·측면·후면 이미지를 자동 생성합니다.',
          },
          {
            icon: Sparkles,
            title: '스마트 코디 추천',
            desc: '"오늘 데이트가 있어"처럼 말하면 AI가 내 옷 중에서 최적의 코디를 골라드립니다.',
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl border border-border p-6">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
