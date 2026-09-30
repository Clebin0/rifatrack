create extension if not exists pgcrypto;
create table campaigns(id uuid primary key default gen_random_uuid(),name text not null,slug text unique not null,price_cents int not null,total_numbers int not null,status text not null default 'draft',created_at timestamptz default now());
create table sellers(id uuid primary key default gen_random_uuid(),name text not null,code text unique not null,team text,goal int default 30,active boolean default true,created_at timestamptz default now());
create table orders(id uuid primary key default gen_random_uuid(),campaign_id uuid references campaigns(id),seller_id uuid references sellers(id),buyer_name text not null,buyer_phone text,status text not null default 'pending',amount_cents int not null,created_at timestamptz default now());
create table raffle_numbers(id uuid primary key default gen_random_uuid(),campaign_id uuid references campaigns(id),order_id uuid references orders(id),number int not null,status text not null default 'available',unique(campaign_id,number));
create index orders_campaign_idx on orders(campaign_id); create index orders_seller_idx on orders(seller_id);
