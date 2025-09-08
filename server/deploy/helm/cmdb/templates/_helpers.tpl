{{/*
Expand the name of the chart.
*/}}
{{- define "cmdb.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "cmdb.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "cmdb.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "cmdb.labels" -}}
helm.sh/chart: {{ include "cmdb.chart" . }}
{{ include "cmdb.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "cmdb.selectorLabels" -}}
app.kubernetes.io/name: {{ include "cmdb.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "cmdb.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "cmdb.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create PostgreSQL hostname
*/}}
{{- define "cmdb.postgresql.hostname" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "cmdb.fullname" .) }}
{{- else }}
{{- .Values.app.database.host }}
{{- end }}
{{- end }}

{{/*
Create Redis hostname
*/}}
{{- define "cmdb.redis.hostname" -}}
{{- if .Values.redis.enabled }}
{{- printf "%s-redis-master" (include "cmdb.fullname" .) }}
{{- else }}
{{- .Values.app.redis.host }}
{{- end }}
{{- end }}

{{/*
Create database connection string
*/}}
{{- define "cmdb.database.connectionString" -}}
{{- printf "host=%s port=%d user=%s password=%s dbname=%s sslmode=%s" (include "cmdb.postgresql.hostname" .) (.Values.app.database.port | int) .Values.app.database.user .Values.app.database.password .Values.app.database.name .Values.app.database.sslmode }}
{{- end }}

{{/*
Create Redis connection string
*/}}
{{- define "cmdb.redis.connectionString" -}}
{{- printf "%s:%d" (include "cmdb.redis.hostname" .) (.Values.app.redis.port | int) }}
{{- end }}

{{/*
Create image reference
*/}}
{{- define "cmdb.image" -}}
{{- printf "%s:%s" .Values.image.repository (default .Chart.AppVersion .Values.image.tag) }}
{{- end }}

{{/*
Create ConfigMap name
*/}}
{{- define "cmdb.configMapName" -}}
{{- printf "%s-config" (include "cmdb.fullname" .) }}
{{- end }}

{{/*
Create Secret name
*/}}
{{- define "cmdb.secretName" -}}
{{- printf "%s-secret" (include "cmdb.fullname" .) }}
{{- end }}

{{/*
Create metrics service name
*/}}
{{- define "cmdb.metricsServiceName" -}}
{{- printf "%s-metrics" (include "cmdb.fullname" .) }}
{{- end }}

{{/*
Create PVC name
*/}}
{{- define "cmdb.pvcName" -}}
{{- printf "%s-data" (include "cmdb.fullname" .) }}
{{- end }}