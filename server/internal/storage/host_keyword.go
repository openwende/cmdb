package storage

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
)

// EscapeLike 转义 LIKE 通配符，让关键字里的 % 和 _ 按字面匹配（配合 ESCAPE '\'）。
func EscapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// HostKeywordCondition 主机名或主 IP 的不区分大小写子串匹配条件，供 Where(cond, args...) 使用。
// table 是查询里 hosts 表的名字或别名；keyword 为空（或只有空白）时 ok=false，不加过滤。
// PG：primary_ip 是 inet，用 host() 取不带掩码的地址文本（inet::text 会带 /32，inet 直接 LIKE 会报错）；
// 测试用的 sqlite 里是 text，LIKE 本身对 ASCII 不区分大小写。
func HostKeywordCondition(db *gorm.DB, table, keyword string) (cond string, args []interface{}, ok bool) {
	kw := strings.TrimSpace(keyword)
	if kw == "" {
		return "", nil, false
	}
	like := "%" + EscapeLike(kw) + "%"
	ipExpr, op := table+".primary_ip", "LIKE"
	if db.Dialector.Name() == "postgres" {
		ipExpr, op = "host("+table+".primary_ip)", "ILIKE"
	}
	cond = fmt.Sprintf(`(%s.host_name %s ? ESCAPE '\' OR %s %s ? ESCAPE '\')`, table, op, ipExpr, op)
	return cond, []interface{}{like, like}, true
}
