package auth

import "context"

// SystemOperator 是无请求级用户时（迁移脚本、后台任务、单测等）审计记录的操作人。
const SystemOperator = "system"

type operatorContextKey struct{}

// WithOperator 把操作人写入 context，供 service 层审计（resource_histories.changed_by）读取。
// 认证中间件在识别用户后调用；service 层无需依赖 gin。
func WithOperator(ctx context.Context, operator string) context.Context {
	return context.WithValue(ctx, operatorContextKey{}, operator)
}

// OperatorFromContext 返回 context 中的操作人；取不到时降级为 SystemOperator。
func OperatorFromContext(ctx context.Context) string {
	if ctx != nil {
		if operator, ok := ctx.Value(operatorContextKey{}).(string); ok && operator != "" {
			return operator
		}
	}
	return SystemOperator
}
