#!/usr/bin/env python3
"""Idempotently seed demo data through the public HTTP API.

Default target is local development. For the hosted demo:

    python3 scripts/seed_demo_data.py --base-url https://demo.wendeops.com
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from typing import Any


BUSINESSES: list[dict[str, Any]] = [
    {
        "identifier": "demo-mall-commerce",
        "name": "文德商城",
        "description": "外部用户电商交易链路，覆盖 Web、订单、库存与营销入口。",
        "lifecycle": "online",
        "timezone": "Asia/Shanghai",
        "language": "zh-CN",
        "sres": ["sre-commerce@wendeops.com"],
        "developers": ["dev-web@wendeops.com", "dev-order@wendeops.com"],
        "testers": ["qa-commerce@wendeops.com"],
        "bizops": ["pm-commerce@wendeops.com"],
    },
    {
        "identifier": "demo-payment-clearing",
        "name": "支付清结算",
        "description": "支付网关、对账、风控与清结算后台，支撑核心交易闭环。",
        "lifecycle": "online",
        "timezone": "Asia/Shanghai",
        "language": "zh-CN",
        "sres": ["sre-payment@wendeops.com"],
        "developers": ["dev-payment@wendeops.com", "dev-risk@wendeops.com"],
        "testers": ["qa-payment@wendeops.com"],
        "bizops": ["pm-payment@wendeops.com"],
    },
    {
        "identifier": "demo-observability",
        "name": "观测平台",
        "description": "统一采集指标、日志和告警，给业务团队提供运行视图。",
        "lifecycle": "online",
        "timezone": "Asia/Shanghai",
        "language": "zh-CN",
        "sres": ["sre-platform@wendeops.com"],
        "developers": ["dev-observe@wendeops.com"],
        "testers": ["qa-platform@wendeops.com"],
        "bizops": ["pm-platform@wendeops.com"],
    },
    {
        "identifier": "demo-data-platform",
        "name": "数据中台",
        "description": "离线任务、指标仓库和经营看板，当前处于试运行阶段。",
        "lifecycle": "testing",
        "timezone": "Asia/Shanghai",
        "language": "zh-CN",
        "sres": ["sre-data@wendeops.com"],
        "developers": ["dev-data@wendeops.com"],
        "testers": ["qa-data@wendeops.com"],
        "bizops": ["pm-data@wendeops.com"],
    },
]


CLOUD_AREAS: list[dict[str, Any]] = [
    {
        "identifier": "demo-tencent-shanghai-prod",
        "name": "腾讯云上海生产 VPC",
        "type": "vpc",
        "cloud_vendor": "tencent_cloud",
        "vpc_id": "vpc-demo-commerce-sh",
        "cidr_block": "10.10.0.0/16",
        "region": "ap-shanghai",
        "description": "商城生产链路所在的腾讯云上海 VPC。",
    },
    {
        "identifier": "demo-tencent-guangzhou-pay",
        "name": "腾讯云广州支付 VPC",
        "type": "vpc",
        "cloud_vendor": "tencent_cloud",
        "vpc_id": "vpc-demo-payment-gz",
        "cidr_block": "10.20.0.0/16",
        "region": "ap-guangzhou",
        "description": "支付网关与清结算服务所在的腾讯云广州 VPC。",
    },
    {
        "identifier": "demo-aliyun-shanghai-commerce",
        "name": "阿里云上海库存 VPC",
        "type": "vpc",
        "cloud_vendor": "aliyun",
        "vpc_id": "vpc-demo-stock-sh",
        "cidr_block": "10.10.40.0/24",
        "region": "cn-shanghai",
        "description": "商城库存服务的阿里云上海资源区。",
    },
    {
        "identifier": "demo-aliyun-hangzhou-data",
        "name": "阿里云杭州数据 VPC",
        "type": "vpc",
        "cloud_vendor": "aliyun",
        "vpc_id": "vpc-demo-data-hz",
        "cidr_block": "10.40.0.0/16",
        "region": "cn-hangzhou",
        "description": "数据中台离线任务和指标仓库所在 VPC。",
    },
    {
        "identifier": "demo-aws-hongkong-risk",
        "name": "AWS 香港风控 VPC",
        "type": "vpc",
        "cloud_vendor": "aws",
        "vpc_id": "vpc-demo-risk-hk",
        "cidr_block": "10.20.30.0/24",
        "region": "ap-east-1",
        "description": "风控服务跨云部署资源区。",
    },
    {
        "identifier": "demo-idc-shanghai-a",
        "name": "上海自建 IDC-A",
        "type": "custom",
        "cloud_vendor": "custom",
        "cidr_block": "10.30.0.0/16",
        "region": "idc-shanghai-a",
        "description": "观测平台自建机房资源区。",
    },
    {
        "identifier": "demo-idc-shanghai-b",
        "name": "上海自建 IDC-B",
        "type": "custom",
        "cloud_vendor": "custom",
        "cidr_block": "10.90.0.0/16",
        "region": "idc-shanghai-b",
        "description": "资源池备用主机所在机房。",
    },
]


TOPOLOGY: dict[str, list[tuple[str, str, list[tuple[str, str]]]]] = {
    "demo-mall-commerce": [
        ("生产集群", "prod", [("网关服务", "web"), ("订单服务", "api"), ("库存服务", "api"), ("商城前端", "web")]),
        ("预发集群", "staging", [("预发验证", "web")]),
    ],
    "demo-payment-clearing": [
        ("生产集群", "prod", [("支付网关", "api"), ("对账任务", "other"), ("风控服务", "api")]),
    ],
    "demo-observability": [
        ("生产集群", "prod", [("指标采集", "other"), ("日志检索", "other"), ("告警通知", "other")]),
    ],
    "demo-data-platform": [
        ("试运行集群", "test", [("ETL 调度", "other"), ("指标仓库", "db"), ("报表 API", "api")]),
    ],
}


HOSTS: list[dict[str, Any]] = [
    {"name": "demo-web-01", "business": "demo-mall-commerce", "module": "商城前端", "ip": "10.10.1.11", "area": "demo-tencent-shanghai-prod", "vendor": "tencent_cloud", "region": "ap-shanghai", "cpu": 4, "memory": 8192, "disk": 100, "os": "linux", "os_version": "Ubuntu 22.04 LTS", "tags": ["web", "frontend"]},
    {"name": "demo-web-02", "business": "demo-mall-commerce", "module": "商城前端", "ip": "10.10.1.12", "area": "demo-tencent-shanghai-prod", "vendor": "tencent_cloud", "region": "ap-shanghai", "cpu": 4, "memory": 8192, "disk": 100, "os": "linux", "os_version": "Ubuntu 22.04 LTS", "tags": ["web", "frontend"]},
    {"name": "demo-gateway-01", "business": "demo-mall-commerce", "module": "网关服务", "ip": "10.10.1.21", "area": "demo-tencent-shanghai-prod", "vendor": "tencent_cloud", "region": "ap-shanghai", "cpu": 8, "memory": 16384, "disk": 200, "os": "linux", "os_version": "TencentOS Server 3.1", "tags": ["gateway", "nginx"]},
    {"name": "demo-order-01", "business": "demo-mall-commerce", "module": "订单服务", "ip": "10.10.1.31", "area": "demo-tencent-shanghai-prod", "vendor": "tencent_cloud", "region": "ap-shanghai", "cpu": 8, "memory": 16384, "disk": 300, "os": "linux", "os_version": "Ubuntu 22.04 LTS", "tags": ["order", "java"], "backup": True},
    {"name": "demo-stock-01", "business": "demo-mall-commerce", "module": "库存服务", "ip": "10.10.1.41", "area": "demo-aliyun-shanghai-commerce", "vendor": "aliyun", "region": "cn-shanghai", "cpu": 4, "memory": 8192, "disk": 200, "os": "linux", "os_version": "Alibaba Cloud Linux 3", "tags": ["inventory", "go"]},
    {"name": "demo-pre-01", "business": "demo-mall-commerce", "module": "预发验证", "ip": "10.10.2.11", "area": "demo-tencent-shanghai-prod", "vendor": "tencent_cloud", "region": "ap-shanghai", "cpu": 2, "memory": 4096, "disk": 80, "os": "linux", "os_version": "Ubuntu 22.04 LTS", "tags": ["staging"], "env": "预发"},
    {"name": "demo-pay-api-01", "business": "demo-payment-clearing", "module": "支付网关", "ip": "10.20.1.11", "area": "demo-tencent-guangzhou-pay", "vendor": "tencent_cloud", "region": "ap-guangzhou", "cpu": 8, "memory": 16384, "disk": 200, "os": "linux", "os_version": "TencentOS Server 3.1", "tags": ["payment", "pci"], "backup": True},
    {"name": "demo-pay-api-02", "business": "demo-payment-clearing", "module": "支付网关", "ip": "10.20.1.12", "area": "demo-tencent-guangzhou-pay", "vendor": "tencent_cloud", "region": "ap-guangzhou", "cpu": 8, "memory": 16384, "disk": 200, "os": "linux", "os_version": "TencentOS Server 3.1", "tags": ["payment", "pci"], "backup": True},
    {"name": "demo-pay-reconcile-01", "business": "demo-payment-clearing", "module": "对账任务", "ip": "10.20.1.21", "area": "demo-tencent-guangzhou-pay", "vendor": "tencent_cloud", "region": "ap-guangzhou", "cpu": 4, "memory": 8192, "disk": 150, "os": "windows", "os_version": "Windows Server 2022", "tags": ["reconcile", "job"], "backup": True},
    {"name": "demo-risk-01", "business": "demo-payment-clearing", "module": "风控服务", "ip": "10.20.1.31", "area": "demo-aws-hongkong-risk", "vendor": "aws", "region": "ap-east-1", "cpu": 4, "memory": 8192, "disk": 150, "os": "linux", "os_version": "Amazon Linux 2023", "tags": ["risk", "rules"]},
    {"name": "demo-metrics-01", "business": "demo-observability", "module": "指标采集", "ip": "10.30.1.11", "area": "demo-idc-shanghai-a", "vendor": "custom", "region": "idc-shanghai-a", "cpu": 8, "memory": 32768, "disk": 500, "os": "linux", "os_version": "Debian 12", "tags": ["prometheus"]},
    {"name": "demo-log-01", "business": "demo-observability", "module": "日志检索", "ip": "10.30.1.21", "area": "demo-idc-shanghai-a", "vendor": "custom", "region": "idc-shanghai-a", "cpu": 16, "memory": 65536, "disk": 2000, "os": "linux", "os_version": "Debian 12", "tags": ["elasticsearch", "logs"], "backup": True},
    {"name": "demo-alert-01", "business": "demo-observability", "module": "告警通知", "ip": "10.30.1.31", "area": "demo-idc-shanghai-a", "vendor": "custom", "region": "idc-shanghai-a", "cpu": 4, "memory": 8192, "disk": 120, "os": "linux", "os_version": "Debian 12", "tags": ["alert", "notification"]},
    {"name": "demo-etl-01", "business": "demo-data-platform", "module": "ETL 调度", "ip": "10.40.1.11", "area": "demo-aliyun-hangzhou-data", "vendor": "aliyun", "region": "cn-hangzhou", "cpu": 8, "memory": 32768, "disk": 1000, "os": "linux", "os_version": "Ubuntu 20.04 LTS", "tags": ["etl", "airflow"], "env": "试运行", "backup": True},
    {"name": "demo-warehouse-01", "business": "demo-data-platform", "module": "指标仓库", "ip": "10.40.1.21", "area": "demo-aliyun-hangzhou-data", "vendor": "aliyun", "region": "cn-hangzhou", "cpu": 16, "memory": 65536, "disk": 3000, "os": "linux", "os_version": "Ubuntu 22.04 LTS", "tags": ["warehouse", "clickhouse"], "env": "试运行", "backup": True},
    {"name": "demo-warehouse-win-01", "business": "demo-data-platform", "module": "报表 API", "ip": "10.40.1.31", "area": "demo-aliyun-hangzhou-data", "vendor": "aliyun", "region": "cn-hangzhou", "cpu": 4, "memory": 8192, "disk": 150, "os": "windows", "os_version": "Windows Server 2022", "tags": ["report", "api"], "env": "试运行"},
    {"name": "demo-pool-01", "pool": True, "ip": "10.90.1.11", "area": "demo-idc-shanghai-b", "vendor": "custom", "region": "idc-shanghai-b", "cpu": 4, "memory": 8192, "disk": 200, "os": "linux", "os_version": "Rocky Linux 9", "tags": ["pool", "spare"], "env": "资源池"},
    {"name": "demo-pool-02", "pool": True, "ip": "10.90.1.12", "area": "demo-idc-shanghai-b", "vendor": "custom", "region": "idc-shanghai-b", "cpu": 4, "memory": 8192, "disk": 200, "os": "linux", "os_version": "Rocky Linux 9", "tags": ["pool", "spare"], "env": "资源池"},
    {"name": "demo-pool-build-01", "pool": True, "ip": "10.90.1.13", "area": "demo-idc-shanghai-b", "vendor": "custom", "region": "idc-shanghai-b", "cpu": 8, "memory": 16384, "disk": 300, "os": "linux", "os_version": "Rocky Linux 9", "tags": ["pool", "builder"], "env": "资源池"},
    {"name": "demo-pool-win-01", "pool": True, "ip": "10.90.2.21", "area": "demo-idc-shanghai-b", "vendor": "custom", "region": "idc-shanghai-b", "cpu": 8, "memory": 16384, "disk": 300, "os": "windows", "os_version": "Windows Server 2022", "tags": ["pool", "windows"], "env": "资源池"},
    {"name": "demo-pool-win-02", "pool": True, "ip": "10.90.2.22", "area": "demo-idc-shanghai-b", "vendor": "custom", "region": "idc-shanghai-b", "cpu": 8, "memory": 16384, "disk": 300, "os": "windows", "os_version": "Windows Server 2022", "tags": ["pool", "windows"], "env": "资源池"},
]


class Client:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token: str | None = None

    def request(self, path: str, method: str = "GET", data: Any | None = None, ok: tuple[int, ...] = (200, 201, 204)) -> tuple[int, Any]:
        headers = {"User-Agent": "wende-demo-seed/1.0"}
        body = None
        if data is not None:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(self.base_url + path, data=body, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode("utf-8", "replace")
                payload = json.loads(raw) if raw else None
                if resp.status not in ok:
                    raise RuntimeError(f"{method} {path} -> {resp.status}: {raw[:1000]}")
                return resp.status, payload
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", "replace")
            raise RuntimeError(f"{method} {path} -> {exc.code}: {raw[:1200]}") from None

    def login(self, username: str, password: str) -> None:
        _, payload = self.request("/api/v1/auth/login", "POST", {"username": username, "password": password})
        token = payload.get("access_token") or payload.get("data", {}).get("access_token")
        if not token:
            raise RuntimeError("login succeeded but no access token returned")
        self.token = token


def unwrap(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    return payload


def list_items(client: Client, path: str) -> list[dict[str, Any]]:
    _, payload = client.request(path)
    data = unwrap(payload)
    if isinstance(data, dict) and "items" in data:
        return data["items"]
    if isinstance(data, list):
        return data
    return []


def ensure_businesses(client: Client, summary: defaultdict[str, int]) -> dict[str, dict[str, Any]]:
    existing = {item.get("identifier"): item for item in list_items(client, "/api/v1/businesses?limit=100&offset=0")}
    for spec in BUSINESSES:
        if spec["identifier"] in existing:
            summary["business_skipped"] += 1
            continue
        _, payload = client.request("/api/v1/businesses", "POST", spec)
        existing[spec["identifier"]] = unwrap(payload)
        summary["business_created"] += 1
    return {item.get("identifier"): item for item in list_items(client, "/api/v1/businesses?limit=100&offset=0")}


def ensure_cloud_areas(client: Client, summary: defaultdict[str, int]) -> dict[str, dict[str, Any]]:
    existing = {item.get("identifier"): item for item in list_items(client, "/api/v1/cloud-areas?page=1&page_size=100")}
    for spec in CLOUD_AREAS:
        if spec["identifier"] in existing:
            summary["cloud_area_skipped"] += 1
            continue
        _, payload = client.request("/api/v1/cloud-areas", "POST", spec)
        existing[spec["identifier"]] = unwrap(payload)
        summary["cloud_area_created"] += 1
    return {item.get("identifier"): item for item in list_items(client, "/api/v1/cloud-areas?page=1&page_size=100")}


def ensure_business_set(client: Client, businesses: dict[str, dict[str, Any]], summary: defaultdict[str, int]) -> None:
    sets = {item.get("identifier"): item for item in list_items(client, "/api/v1/business-sets?limit=100&offset=0")}
    business_set = sets.get("demo-core-commerce-domain")
    if not business_set:
        _, payload = client.request(
            "/api/v1/business-sets",
            "POST",
            {
                "name": "核心交易域",
                "identifier": "demo-core-commerce-domain",
                "description": "演示业务集：把商城、支付和观测能力组织到同一个交易域视角。",
                "business_id": businesses["demo-mall-commerce"]["id"],
            },
        )
        business_set = unwrap(payload)
        summary["business_set_created"] += 1
    else:
        summary["business_set_skipped"] += 1

    _, payload = client.request(f"/api/v1/business-sets/{business_set['id']}/members")
    current = set(unwrap(payload).get("business_ids", []))
    for ident in ["demo-mall-commerce", "demo-payment-clearing", "demo-observability"]:
        business_id = businesses[ident]["id"]
        if business_id in current:
            summary["business_set_member_skipped"] += 1
            continue
        client.request(f"/api/v1/business-sets/{business_set['id']}/members", "POST", {"business_id": business_id})
        summary["business_set_member_added"] += 1


def ensure_topology(client: Client, businesses: dict[str, dict[str, Any]], summary: defaultdict[str, int]) -> dict[tuple[str, str], dict[str, Any]]:
    modules: dict[tuple[str, str], dict[str, Any]] = {}
    for business_ident, set_specs in TOPOLOGY.items():
        business = businesses[business_ident]
        sets = {item.get("name"): item for item in list_items(client, f"/api/v1/topology/sets?business_id={business['id']}")}
        for set_name, env_type, module_specs in set_specs:
            current_set = sets.get(set_name)
            if not current_set:
                _, payload = client.request(
                    "/api/v1/topology/sets",
                    "POST",
                    {
                        "business_id": business["id"],
                        "name": set_name,
                        "description": f"{business['name']} {set_name}，用于 demo 展示业务拓扑。",
                        "env_type": env_type,
                        "sort_order": len(sets) + 1,
                    },
                )
                current_set = unwrap(payload)
                summary["set_created"] += 1
            else:
                summary["set_skipped"] += 1

            existing_modules = {item.get("name"): item for item in list_items(client, f"/api/v1/topology/modules?set_id={current_set['id']}")}
            for module_name, service_type in module_specs:
                current_module = existing_modules.get(module_name)
                if not current_module:
                    _, payload = client.request(
                        "/api/v1/topology/modules",
                        "POST",
                        {
                            "set_id": current_set["id"],
                            "name": module_name,
                            "description": f"{business['name']} / {set_name} / {module_name}",
                            "service_type": service_type,
                            "sort_order": len(existing_modules) + 1,
                        },
                    )
                    current_module = unwrap(payload)
                    summary["module_created"] += 1
                else:
                    summary["module_skipped"] += 1
                modules[(business_ident, module_name)] = current_module
    return modules


def host_payload(spec: dict[str, Any], businesses: dict[str, dict[str, Any]], cloud_areas: dict[str, dict[str, Any]]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "host_name": spec["name"],
        "cloud_area_id": cloud_areas[spec["area"]]["id"],
        "primary_ip": spec["ip"],
        "ip_addresses": [spec["ip"]],
        "cloud_vendor": spec["vendor"],
        "cloud_instance_id": "ins-" + spec["name"],
        "cloud_region": spec["region"],
        "vpc_id": "vpc-" + spec["area"].replace("demo-", ""),
        "subnet_id": "subnet-" + spec["region"],
        "cpu": spec["cpu"],
        "memory": spec["memory"],
        "disk_size": spec["disk"],
        "os_type": spec["os"],
        "os_version": spec["os_version"],
        "status": "running",
        "custom_fields": {
            "环境": spec.get("env", "资源池" if spec.get("pool") else "生产"),
            "责任团队": "平台资源池" if spec.get("pool") else businesses[spec["business"]]["name"],
            "标签": spec["tags"],
            "SLA": "99.95%" if spec.get("business") in {"demo-mall-commerce", "demo-payment-clearing"} else "99.9%",
            "监控": True,
            "备份": bool(spec.get("backup", False)),
        },
    }
    if not spec.get("pool"):
        payload["business_id"] = businesses[spec["business"]]["id"]
    return payload


def ensure_hosts(
    client: Client,
    businesses: dict[str, dict[str, Any]],
    cloud_areas: dict[str, dict[str, Any]],
    modules: dict[tuple[str, str], dict[str, Any]],
    summary: defaultdict[str, int],
) -> None:
    existing = {item.get("host_name"): item for item in list_items(client, "/api/v1/hosts?page=1&page_size=100")}
    to_create = [host_payload(spec, businesses, cloud_areas) for spec in HOSTS if spec["name"] not in existing]
    if to_create:
        _, payload = client.request(
            "/api/v1/hosts/batch",
            "POST",
            {"hosts": to_create, "skip_errors": False, "use_default_cloud_area": True},
        )
        result = unwrap(payload)
        summary["host_created"] += int(result.get("successful", 0))
    summary["host_skipped"] += len(HOSTS) - len(to_create)

    existing = {item.get("host_name"): item for item in list_items(client, "/api/v1/hosts?page=1&page_size=100")}
    for spec in HOSTS:
        host = existing.get(spec["name"])
        if not host:
            continue
        desired = host_payload(spec, businesses, cloud_areas)
        client.request(
            f"/api/v1/hosts/{host['id']}",
            "PUT",
            {
                "cloud_area_id": desired["cloud_area_id"],
                "primary_ip": desired["primary_ip"],
                "ip_addresses": desired["ip_addresses"],
                "cpu": desired["cpu"],
                "memory": desired["memory"],
                "disk_size": desired["disk_size"],
                "os_type": desired["os_type"],
                "os_version": desired["os_version"],
                "status": desired["status"],
                "custom_fields": desired["custom_fields"],
            },
        )
        summary["host_refreshed"] += 1

    existing = {item.get("host_name"): item for item in list_items(client, "/api/v1/hosts?page=1&page_size=100")}
    pool_host_ids: list[str] = []
    for spec in HOSTS:
        host = existing.get(spec["name"])
        if not host:
            continue
        if spec.get("pool"):
            pool_host_ids.append(host["id"])
            continue
        module = modules[(spec["business"], spec["module"])]
        client.request("/api/v1/topology/hosts/transfer", "POST", {"host_ids": [host["id"]], "target_module_id": module["id"]})
        summary["host_transferred"] += 1

    if pool_host_ids:
        default_dir = default_resource_directory(client)
        client.request(
            "/api/v1/resource-pool/hosts/import",
            "POST",
            {"directory_id": default_dir["id"], "host_ids": pool_host_ids, "remark": "demo seed resource pool hosts"},
        )
        summary["pool_host_imported"] += len(pool_host_ids)


def default_resource_directory(client: Client) -> dict[str, Any]:
    _, payload = client.request("/api/v1/resource-pool/directories/tree")
    tree = unwrap(payload)
    for node in tree if isinstance(tree, list) else []:
        if node.get("is_default") or node.get("name") == "默认目录":
            return node
    raise RuntimeError("default resource directory not found")


def collect_counts(client: Client) -> dict[str, Any]:
    counts: dict[str, Any] = {}
    endpoints = {
        "businesses": "/api/v1/businesses?limit=100&offset=0",
        "business_sets": "/api/v1/business-sets?limit=100&offset=0",
        "hosts": "/api/v1/hosts?page=1&page_size=100",
        "pool_hosts": "/api/v1/resource-pool/hosts?page=1&page_size=100",
        "cloud_areas": "/api/v1/cloud-areas?page=1&page_size=100",
        "topology_stats": "/api/v1/topology/statistics",
        "host_stats": "/api/v1/hosts/statistics",
    }
    for key, path in endpoints.items():
        _, payload = client.request(path)
        data = unwrap(payload)
        if isinstance(data, dict) and "pagination" in data:
            counts[key] = data["pagination"].get("total")
        else:
            counts[key] = data
    return counts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed Wende CMDB demo data idempotently.")
    parser.add_argument("--base-url", default=os.getenv("DEMO_BASE_URL", "http://localhost:8080"))
    parser.add_argument("--username", default=os.getenv("DEMO_USERNAME", "admin"))
    parser.add_argument("--password", default=os.getenv("DEMO_PASSWORD", "admin123456"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    client = Client(args.base_url)
    summary: defaultdict[str, int] = defaultdict(int)

    client.login(args.username, args.password)
    businesses = ensure_businesses(client, summary)
    cloud_areas = ensure_cloud_areas(client, summary)
    ensure_business_set(client, businesses, summary)
    modules = ensure_topology(client, businesses, summary)
    ensure_hosts(client, businesses, cloud_areas, modules, summary)

    print(json.dumps({"summary": dict(summary), "counts": collect_counts(client)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
