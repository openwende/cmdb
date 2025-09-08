# 插件开发指南

WEND CMDB 插件系统提供了强大的扩展能力，允许开发者创建自定义功能来扩展系统的核心功能。本指南将详细介绍如何开发、打包和部署插件。

## 插件系统概述

### 支持的插件类型

1. **字段类型插件 (Field)** - 自定义字段类型和验证
2. **验证器插件 (Validator)** - 自定义验证逻辑
3. **连接器插件 (Connector)** - 外部系统集成
4. **处理器插件 (Processor)** - 数据处理和转换
5. **导出器插件 (Exporter)** - 数据导出功能
6. **导入器插件 (Importer)** - 数据导入功能
7. **通知器插件 (Notifier)** - 通知和告警
8. **扩展插件 (Extension)** - 通用功能扩展

### 插件架构

插件采用进程隔离的架构，每个插件实例运行在独立的进程中，通过HTTP API与主系统通信。这确保了：

- **安全性** - 插件故障不会影响主系统
- **稳定性** - 插件崩溃可以被检测和重启
- **资源控制** - 可以限制插件的资源使用
- **语言无关** - 支持任何能够提供HTTP API的语言

## 开发环境准备

### 基础要求

- 支持HTTP服务的编程语言（Python、Node.js、Go、Java等）
- 文本编辑器或IDE
- Git（用于版本控制）

### 推荐工具

- **Python**: Flask/FastAPI + requests
- **Node.js**: Express + axios
- **Go**: gin-gonic + net/http
- **Java**: Spring Boot + OkHttp

## 插件清单文件

每个插件都需要一个清单文件（`plugin.yaml` 或 `plugin.json`），描述插件的元数据、配置和依赖。

### 基本结构

```yaml
# plugin.yaml
id: "my-plugin"                    # 唯一标识符
name: "My Awesome Plugin"          # 显示名称
version: "1.0.0"                   # 版本号（语义化版本）
description: "Plugin description"  # 描述
author: "Your Name"                # 作者
homepage: "https://github.com/..."  # 主页
license: "MIT"                     # 许可证
type: "field"                      # 插件类型

# 标签和关键词
tags: ["validation", "email"]
keywords: ["email", "validator"]

# 依赖关系
dependencies:
  cmdb: ">=1.0.0"                  # CMDB最低版本要求

# 配置架构
config:
  schema:                          # JSON Schema
    type: "object"
    properties:
      strict_mode:
        type: "boolean"
        default: false
  default:                         # 默认配置
    strict_mode: false
  required: ["strict_mode"]        # 必需配置项

# 权限要求
permissions:
  - "field:validate"
  - "data:read"

# 资源限制
resources:
  memory: "128MB"
  cpu: "0.5"
  disk: "50MB"
  timeout: "30s"

# 支持的操作
hooks:
  - "validate_value"
  - "format_value"

# 触发的事件
events:
  - "field.validated"

# 执行方式
entrypoint: "main.py"              # 脚本入口点
# 或者
binary: "plugin-binary"            # 二进制文件

created_at: "2024-01-01T00:00:00Z"
updated_at: "2024-01-01T00:00:00Z"
```

## 插件API接口

### HTTP服务器要求

插件必须实现一个HTTP服务器，监听指定端口并提供以下端点：

#### 必需端点

1. **健康检查**: `GET/POST /api/health`
2. **操作执行**: `POST /api/execute`
3. **配置更新**: `POST /api/configure`
4. **插件信息**: `GET /api/info`

### 请求/响应格式

#### 执行请求

```json
POST /api/execute
{
  "operation": "validate_value",
  "params": {
    "value": "test@example.com",
    "options": {}
  },
  "context": {
    "user_id": "user123",
    "tenant_id": "tenant456"
  },
  "request_id": "req_12345"
}
```

#### 执行响应

```json
{
  "success": true,
  "data": {
    "valid": true,
    "normalized": "test@example.com"
  },
  "request_id": "req_12345",
  "duration_ms": 15
}
```

#### 健康检查响应

```json
{
  "success": true,
  "status": "healthy",
  "plugin_id": "my-plugin",
  "version": "1.0.0",
  "uptime": 3600
}
```

### 环境变量

插件启动时会收到以下环境变量：

- `CMDB_PLUGIN_ID` - 插件实例ID
- `CMDB_PLUGIN_PORT` - 监听端口
- `CMDB_PLUGIN_CONFIG` - JSON格式的配置
- `CMDB_DATA_DIR` - 数据目录路径

## 插件类型详细说明

### 字段类型插件

字段类型插件为CMDB添加自定义字段类型，需要实现以下操作：

```python
def validate_value(self, value, options=None):
    """验证字段值"""
    # 实现验证逻辑
    return {"valid": True/False, "error": "错误信息"}

def format_value(self, value, options=None):
    """格式化字段值"""
    # 实现格式化逻辑
    return formatted_value

def parse_value(self, input_str, options=None):
    """从字符串解析值"""
    # 实现解析逻辑
    return parsed_value

def get_default_value(self, options=None):
    """获取默认值"""
    return default_value

def get_field_schema(self):
    """获取字段JSON Schema"""
    return schema_dict
```

### 验证器插件

验证器插件提供自定义验证规则：

```python
def validate_model(self, model):
    """验证模型"""
    errors = []
    # 实现模型验证逻辑
    return errors

def validate_instance(self, instance):
    """验证实例"""
    errors = []
    # 实现实例验证逻辑
    return errors

def validate_field(self, field, value):
    """验证字段"""
    errors = []
    # 实现字段验证逻辑
    return errors
```

### 导出器插件

导出器插件将数据导出为各种格式：

```python
def export(self, data, format_type, options=None):
    """导出数据"""
    # 实现导出逻辑
    return exported_bytes

def get_supported_formats(self):
    """获取支持的格式"""
    return ["csv", "excel", "pdf"]

def get_format_options(self, format_type):
    """获取格式选项"""
    return options_schema
```

## 开发示例

### Python字段验证插件

```python
#!/usr/bin/env python3
import os
import json
import re
from http.server import HTTPServer, BaseHTTPRequestHandler

class EmailValidatorPlugin:
    def __init__(self, config=None):
        self.config = config or {}
        self.strict_mode = self.config.get('strict_mode', False)
    
    def validate_value(self, value, options=None):
        if not value:
            return {"valid": False, "error": "Email is required"}
        
        pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(pattern, value):
            return {"valid": False, "error": "Invalid email format"}
        
        return {"valid": True, "normalized": value.lower()}

class PluginHTTPHandler(BaseHTTPRequestHandler):
    def __init__(self, plugin, *args, **kwargs):
        self.plugin = plugin
        super().__init__(*args, **kwargs)
    
    def do_POST(self):
        if self.path == '/api/execute':
            self.handle_execute()
        elif self.path == '/api/health':
            self.handle_health()
        else:
            self.send_error(404)
    
    def handle_execute(self):
        content_length = int(self.headers['Content-Length'])
        request_data = json.loads(self.rfile.read(content_length))
        
        operation = request_data.get('operation')
        params = request_data.get('params', {})
        
        if operation == 'validate_value':
            result = self.plugin.validate_value(
                params.get('value'),
                params.get('options')
            )
        else:
            result = {"error": f"Unknown operation: {operation}"}
        
        self.send_json_response(200, {
            "success": True,
            "data": result,
            "request_id": request_data.get('request_id')
        })
    
    def handle_health(self):
        self.send_json_response(200, {
            "success": True,
            "status": "healthy"
        })
    
    def send_json_response(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

def main():
    port = int(os.environ.get('CMDB_PLUGIN_PORT', '8001'))
    config = json.loads(os.environ.get('CMDB_PLUGIN_CONFIG', '{}'))
    
    plugin = EmailValidatorPlugin(config)
    
    def handler(*args, **kwargs):
        return PluginHTTPHandler(plugin, *args, **kwargs)
    
    server = HTTPServer(('', port), handler)
    print(f"Plugin listening on port {port}")
    server.serve_forever()

if __name__ == '__main__':
    main()
```

## 插件打包

### 目录结构

```
my-plugin/
├── plugin.yaml          # 插件清单
├── main.py              # 主程序
├── requirements.txt     # Python依赖（可选）
├── README.md           # 说明文档
├── LICENSE             # 许可证
└── examples/           # 使用示例
    └── config.json
```

### 打包方式

1. **目录打包**
```bash
tar -czf my-plugin-1.0.0.tar.gz my-plugin/
```

2. **ZIP打包**
```bash
zip -r my-plugin-1.0.0.zip my-plugin/
```

## 插件安装和使用

### 通过API安装

```bash
curl -X POST http://localhost:8080/api/v1/plugins \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "package_path": "/path/to/my-plugin-1.0.0.tar.gz",
    "auto_enable": true,
    "config": {
      "strict_mode": true
    }
  }'
```

### 通过CLI安装

```bash
# 安装插件
cmdb plugin install /path/to/my-plugin-1.0.0.tar.gz

# 启用插件
cmdb plugin enable my-plugin --config '{"strict_mode": true}'

# 查看插件状态
cmdb plugin list

# 测试插件
cmdb plugin execute my-plugin validate_value \
  --params '{"value": "test@example.com"}'
```

## 最佳实践

### 错误处理

1. **优雅处理错误**
```python
try:
    result = process_data(data)
    return {"success": True, "data": result}
except ValidationError as e:
    return {"success": False, "error": str(e)}
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    return {"success": False, "error": "Internal error"}
```

2. **详细错误信息**
```python
return {
    "success": False,
    "error": "Validation failed",
    "details": {
        "field": "email",
        "code": "INVALID_FORMAT",
        "message": "Email format is invalid"
    }
}
```

### 性能优化

1. **缓存计算结果**
```python
class MyPlugin:
    def __init__(self):
        self.cache = {}
    
    def expensive_operation(self, input_data):
        cache_key = hash(str(input_data))
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        result = do_expensive_computation(input_data)
        self.cache[cache_key] = result
        return result
```

2. **批量处理**
```python
def process_batch(self, items):
    """批量处理项目以提高性能"""
    results = []
    for item in items:
        result = self.process_item(item)
        results.append(result)
    return results
```

### 安全考虑

1. **输入验证**
```python
def validate_input(self, data):
    if not isinstance(data, dict):
        raise ValueError("Input must be a dictionary")
    
    required_fields = ['value', 'type']
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Missing required field: {field}")
```

2. **资源限制**
```python
import signal

def timeout_handler(signum, frame):
    raise TimeoutError("Operation timed out")

def with_timeout(timeout_seconds):
    def decorator(func):
        def wrapper(*args, **kwargs):
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(timeout_seconds)
            try:
                result = func(*args, **kwargs)
                signal.alarm(0)
                return result
            except TimeoutError:
                raise
        return wrapper
    return decorator
```

### 日志记录

```python
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/plugin.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

class MyPlugin:
    def process_data(self, data):
        logger.info(f"Processing data: {len(data)} items")
        try:
            result = self.do_processing(data)
            logger.info("Processing completed successfully")
            return result
        except Exception as e:
            logger.error(f"Processing failed: {e}")
            raise
```

### 配置管理

```python
class PluginConfig:
    def __init__(self, config_dict):
        self.strict_mode = config_dict.get('strict_mode', False)
        self.timeout = config_dict.get('timeout', 30)
        self.max_items = config_dict.get('max_items', 1000)
        
        # 验证配置
        self.validate()
    
    def validate(self):
        if self.timeout <= 0:
            raise ValueError("Timeout must be positive")
        if self.max_items <= 0:
            raise ValueError("Max items must be positive")
    
    def update(self, new_config):
        """更新配置"""
        for key, value in new_config.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self.validate()
```

## 测试

### 单元测试

```python
import unittest
from my_plugin import EmailValidatorPlugin

class TestEmailValidator(unittest.TestCase):
    def setUp(self):
        self.plugin = EmailValidatorPlugin({
            'strict_mode': False
        })
    
    def test_valid_email(self):
        result = self.plugin.validate_value('test@example.com')
        self.assertTrue(result['valid'])
    
    def test_invalid_email(self):
        result = self.plugin.validate_value('invalid-email')
        self.assertFalse(result['valid'])
    
    def test_empty_email(self):
        result = self.plugin.validate_value('')
        self.assertFalse(result['valid'])

if __name__ == '__main__':
    unittest.main()
```

### 集成测试

```python
import requests
import json
import time
import subprocess
import os

class TestPluginIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # 启动插件进程
        env = os.environ.copy()
        env['CMDB_PLUGIN_PORT'] = '8999'
        env['CMDB_PLUGIN_CONFIG'] = '{}'
        
        cls.plugin_process = subprocess.Popen(
            ['python', 'main.py'],
            env=env
        )
        
        # 等待插件启动
        time.sleep(2)
        cls.base_url = 'http://localhost:8999'
    
    @classmethod
    def tearDownClass(cls):
        cls.plugin_process.terminate()
    
    def test_health_check(self):
        response = requests.get(f'{self.base_url}/api/health')
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['status'], 'healthy')
    
    def test_execute_operation(self):
        payload = {
            'operation': 'validate_value',
            'params': {'value': 'test@example.com'},
            'request_id': 'test123'
        }
        
        response = requests.post(
            f'{self.base_url}/api/execute',
            json=payload
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['request_id'], 'test123')
```

## 调试技巧

### 本地调试

1. **环境变量设置**
```bash
export CMDB_PLUGIN_PORT=8001
export CMDB_PLUGIN_CONFIG='{"strict_mode": true}'
export CMDB_PLUGIN_ID="debug-instance"
python main.py
```

2. **使用调试工具**
```python
import pdb

def debug_operation(self, data):
    pdb.set_trace()  # 设置断点
    result = self.process(data)
    return result
```

### 请求测试

```bash
# 健康检查
curl http://localhost:8001/api/health

# 执行操作
curl -X POST http://localhost:8001/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "validate_value",
    "params": {"value": "test@example.com"},
    "request_id": "test123"
  }'
```

## 发布和分发

### 版本管理

使用语义化版本号：
- `1.0.0` - 主版本.次版本.修订版本
- `1.0.0-alpha.1` - 预发布版本
- `1.0.0+build.1` - 构建元数据

### 插件仓库

推荐将插件发布到Git仓库：

```
https://github.com/username/cmdb-plugin-name
├── releases/
│   ├── v1.0.0/
│   │   └── plugin-name-1.0.0.tar.gz
│   └── latest/
│       └── plugin-name-latest.tar.gz
├── docs/
├── examples/
└── src/
```

### 文档要求

每个插件应包含：

1. **README.md** - 基本说明
2. **CHANGELOG.md** - 版本变更
3. **API.md** - API文档
4. **EXAMPLES.md** - 使用示例

## 故障排除

### 常见问题

1. **插件无法启动**
   - 检查端口是否被占用
   - 验证插件清单文件格式
   - 查看插件日志输出

2. **健康检查失败**
   - 确认HTTP服务器正在运行
   - 检查端点路径是否正确
   - 验证响应格式

3. **操作执行错误**
   - 检查参数格式和类型
   - 验证插件逻辑
   - 查看错误日志

### 调试命令

```bash
# 查看插件日志
cmdb plugin logs my-plugin

# 检查插件状态
cmdb plugin status my-plugin

# 重启插件
cmdb plugin restart my-plugin

# 调试模式运行
cmdb plugin debug my-plugin
```

## 性能监控

插件系统提供详细的性能监控：

- 请求数量和错误率
- 响应时间分析
- 资源使用情况
- 健康状态历史

通过监控API获取指标：

```bash
# 获取插件指标
curl http://localhost:8080/api/v1/plugins/instances/my-plugin/metrics

# 设置告警阈值
curl -X PUT http://localhost:8080/api/v1/plugins/instances/my-plugin/thresholds \
  -d '{"max_error_rate": 5.0, "max_latency": "1s"}'
```

## 社区和支持

- **文档**: https://docs.cmdb.wend.com/plugins
- **示例**: https://github.com/wend/cmdb-plugins
- **讨论**: https://github.com/wend/cmdb-backend/discussions
- **问题**: https://github.com/wend/cmdb-backend/issues