import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@ootd/types';
import { api, errorMessage } from '@/lib/api';
import { useAppStore } from '@/stores/app.store';
import { cn } from '@/lib/utils';

type Filter = 'pending' | 'all';

export function Admin() {
  const me = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('pending');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.admin.listUsers(),
    enabled: !!me?.isAdmin,
  });

  const mutation = useMutation({
    mutationFn: ({ action, user }: { action: 'approve' | 'unapprove' | 'delete'; user: User }): Promise<unknown> => {
      if (action === 'approve') return api.admin.approve(user.id);
      if (action === 'unapprove') return api.admin.unapprove(user.id);
      return api.admin.deleteUser(user.id);
    },
    onMutate: () => setActionError(null),
    onError: (err) => setActionError(errorMessage(err, '처리하지 못했습니다.')),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  if (!me?.isAdmin) return <Navigate to="/dashboard" replace />;

  const pendingCount = users?.filter((u) => !u.isApproved).length ?? 0;
  const shown = filter === 'pending' ? users?.filter((u) => !u.isApproved) : users;

  const handleDelete = (user: User) => {
    if (!window.confirm(`"${user.loginId}" 계정을 삭제할까요? 옷장·아바타·코디도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    mutation.mutate({ action: 'delete', user });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">회원 관리</h1>

      <div className="flex gap-1 border-b border-border">
        {(
          [
            ['pending', `승인 대기${pendingCount ? ` (${pendingCount})` : ''}`],
            ['all', `전체${users ? ` (${users.length})` : ''}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm',
              filter === key
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {(actionError || error) && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError ?? errorMessage(error, '목록을 불러오지 못했습니다.')}
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">불러오는 중…</p>}

      {shown && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {filter === 'pending' ? '승인 대기 중인 회원이 없습니다.' : '회원이 없습니다.'}
        </p>
      )}

      <div className="space-y-2">
        {shown?.map((u) => {
          const busy = mutation.isPending && mutation.variables?.user.id === u.id;
          const isSelf = u.id === me.id;
          return (
            <div
              key={u.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {u.loginId}
                  {u.name && <span className="ml-2 text-sm font-normal text-muted-foreground">{u.name}</span>}
                  {u.isAdmin && <span className="ml-2 text-xs text-primary">관리자</span>}
                </p>
                {u.signupNote && (
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">메모: {u.signupNote}</p>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  <span className={u.isApproved ? '' : 'font-medium text-amber-600 dark:text-amber-400'}>
                    {u.isApproved ? '승인됨' : '승인 대기'}
                  </span>
                  {' · 가입 '}
                  {new Date(u.createdAt).toLocaleString('ko-KR')}
                </p>
              </div>

              {!isSelf && (
                <div className="flex shrink-0 gap-2">
                  {u.isApproved ? (
                    <button
                      disabled={busy}
                      onClick={() => mutation.mutate({ action: 'unapprove', user: u })}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                    >
                      승인 취소
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => mutation.mutate({ action: 'approve', user: u })}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                    >
                      승인
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => handleDelete(u)}
                    className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
