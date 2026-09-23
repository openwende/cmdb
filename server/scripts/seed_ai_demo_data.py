#!/usr/bin/env python3
"""Seed AI-assistant demo data into the LOCAL development environment.

Builds ~160 hosts with realistic configs across 4 businesses + the resource pool,
then replays ~60 days of host lifecycle events (import, allocate, transfer,
append, fault, recycle, reclaim, config changes) through the public HTTP API as
several operator accounts, so every audit row is written by the real code path
with a real operator. Afterwards each event's audit rows are backdated to its
scheduled time via SQL on the local `cmdb-db` container.

Local only: refuses any base URL other than localhost / 127.0.0.1, and only
touches the database through `docker exec cmdb-db`. Not idempotent: it aborts if
the demo businesses already exist (restore a backup or clean up first).

    python3 scripts/seed_ai_demo_data.py

Story anchors (fixed, for demos and the eval set) are printed at the end.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import random
import subprocess
import sys
import urllib.parse
from dataclasses import dataclass, field
from typing import Any, Callable

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seed_demo_data import BUSINESSES, CLOUD_AREAS, Client, list_items, unwrap  # noqa: E402

DB_CONTAINER = "cmdb-db"
TZ = dt.timezone(dt.timedelta(hours=8))
DAYS = 60
RNG_SEED = 20260923
DEMO_PASSWORD = "Demo@2026pass"

OPERATORS = [
    # username, display_name, role
    ("zhangwei", "张伟", "editor"),  # 支付 SRE
    ("liuyang", "刘洋", "editor"),  # 商城 SRE
    ("chenjing", "陈静", "editor"),  # 平台资源管理员
]
BUSINESS_OWNER = {
    "demo-mall-commerce": "liuyang",
    "demo-payment-clearing": "zhangwei",
    "demo-observability": "chenjing",
    "demo-data-platform": "chenjing",
}

# business -> [(set, env_type, [(module, service_type, host_prefix, count, profile)])]
TOPOLOGY: dict[str, list[tuple[str, str, list[tuple[str, str, str, int, str]]]]] = {
    "demo-mall-commerce": [
        ("生产集群", "prod", [
            ("商城前端", "web", "mall-web", 8, "web"),
            ("网关服务", "web", "mall-gw", 4, "gateway"),
            ("订单服务", "api", "mall-order", 8, "api"),
            ("库存服务", "api", "mall-stock", 6, "api-small"),
            ("商城数据库", "db", "mall-db", 4, "db"),
            ("缓存服务", "other", "mall-cache", 4, "cache"),
        ]),
        ("预发集群", "staging", [("预发验证", "web", "mall-pre", 3, "tiny")]),
    ],
    "demo-payment-clearing": [
        ("生产集群", "prod", [
            ("支付网关", "api", "pay-gw", 6, "gateway"),
            ("对账任务", "other", "pay-recon", 3, "win"),
            ("风控服务", "api", "pay-risk", 4, "api-small"),
            ("支付数据库", "db", "pay-db", 4, "db"),
        ]),
    ],
    "demo-observability": [
        ("生产集群", "prod", [
            ("指标采集", "other", "obs-metrics", 6, "cache"),
            ("日志检索", "other", "obs-log", 8, "db"),
            ("告警通知", "other", "obs-alert", 3, "api-small"),
        ]),
    ],
    "demo-data-platform": [
        ("试运行集群", "test", [
            ("ETL 调度", "other", "data-etl", 6, "cache"),
            ("指标仓库", "db", "data-dw", 5, "db-large"),
            ("报表 API", "api", "data-report", 3, "win"),
        ]),
    ],
}

PROFILES: dict[str, dict[str, Any]] = {
    "tiny": {"cpu": 2, "memory": 4096, "disk": 80, "os": "linux", "os_version": "Ubuntu 22.04.4 LTS"},
    "web": {"cpu": 4, "memory": 8192, "disk": 100, "os": "linux", "os_version": "Ubuntu 22.04.4 LTS"},
    "api-small": {"cpu": 4, "memory": 8192, "disk": 200, "os": "linux", "os_version": "Rocky Linux 9.3"},
    "api": {"cpu": 8, "memory": 16384, "disk": 300, "os": "linux", "os_version": "Ubuntu 22.04.4 LTS"},
    "gateway": {"cpu": 8, "memory": 16384, "disk": 200, "os": "linux", "os_version": "TencentOS Server 3.1"},
    "cache": {"cpu": 8, "memory": 32768, "disk": 200, "os": "linux", "os_version": "Rocky Linux 9.3"},
    "db": {"cpu": 16, "memory": 65536, "disk": 1000, "os": "linux", "os_version": "Ubuntu 22.04.4 LTS"},
    "db-large": {"cpu": 32, "memory": 131072, "disk": 3000, "os": "linux", "os_version": "Ubuntu 22.04.4 LTS"},
    "win": {"cpu": 4, "memory": 8192, "disk": 200, "os": "windows", "os_version": "Windows Server 2022"},
}

BUSINESS_AREA = {
    "demo-mall-commerce": ("demo-tencent-shanghai-prod", "10.10"),
    "demo-payment-clearing": ("demo-tencent-guangzhou-pay", "10.20"),
    "demo-observability": ("demo-idc-shanghai-a", "10.30"),
    "demo-data-platform": ("demo-aliyun-hangzhou-data", "10.40"),
}
MODULE_AREA_OVERRIDE = {
    ("demo-mall-commerce", "库存服务"): ("demo-aliyun-shanghai-commerce", "10.10.40"),
    ("demo-payment-clearing", "风控服务"): ("demo-aws-hongkong-risk", "10.20.30"),
}
TEAM = {
    "demo-mall-commerce": "商城 SRE",
    "demo-payment-clearing": "支付 SRE",
    "demo-observability": "平台 SRE",
    "demo-data-platform": "数据平台组",
}

# resource pool directories: name -> (area identifier, ip prefix, [(profile, count, status)])
POOL: dict[str, tuple[str, str, list[tuple[str, int, str]]]] = {
    "默认目录": ("demo-idc-shanghai-b", "10.90.1", [("web", 10, "running"), ("api-small", 8, "running"), ("tiny", 4, "stopped")]),
    "腾讯云上海弹性备机": ("demo-tencent-shanghai-prod", "10.10.90", [("api", 8, "running"), ("gateway", 4, "running"), ("web", 6, "running")]),
    "高配计算": ("demo-idc-shanghai-b", "10.90.3", [("db", 6, "running"), ("db-large", 3, "running"), ("cache", 6, "running")]),
    "Windows 专区": ("demo-idc-shanghai-b", "10.90.2", [("win", 6, "running"), ("win", 2, "stopped")]),
    "广州支付备机": ("demo-tencent-guangzhou-pay", "10.20.90", [("gateway", 4, "running"), ("api", 3, "running")]),
}


@dataclass
class HostState:
    name: str
    ip: str
    business: str | None
    module: str | None
    profile: str
    area: str
    custom: dict[str, Any]
    id: str = ""
    location: str = "pool"  # pool | biz
    modules: list[int] = field(default_factory=list)
    directory: str = "默认目录"
    status: str = "running"
    story: bool = False


class Seeder:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url
        self.clients: dict[str, Client] = {}
        self.rng = random.Random(RNG_SEED)
        self.end = dt.datetime.now(TZ).replace(second=0, microsecond=0) - dt.timedelta(hours=1)
        self.start = (self.end - dt.timedelta(days=DAYS)).replace(hour=9, minute=0)
        self.businesses: dict[str, dict[str, Any]] = {}
        self.areas: dict[str, dict[str, Any]] = {}
        self.modules: dict[tuple[str, str], int] = {}  # (business, module name) -> id
        self.directories: dict[str, int] = {}
        self.hosts: dict[str, HostState] = {}
        self.events = 0
        self.stories: list[dict[str, Any]] = []
        self.last_ts: dict[str, dt.datetime] = {}  # host name -> time of its latest event

    # ---------- infra ----------

    def sql(self, query: str) -> str:
        out = subprocess.run(
            ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "cmdb", "-d", "cmdb", "-v", "ON_ERROR_STOP=1", "-At", "-c", query],
            check=True, capture_output=True, text=True,
        )
        return out.stdout.strip()

    def max_history_id(self) -> int:
        return int(self.sql("SELECT COALESCE(max(id), 0) FROM resource_histories") or 0)

    def at(self, day: float, hour: int | None = None, minute: int | None = None) -> dt.datetime:
        base = self.start + dt.timedelta(days=int(day))
        h = hour if hour is not None else self.rng.randint(9, 19)
        m = minute if minute is not None else self.rng.randint(0, 59)
        return base.replace(hour=h, minute=m)

    def bump(self, hosts: list[HostState], when: dt.datetime) -> dt.datetime:
        """Keep each host's history chronological: an event never predates that host's previous event."""
        latest = max((self.last_ts[h.name] for h in hosts if h.name in self.last_ts), default=None)
        if latest is not None and when <= latest:
            when = latest + dt.timedelta(minutes=self.rng.randint(5, 40))
        for h in hosts:
            self.last_ts[h.name] = when
        return when

    def act(self, when: dt.datetime, operator: str, fn: Callable[[Client], Any]) -> Any:
        """Run one API action as `operator`, then backdate the audit rows it wrote to `when`."""
        before = self.max_history_id()
        result = fn(self.clients[operator])
        self.sql(
            "UPDATE resource_histories rh SET changed_at = %s::timestamptz + (seq.n - 1) * interval '1 second' "
            "FROM (SELECT id, row_number() OVER (ORDER BY id) AS n FROM resource_histories WHERE id > %d) seq "
            "WHERE rh.id = seq.id" % (quote(when.isoformat()), before)
        )
        self.events += 1
        return result

    def api(self, client: Client, path: str, method: str = "GET", data: Any = None) -> Any:
        _, payload = client.request(path, method, data)
        return unwrap(payload)

    # ---------- setup ----------

    def check_fresh(self) -> None:
        admin = self.clients["admin"]
        existing = {b.get("identifier") for b in list_items(admin, "/api/v1/businesses?limit=200&offset=0")}
        clash = existing & set(TOPOLOGY)
        if clash:
            raise SystemExit(f"demo businesses already exist ({', '.join(sorted(clash))}); restore a backup before re-seeding")

    def ensure_operators(self) -> None:
        admin = self.clients["admin"]
        users = {u.get("username") for u in list_items(admin, "/api/v1/auth/users")}
        for username, display, role in OPERATORS:
            if username not in users:
                self.api(admin, "/api/v1/auth/users", "POST",
                         {"username": username, "display_name": display, "password": DEMO_PASSWORD, "role": role})
            client = Client(self.base_url)
            client.login(username, DEMO_PASSWORD)
            self.clients[username] = client

    def build_structure(self) -> None:
        admin = self.clients["admin"]
        day0 = self.start
        # cloud areas (no audit)
        existing = {a.get("identifier"): a for a in list_items(admin, "/api/v1/cloud-areas?page=1&page_size=100")}
        for spec in CLOUD_AREAS:
            if spec["identifier"] not in existing:
                existing[spec["identifier"]] = self.api(admin, "/api/v1/cloud-areas", "POST", spec)
        self.areas = existing

        specs = {b["identifier"]: b for b in BUSINESSES}
        for minute, ident in enumerate(TOPOLOGY):
            biz = self.act(day0.replace(minute=minute * 5), "admin",
                           lambda c, s=specs[ident]: self.api(c, "/api/v1/businesses", "POST", s))
            self.businesses[ident] = biz
            mods = self.api(admin, f"/api/v1/topology/modules?business_id={biz['id']}")
            if not any(m.get("name") == "空闲机" for m in mods):
                self.api(admin, f"/api/v1/topology/businesses/{biz['id']}/initialize", "POST", {})
                mods = self.api(admin, f"/api/v1/topology/modules?business_id={biz['id']}")
            for m in mods:
                self.modules[(ident, m["name"])] = m["id"]

            owner = BUSINESS_OWNER[ident]
            for s_order, (set_name, env, module_specs) in enumerate(TOPOLOGY[ident], start=1):
                when = day0.replace(hour=10 + s_order, minute=minute * 5)
                st = self.act(when, owner, lambda c, b=biz, n=set_name, e=env, o=s_order: self.api(
                    c, "/api/v1/topology/sets", "POST",
                    {"business_id": b["id"], "name": n, "env_type": e, "sort_order": o,
                     "description": f"{b['name']} {n}"}))
                for m_order, (mod_name, svc, *_rest) in enumerate(module_specs, start=1):
                    mod = self.act(when + dt.timedelta(minutes=m_order), owner, lambda c, st=st, n=mod_name, sv=svc, o=m_order, b=biz, sn=set_name: self.api(
                        c, "/api/v1/topology/modules", "POST",
                        {"set_id": st["id"], "name": n, "service_type": sv, "sort_order": o,
                         "description": f"{b['name']} / {sn} / {n}"}))
                    self.modules[(ident, mod_name)] = mod["id"]

        # resource pool directories (no audit)
        tree = self.api(admin, "/api/v1/resource-pool/directories/tree")
        self.directories = {d["name"]: d["id"] for d in tree}
        for name in POOL:
            if name not in self.directories:
                d = self.api(admin, "/api/v1/resource-pool/directories", "POST",
                             {"name": name, "description": f"演示资源池目录：{name}"})
                self.directories[name] = d["id"]

    # ---------- hosts ----------

    def plan_hosts(self) -> None:
        seq = 0
        for ident, sets in TOPOLOGY.items():
            area, prefix = BUSINESS_AREA[ident]
            for set_idx, (_set_name, env, module_specs) in enumerate(sets):
                for mod_idx, (mod_name, _svc, host_prefix, count, profile) in enumerate(module_specs):
                    m_area, m_prefix = MODULE_AREA_OVERRIDE.get((ident, mod_name), (area, None))
                    for i in range(1, count + 1):
                        seq += 1
                        ip = f"{m_prefix}.{i + 10}" if m_prefix else f"{prefix}.{set_idx * 20 + mod_idx + 1}.{i + 10}"
                        self.hosts[f"{host_prefix}-{i:02d}"] = HostState(
                            name=f"{host_prefix}-{i:02d}", ip=ip, business=ident, module=mod_name, profile=profile, area=m_area,
                            custom=self.custom_fields(seq, TEAM[ident], {"prod": "生产", "staging": "预发", "test": "试运行"}[env],
                                                      [host_prefix.split("-", 1)[1]], ident in {"demo-mall-commerce", "demo-payment-clearing"}, profile),
                        )
        for dir_name, (area, prefix, groups) in POOL.items():
            n = 0
            for profile, count, status in groups:
                for _ in range(count):
                    n += 1
                    seq += 1
                    name = f"pool-{prefix.replace('.', '-')}-{n:02d}"
                    custom = self.custom_fields(seq, "平台资源池", "资源池", ["spare", profile], False, profile)
                    custom["_status"] = status
                    self.hosts[name] = HostState(name=name, ip=f"{prefix}.{n + 10}", business=None, module=None,
                                                 profile=profile, area=area, custom=custom, directory=dir_name)

    def custom_fields(self, seq: int, team: str, env: str, tags: list[str], core: bool, profile: str) -> dict[str, Any]:
        return {
            "固资编号": f"WD-2024-{seq:05d}",
            "环境": env,
            "责任团队": team,
            "标签": tags,
            "SLA": "99.95%" if core else "99.9%",
            "监控": True,
            "备份": profile.startswith("db"),
        }

    def create_hosts(self) -> None:
        area_vendor = {a["identifier"]: (a.get("cloud_vendor") or "custom", a.get("region") or "") for a in CLOUD_AREAS}
        payloads = []
        for h in self.hosts.values():
            p = PROFILES[h.profile]
            vendor, region = area_vendor[h.area]
            status = h.custom.pop("_status", "running")
            h.status = status
            payloads.append({
                "host_name": h.name, "cloud_area_id": self.areas[h.area]["id"], "primary_ip": h.ip, "ip_addresses": [h.ip],
                "cloud_vendor": vendor, "cloud_instance_id": f"ins-{h.name}", "cloud_region": region,
                "vpc_id": "vpc-" + h.area.replace("demo-", ""), "subnet_id": f"subnet-{region}",
                "cpu": p["cpu"], "memory": p["memory"], "disk_size": p["disk"], "os_type": p["os"],
                "os_version": p["os_version"], "status": status, "custom_fields": h.custom,
            })
        result = self.act(self.at(1, 10, 0), "chenjing", lambda c: self.api(
            c, "/api/v1/hosts/batch", "POST", {"hosts": payloads, "skip_errors": False}))
        ids = result.get("created_ids") or []
        if len(ids) != len(payloads):
            raise SystemExit(f"batch import created {len(ids)} of {len(payloads)} hosts: {json.dumps(result, ensure_ascii=False)[:800]}")
        for h, host_id in zip(self.hosts.values(), ids):
            h.id = host_id

        by_dir: dict[str, list[str]] = {}
        for h in self.hosts.values():
            by_dir.setdefault(h.directory if h.business is None else "默认目录", []).append(h.id)
        for i, (dir_name, host_ids) in enumerate(by_dir.items()):
            self.act(self.at(1, 11, i * 5), "chenjing", lambda c, d=dir_name, ids=host_ids: self.api(
                c, "/api/v1/resource-pool/hosts/import", "POST",
                {"directory_id": self.directories[d], "host_ids": ids, "remark": "AI 演示数据：初始入池"}))
        for h in self.hosts.values():
            h.directory = h.directory if h.business is None else "默认目录"
            self.last_ts[h.name] = self.at(1, 12, 0)

    # ---------- lifecycle primitives ----------

    def allocate(self, when: dt.datetime, op: str, hosts: list[HostState], business: str) -> None:
        idle = self.modules[(business, "空闲机")]
        when = self.bump(hosts, when)
        self.act(when, op, lambda c: self.api(c, "/api/v1/resource-pool/hosts/allocate", "POST",
                                              {"host_ids": [h.id for h in hosts], "target_module_id": idle}))
        for h in hosts:
            h.location, h.business, h.modules = "biz", business, [idle]

    def transfer(self, when: dt.datetime, op: str, hosts: list[HostState], module: str, source: str | None, append: bool = False) -> None:
        business = hosts[0].business
        target = self.modules[(business, module)]
        payload: dict[str, Any] = {"host_ids": [h.id for h in hosts], "target_module_id": target}
        if source and not append:
            payload["source_module_id"] = self.modules[(business, source)]
        when = self.bump(hosts, when)
        self.act(when, op, lambda c: self.api(c, "/api/v1/topology/hosts/transfer", "POST", payload))
        idle = self.modules[(business, "空闲机")]
        for h in hosts:
            keep = [m for m in h.modules if m != idle and (append or m != payload.get("source_module_id"))]
            h.modules = keep + [target]
            if not append:
                h.module = module

    def reclaim(self, when: dt.datetime, op: str, hosts: list[HostState], directory: str) -> None:
        when = self.bump(hosts, when)
        self.act(when, op, lambda c: self.api(c, "/api/v1/resource-pool/hosts/reclaim", "POST",
                                              {"host_ids": [h.id for h in hosts], "directory_id": self.directories[directory],
                                               "remark": "AI 演示数据：回收入池"}))
        for h in hosts:
            h.location, h.business, h.module, h.modules, h.directory = "pool", None, None, [], directory

    def update(self, when: dt.datetime, op: str, h: HostState, fields: dict[str, Any] | None = None, custom: dict[str, Any] | None = None) -> None:
        when = self.bump([h], when)
        if custom:
            self.last_ts[h.name] = when + dt.timedelta(minutes=1)
        if fields:
            self.act(when, op, lambda c: self.api(c, f"/api/v1/hosts/{h.id}", "PUT", fields))
        if custom:
            self.act(when + dt.timedelta(minutes=1), op, lambda c: self.api(
                c, f"/api/v1/hosts/{h.id}/custom-fields", "PUT", {"custom_fields": custom}))
            h.custom.update(custom)

    # ---------- timeline ----------

    def initial_allocation(self) -> None:
        for d, ident in enumerate(TOPOLOGY, start=2):
            op = BUSINESS_OWNER[ident]
            biz_hosts = [h for h in self.hosts.values() if h.business == ident]
            planned = {h.name: h.module for h in biz_hosts}
            self.allocate(self.at(d, 10), op, biz_hosts, ident)
            by_module: dict[str, list[HostState]] = {}
            for h in biz_hosts:
                by_module.setdefault(planned[h.name], []).append(h)
            for i, (mod, hs) in enumerate(by_module.items()):
                self.transfer(self.at(d, 14, i * 4), op, hs, mod, "空闲机")

    def stories_timeline(self) -> None:
        H = self.hosts
        d = lambda days_before_end: DAYS - days_before_end  # noqa: E731

        # S1 支付网关主机：扩内存 → 被误转到风控服务 → 追加回支付网关（现同时属于两个模块）
        s1 = H["pay-gw-01"]
        s1.story = True
        self.update(self.at(d(20), 15, 20), "zhangwei", s1, {"memory": 32768}, {"标签": ["gw", "扩容"]})
        self.transfer(self.at(d(7), 22, 41), "liuyang", [s1], "风控服务", "支付网关")
        self.transfer(self.at(d(6), 9, 12), "zhangwei", [s1], "支付网关", None, append=True)
        self.stories.append({"id": "S1", "host": s1.name, "ip": s1.ip,
                             "summary": "D-20 张伟内存 16G→32G 并打标签扩容；D-7 22:41 刘洋把它从支付网关转到风控服务；D-6 张伟追加回支付网关，现同时在两个模块",
                             "questions": [f"{s1.ip} 为什么同时在两个模块？谁动的？", f"{s1.name} 最近配置改了什么？"]})

        # S2 订单主机：进故障机 → 换盘扩容 → 回到订单服务
        s2 = H["mall-order-03"]
        s2.story = True
        self.transfer(self.at(d(15), 3, 17), "liuyang", [s2], "故障机", "订单服务")
        self.update(self.at(d(15), 3, 25), "liuyang", s2, {"status": "stopped"}, {"故障原因": "数据盘 I/O 错误告警"})
        self.update(self.at(d(12), 16, 5), "chenjing", s2, {"disk_size": 500, "status": "running"}, {"故障原因": "已更换数据盘"})
        self.transfer(self.at(d(11), 10, 30), "liuyang", [s2], "订单服务", "故障机")
        self.stories.append({"id": "S2", "host": s2.name, "ip": s2.ip,
                             "summary": "D-15 凌晨刘洋因数据盘告警把它转入故障机并停机；D-12 陈静换盘 300G→500G 并恢复运行；D-11 刘洋转回订单服务",
                             "questions": [f"{s2.ip} 这半个月发生了什么？", "订单服务最近有没有主机出过故障？"]})

        # S3 数据中台主机：进待回收 → 回收到资源池（从业务里"消失"）
        s3 = H["data-etl-05"]
        s3.story = True
        self.transfer(self.at(d(10), 11, 0), "chenjing", [s3], "待回收", "ETL 调度")
        self.update(self.at(d(10), 11, 5), "chenjing", s3, None, {"责任团队": "平台资源池", "环境": "资源池"})
        self.reclaim(self.at(d(9), 17, 30), "chenjing", [s3], "高配计算")
        self.stories.append({"id": "S3", "host": s3.name, "ip": s3.ip,
                             "summary": "D-10 陈静把它从 ETL 调度转入待回收并改归属团队；D-9 回收到资源池『高配计算』目录",
                             "questions": [f"{s3.ip} 去哪了？为什么不在数据中台了？", "数据中台最近回收了哪些机器？"]})

        # S4 数据库补丁：同一天批量升级商城数据库系统版本；支付数据库开启备份
        for i, h in enumerate(hh for hh in H.values() if hh.name.startswith("mall-db-")):
            h.story = True
            self.update(self.at(d(3), 21, 10 + i * 3), "admin", h, {"os_version": "Ubuntu 22.04.5 LTS"})
        pay_db = H["pay-db-02"]
        pay_db.story = True
        self.update(self.at(d(2), 23, 30), "zhangwei", pay_db, None, {"备份": False, "标签": ["db", "维护窗口"]})
        self.stories.append({"id": "S4", "hosts": [h.name for h in H.values() if h.name.startswith("mall-db-")] + ["pay-db-02"],
                             "summary": "D-3 晚间 admin 批量把商城数据库系统升级到 Ubuntu 22.04.5；D-2 深夜张伟在维护窗口关闭了 pay-db-02 的备份且至今未恢复（其余支付数据库备份仍开启）",
                             "questions": ["商城数据库最近做过什么变更？", "支付数据库的备份配置有没有被改过？现在有风险吗？"]})

        # S5 扩容分配：从广州支付备机分配 2 台到支付网关（分配助手的历史参照）
        spares = [h for h in H.values() if h.directory == "广州支付备机" and h.profile == "gateway"][:2]
        for h in spares:
            h.story = True
        self.allocate(self.at(d(5), 10, 0), "zhangwei", spares, "demo-payment-clearing")
        self.transfer(self.at(d(5), 10, 20), "zhangwei", spares, "支付网关", "空闲机")
        self.stories.append({"id": "S5", "hosts": [h.name for h in spares],
                             "summary": "D-5 张伟从资源池『广州支付备机』分配 2 台 8C16G 到支付清结算，并转入支付网关",
                             "questions": ["支付网关最近扩容了哪些机器？从哪来的？", "资源池里还有多少台 8 核 16G 的 Linux 备机？"]})

    def random_timeline(self, count: int) -> None:
        kinds = ["config"] * 40 + ["transfer"] * 15 + ["append"] * 5 + ["fault"] * 10 + ["recycle"] * 8 + ["expand"] * 12 + ["pool_move"] * 10
        pending: list[tuple[int, Callable[[], None]]] = []  # (day, follow-up action)
        for day in sorted(self.rng.randint(8, DAYS - 1) for _ in range(count)):
            for due in [p for p in pending if p[0] <= day]:
                due[1]()
                pending.remove(due)
            kind = self.rng.choice(kinds)
            biz_hosts = [h for h in self.hosts.values() if h.location == "biz" and not h.story and h.module and h.module not in ("故障机", "待回收", "空闲机")]
            pool_hosts = [h for h in self.hosts.values() if h.location == "pool" and not h.story]
            if kind == "config" and biz_hosts:
                h = self.rng.choice(biz_hosts)
                op = BUSINESS_OWNER[h.business]
                change = self.rng.choice(["memory", "disk", "os", "team", "tags", "backup", "status"])
                p = PROFILES[h.profile]
                if change == "memory":
                    self.update(self.at(day), op, h, {"memory": p["memory"] * 2})
                elif change == "disk":
                    self.update(self.at(day), op, h, {"disk_size": p["disk"] + self.rng.choice([100, 200, 500])})
                elif change == "os" and p["os"] == "linux":
                    self.update(self.at(day), op, h, {"os_version": p["os_version"].replace("22.04.4", "22.04.5").replace("9.3", "9.4")})
                elif change == "team":
                    self.update(self.at(day), op, h, None, {"责任团队": self.rng.choice(["基础架构组", "中间件组", TEAM[h.business]])})
                elif change == "tags":
                    self.update(self.at(day), op, h, None, {"标签": list(h.custom.get("标签", [])) + [self.rng.choice(["压测", "重点保障", "待升级"])]})
                elif change == "backup":
                    self.update(self.at(day), op, h, None, {"备份": not h.custom.get("备份", False)})
                else:
                    self.update(self.at(day), op, h, {"status": "stopped"})
                    pending.append((min(day + 1, DAYS - 1), lambda h=h, op=op, dd=min(day + 1, DAYS - 1): self.update(self.at(dd), op, h, {"status": "running"})))
            elif kind in ("transfer", "append") and biz_hosts:
                h = self.rng.choice(biz_hosts)
                others = [m for (b, m) in self.modules if b == h.business and m not in ("空闲机", "故障机", "待回收", h.module)
                          and self.modules[(b, m)] not in h.modules]
                if others:
                    self.transfer(self.at(day), BUSINESS_OWNER[h.business], [h], self.rng.choice(others), h.module, append=(kind == "append"))
            elif kind == "fault" and biz_hosts:
                h = self.rng.choice(biz_hosts)
                op, back = BUSINESS_OWNER[h.business], h.module
                t = self.at(day)
                self.transfer(t, op, [h], "故障机", back)
                self.update(t + dt.timedelta(minutes=5), op, h, {"status": "stopped"}, {"故障原因": self.rng.choice(["内存 ECC 告警", "网卡丢包", "系统盘只读"])})
                h.story = True  # keep it parked until repaired
                fix_day = min(day + self.rng.randint(1, 4), DAYS - 1)

                def repair(h=h, op=op, back=back, fd=fix_day) -> None:
                    t = self.at(fd)
                    self.update(t, "chenjing", h, {"status": "running"}, {"故障原因": "已修复"})
                    self.transfer(t + dt.timedelta(minutes=10), op, [h], back, "故障机")
                    h.story = False
                pending.append((fix_day, repair))
            elif kind == "recycle" and len(biz_hosts) > 40:
                h = self.rng.choice(biz_hosts)
                op = BUSINESS_OWNER[h.business]
                self.transfer(self.at(day), op, [h], "待回收", h.module)
                h.story = True
                rd = min(day + self.rng.randint(1, 3), DAYS - 1)

                def finish(h=h, rd=rd) -> None:
                    self.reclaim(self.at(rd), "chenjing", [h], "默认目录")
                    h.story = False
                pending.append((rd, finish))
            elif kind == "expand" and pool_hosts:
                ident = self.rng.choice(list(TOPOLOGY))
                want = self.rng.randint(1, 2)
                cands = [h for h in pool_hosts if PROFILES[h.profile]["os"] == "linux" and h.status == "running"][:want]
                mods = [m for (b, m) in self.modules if b == ident and m not in ("空闲机", "故障机", "待回收")]
                if cands and mods:
                    op = BUSINESS_OWNER[ident]
                    self.allocate(self.at(day, 10), op, cands, ident)
                    target = self.rng.choice(mods)
                    self.transfer(self.at(day, 11), op, cands, target, "空闲机")
                    for h in cands:
                        h.custom.update({"责任团队": TEAM[ident]})
            elif kind == "pool_move" and pool_hosts:
                h = self.rng.choice(pool_hosts)
                target = self.rng.choice([d for d in self.directories if d != h.directory])
                self.act(self.bump([h], self.at(day)), "chenjing", lambda c, h=h, t=target: self.api(
                    c, "/api/v1/resource-pool/hosts/move", "POST", {"host_ids": [h.id], "target_directory_id": self.directories[t]}))
                h.directory = target
        for _, follow_up in sorted(pending, key=lambda p: p[0]):
            follow_up()

    # ---------- finish ----------

    def backdate_entities(self) -> None:
        day0 = quote(self.start.isoformat())
        ids = ",".join(str(b["id"]) for b in self.businesses.values())
        self.sql(f"UPDATE businesses SET created_at = {day0}, updated_at = {day0} WHERE id IN ({ids})")
        self.sql(f"UPDATE sets SET created_at = {day0}, updated_at = {day0} WHERE business_id IN ({ids})")
        self.sql(f"UPDATE modules SET created_at = {day0}, updated_at = {day0} WHERE business_id IN ({ids})")
        host_ids = ",".join(quote(h.id) for h in self.hosts.values())
        self.sql(
            "UPDATE hosts h SET created_at = %s, updated_at = COALESCE(("
            "SELECT max(changed_at) FROM resource_histories rh WHERE rh.model_uid = 'host' AND rh.resource_id = h.display_id), %s) "
            "WHERE h.id IN (%s)" % (quote(self.at(1, 10, 0).isoformat()), quote(self.at(1, 10, 0).isoformat()), host_ids)
        )

    def run(self, admin_user: str, admin_password: str, random_events: int) -> None:
        admin = Client(self.base_url)
        admin.login(admin_user, admin_password)
        self.clients["admin"] = admin
        self.check_fresh()
        self.ensure_operators()
        self.build_structure()
        self.plan_hosts()
        self.create_hosts()
        self.initial_allocation()
        self.stories_timeline()
        self.random_timeline(random_events)
        self.backdate_entities()

        counts = {
            "hosts_created": len(self.hosts),
            "hosts_in_business": sum(h.location == "biz" for h in self.hosts.values()),
            "hosts_in_pool": sum(h.location == "pool" for h in self.hosts.values()),
            "api_events": self.events,
            "audit_rows_total": int(self.sql("SELECT count(*) FROM resource_histories")),
            "audit_by_operator": dict(line.split("|") for line in self.sql(
                "SELECT changed_by, count(*) FROM resource_histories GROUP BY 1 ORDER BY 2 DESC").splitlines()),
            "window": f"{self.start:%Y-%m-%d} ~ {self.end:%Y-%m-%d}",
        }
        print(json.dumps({"counts": counts, "stories": self.stories, "operator_password": DEMO_PASSWORD}, ensure_ascii=False, indent=2))


def quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed AI demo data into the LOCAL dev environment only.")
    parser.add_argument("--base-url", default="http://localhost:8080")
    parser.add_argument("--username", default=os.getenv("DEMO_USERNAME", "admin"))
    parser.add_argument("--password", default=os.getenv("DEMO_PASSWORD", "admin123456"))
    parser.add_argument("--random-events", type=int, default=150)
    args = parser.parse_args()

    host = urllib.parse.urlparse(args.base_url).hostname
    if host not in {"localhost", "127.0.0.1"}:
        raise SystemExit(f"refusing to seed non-local target {args.base_url!r}: this script backdates audit rows via SQL and is for local dev only")

    Seeder(args.base_url.rstrip("/")).run(args.username, args.password, args.random_events)
    return 0


if __name__ == "__main__":
    sys.exit(main())
