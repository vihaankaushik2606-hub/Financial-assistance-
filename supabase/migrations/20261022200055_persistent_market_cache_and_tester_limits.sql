create schema market_private;
revoke all on schema market_private from public;
create table market_private.config (id boolean primary key default true check(id), secret_hash text not null);
create table market_private.cache (
 cache_key text primary key, data jsonb, fetched_at timestamptz, fresh_until timestamptz,
 lease_id uuid, lease_until timestamptz, retry_after timestamptz
);
create table market_private.attempts (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 cache_key text not null, created_at timestamptz not null default clock_timestamp()
);
create index market_attempts_user_time on market_private.attempts(user_id,created_at);
create index market_attempts_time on market_private.attempts(created_at);
alter table market_private.config enable row level security;
alter table market_private.cache enable row level security;
alter table market_private.attempts enable row level security;
revoke all on all tables in schema market_private from anon,authenticated;
create function market_private.control(p_secret text,p_action text,p_key text default null,p_user uuid default null,p_payload jsonb default null,p_lease uuid default null,p_ttl integer default 3600,p_cooldown integer default 60)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c market_private.cache%rowtype; used integer; total integer; next_reset timestamptz; token uuid; reason text; at_time timestamptz:=clock_timestamp();
begin
 if p_secret is null or not exists(select 1 from market_private.config where id and secret_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_secret,'UTF8')),'hex')) then raise exception 'Unauthorized cache access' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(731290481);
 select count(*),min(created_at)+interval '24 hours' into used,next_reset from market_private.attempts where user_id=p_user and created_at>at_time-interval '24 hours';
 select count(*) into total from market_private.attempts where created_at>at_time-interval '24 hours';
 if p_action='status' then return jsonb_build_object('signedIn',p_user is not null,'used',used,'limit',4,'remaining',case when p_user is null then 0 else greatest(0,4-used) end,'nextResetAt',next_reset,'windowHours',24,'siteRemaining',greatest(0,225-total)); end if;
 if p_key is null or length(p_key)>128 then raise exception 'Invalid cache key'; end if;
 select * into c from market_private.cache where cache_key=p_key;
 if p_action='complete' then
  if c.lease_id is distinct from p_lease or p_lease is null then return jsonb_build_object('state','superseded'); end if;
  if p_payload is not null then update market_private.cache set data=p_payload,fetched_at=at_time,fresh_until=at_time+make_interval(secs=>least(greatest(p_ttl,60),86400)),lease_id=null,lease_until=null,retry_after=null where cache_key=p_key;
  else update market_private.cache set lease_id=null,lease_until=null,retry_after=at_time+make_interval(secs=>least(greatest(p_cooldown,60),3600)) where cache_key=p_key; end if;
  return jsonb_build_object('state','saved');
 end if;
 if p_action<>'reserve' then raise exception 'Invalid cache action'; end if;
 if c.data is not null and c.fresh_until>at_time then return jsonb_build_object('state','fresh','data',c.data,'fetchedAt',c.fetched_at,'expiresAt',c.fresh_until); end if;
 if c.lease_until>at_time then reason:='REFRESH_IN_PROGRESS';
 elsif c.retry_after>at_time then reason:='PROVIDER_COOLDOWN';
 elsif p_user is null then reason:='SIGN_IN_REQUIRED';
 elsif used>=4 then reason:='ACCOUNT_LIMIT';
 elsif total>=225 then reason:='SITE_LIMIT';
 end if;
 if reason is not null then return jsonb_build_object('state',case when c.data is not null then 'stale' when reason='REFRESH_IN_PROGRESS' then 'busy' else 'blocked' end,'reason',reason,'data',c.data,'fetchedAt',c.fetched_at,'expiresAt',c.fresh_until,'nextResetAt',next_reset); end if;
 token:=gen_random_uuid();
 insert into market_private.cache(cache_key,lease_id,lease_until) values(p_key,token,at_time+interval '60 seconds') on conflict(cache_key) do update set lease_id=excluded.lease_id,lease_until=excluded.lease_until;
 insert into market_private.attempts(id,user_id,cache_key,created_at) values(token,p_user,p_key,at_time);
 delete from market_private.attempts where created_at<at_time-interval '7 days';
 return jsonb_build_object('state','fetch','lease',token,'remaining',3-used,'siteRemaining',224-total,'data',c.data,'fetchedAt',c.fetched_at,'expiresAt',c.fresh_until);
end $$;
revoke all on function market_private.control(text,text,text,uuid,jsonb,uuid,integer,integer) from public;
grant usage on schema market_private to anon,authenticated;
grant execute on function market_private.control(text,text,text,uuid,jsonb,uuid,integer,integer) to anon,authenticated;
create function public.market_control(p_secret text,p_action text,p_key text default null,p_user uuid default null,p_payload jsonb default null,p_lease uuid default null,p_ttl integer default 3600,p_cooldown integer default 60)
returns jsonb language sql security invoker set search_path='' as $$
 select market_private.control(p_secret,p_action,p_key,p_user,p_payload,p_lease,p_ttl,p_cooldown);
$$;
revoke all on function public.market_control(text,text,text,uuid,jsonb,uuid,integer,integer) from public;
grant execute on function public.market_control(text,text,text,uuid,jsonb,uuid,integer,integer) to anon,authenticated;